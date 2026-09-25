-- AI / LLM best-practices hardening (docs/workflow/for-testing/ai-llm-best-practices-hardening.md).

-- Phase 0.1: dashboard-assistant-confirm now claims a pending action atomically
-- (pending -> confirmed) and records execution failures truthfully as `failed`.
ALTER TABLE public.ai_dashboard_assistant_pending_actions
  DROP CONSTRAINT IF EXISTS ai_dashboard_assistant_pending_actions_status_check;
ALTER TABLE public.ai_dashboard_assistant_pending_actions
  ADD CONSTRAINT ai_dashboard_assistant_pending_actions_status_check CHECK (
    status IN ('pending', 'confirmed', 'executed', 'failed', 'denied', 'expired')
  );

-- Phase 0.9 / 7: knowledge-base retrieval for the dashboard assistant.
-- Replaces a PostgREST `.or(ilike)` filter built by string interpolation (filter injection, and it
-- bypassed the FTS index). Parameterized, ranked top-k over the existing GIN expression index:
-- all-terms match first, then any-term match, then a safe substring fallback. Returns the source guide so
-- answers can cite where they came from.
CREATE OR REPLACE FUNCTION public.search_ai_assistant_knowledge_base(
  p_query TEXT,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  question TEXT,
  answer TEXT,
  route_path TEXT,
  route_guide_path TEXT,
  rank REAL
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT
      websearch_to_tsquery('english', left(coalesce(p_query, ''), 500)) AS tsq_all,
      -- Same terms OR-ed: natural questions rarely contain every word of a matching answer.
      nullif(
        replace(websearch_to_tsquery('english', left(coalesce(p_query, ''), 500))::text, ' & ', ' | '),
        ''
      ) AS tsq_any_text,
      '%' || replace(replace(replace(left(coalesce(p_query, ''), 200), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS pattern,
      greatest(1, least(coalesce(p_limit, 5), 10)) AS lim
  ),
  fts_all AS (
    SELECT kb.id, kb.question, kb.answer, kb.route_path, kb.route_guide_path,
           ts_rank(to_tsvector('english', kb.question || ' ' || kb.answer), q.tsq_all) AS rank
    FROM public.ai_dashboard_assistant_knowledge_base kb, q
    WHERE to_tsvector('english', kb.question || ' ' || kb.answer) @@ q.tsq_all
    ORDER BY rank DESC
    LIMIT (SELECT lim FROM q)
  ),
  fts_any AS (
    SELECT kb.id, kb.question, kb.answer, kb.route_path, kb.route_guide_path,
           ts_rank(to_tsvector('english', kb.question || ' ' || kb.answer), to_tsquery('english', q.tsq_any_text)) AS rank
    FROM public.ai_dashboard_assistant_knowledge_base kb, q
    WHERE NOT EXISTS (SELECT 1 FROM fts_all)
      AND q.tsq_any_text IS NOT NULL
      AND to_tsvector('english', kb.question || ' ' || kb.answer) @@ to_tsquery('english', q.tsq_any_text)
    ORDER BY rank DESC
    LIMIT (SELECT lim FROM q)
  ),
  fallback AS (
    SELECT kb.id, kb.question, kb.answer, kb.route_path, kb.route_guide_path, 0::REAL AS rank
    FROM public.ai_dashboard_assistant_knowledge_base kb, q
    WHERE NOT EXISTS (SELECT 1 FROM fts_all)
      AND NOT EXISTS (SELECT 1 FROM fts_any)
      AND length(trim(coalesce(p_query, ''))) > 0
      AND (kb.question ILIKE q.pattern OR kb.answer ILIKE q.pattern)
    LIMIT (SELECT lim FROM q)
  )
  SELECT * FROM fts_all
  UNION ALL
  SELECT * FROM fts_any
  UNION ALL
  SELECT * FROM fallback;
$$;

REVOKE ALL ON FUNCTION public.search_ai_assistant_knowledge_base(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_ai_assistant_knowledge_base(TEXT, INTEGER) TO service_role;

-- Phase 2.6 / 5: per-call observability on the AI usage log. Written by the shared AI gateway
-- (_shared/ai/llmClient.ts). Failed provider calls are now logged too (status = 'error',
-- zero cost/credits, never counted against quotas) so error and fallback rates are visible.
ALTER TABLE public.ai_platform_usage_events
  ADD COLUMN IF NOT EXISTS prompt_id TEXT,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.ai_platform_usage_events
  DROP CONSTRAINT IF EXISTS ai_platform_usage_events_status_check;
ALTER TABLE public.ai_platform_usage_events
  ADD CONSTRAINT ai_platform_usage_events_status_check CHECK (status IN ('success', 'error'));

CREATE INDEX IF NOT EXISTS idx_ai_platform_usage_events_feature_status_created
  ON public.ai_platform_usage_events (feature, status, created_at DESC);

COMMENT ON COLUMN public.ai_platform_usage_events.prompt_version IS
  'Version of the prompt module (_shared/ai/prompts) that produced this call, so quality regressions are attributable.';
COMMENT ON COLUMN public.ai_platform_usage_events.status IS
  'success = billed call; error = failed provider call (zero cost, not counted against quotas).';

-- Phase 3.2 / 4: atomic dashboard-assistant usage counters. Replaces a read-then-upsert in
-- dashboardAssistantSettings.ts that lost counts under concurrent turns, and backs the
-- (previously stored but unenforced) daily write-action limit.
CREATE OR REPLACE FUNCTION public.increment_ai_dashboard_assistant_usage_daily(
  p_organization_id UUID,
  p_usage_date DATE,
  p_messages INT DEFAULT 0,
  p_write_actions INT DEFAULT 0,
  p_credits NUMERIC DEFAULT 0
)
RETURNS TABLE (message_count INT, write_action_count INT)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO public.ai_dashboard_assistant_usage_daily AS u
    (organization_id, usage_date, message_count, write_action_count, credits_consumed)
  VALUES
    (p_organization_id, p_usage_date, GREATEST(p_messages, 0), GREATEST(p_write_actions, 0), GREATEST(p_credits, 0))
  ON CONFLICT (organization_id, usage_date) DO UPDATE SET
    message_count = u.message_count + EXCLUDED.message_count,
    write_action_count = u.write_action_count + EXCLUDED.write_action_count,
    credits_consumed = u.credits_consumed + EXCLUDED.credits_consumed
  RETURNING u.message_count, u.write_action_count;
$$;

REVOKE ALL ON FUNCTION public.increment_ai_dashboard_assistant_usage_daily(UUID, DATE, INT, INT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_dashboard_assistant_usage_daily(UUID, DATE, INT, INT, NUMERIC) TO service_role;

-- Phase 5: AI data retention. Pure SQL (no edge hop), scheduled nightly by pg_cron when present.
--  * ai_platform_response_cache: rows past expires_at are deleted (reads already ignore them).
--  * ai_dashboard_assistant_messages.tool_calls: the redacted tool-result audit copy is cleared
--    after p_tool_calls_days (conversation text itself stays — hosts see their own history).
--  * ai_dashboard_assistant_pending_actions: resolved/expired proposals older than 30 days.
CREATE OR REPLACE FUNCTION public.run_ai_data_retention(p_tool_calls_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cache INTEGER;
  v_tool_calls INTEGER;
  v_pending INTEGER;
BEGIN
  DELETE FROM public.ai_platform_response_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS v_cache = ROW_COUNT;

  UPDATE public.ai_dashboard_assistant_messages
     SET tool_calls = '[]'::jsonb
   WHERE created_at < NOW() - make_interval(days => GREATEST(p_tool_calls_days, 1))
     AND tool_calls IS NOT NULL
     AND tool_calls <> '[]'::jsonb;
  GET DIAGNOSTICS v_tool_calls = ROW_COUNT;

  DELETE FROM public.ai_dashboard_assistant_pending_actions
   WHERE status <> 'pending'
     AND created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_pending = ROW_COUNT;

  RETURN jsonb_build_object(
    'responseCacheDeleted', v_cache,
    'toolCallsCleared', v_tool_calls,
    'pendingActionsDeleted', v_pending
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_ai_data_retention(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_ai_data_retention(INTEGER) TO service_role;

DO $cron$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed — skipping ai-data-retention schedule';
    RETURN;
  END IF;
  FOR r IN SELECT jobname FROM cron.job WHERE jobname = 'ai-data-retention-nightly' LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;
  -- 03:41 UTC (11:41 Asia/Manila) — off-peak, clear of the other nightly sweeps.
  PERFORM cron.schedule('ai-data-retention-nightly', '41 3 * * *', 'SELECT public.run_ai_data_retention();');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ai-data-retention schedule skipped: %', SQLERRM;
END;
$cron$;
