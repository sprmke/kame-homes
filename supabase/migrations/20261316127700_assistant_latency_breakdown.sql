-- AI dashboard assistant: per-turn latency breakdown + guard mode.
-- Plan: docs/workflow/in-progress/ai-companion-response-quality-and-generative-ui.md (Phase 0).
--
-- latency_breakdown (assistant rows only) mirrors _shared/dashboardAssistantTurnTiming.ts:
--   { preload_ms, model_ms[], tools_ms[{name, ms}], synth_ms, guard_ms, commit_ms, total_ms,
--     guard_mode, modules[], primary_module, rounds, synth_inline }
-- Tool names and router modules are platform identifiers, never tenant data, so the column is
-- exempt from the tool_calls retention purge in 20261316123050_ai_llm_hardening.sql.

ALTER TABLE public.ai_dashboard_assistant_messages
  ADD COLUMN IF NOT EXISTS latency_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS guard_mode TEXT;

ALTER TABLE public.ai_dashboard_assistant_messages
  DROP CONSTRAINT IF EXISTS ai_dashboard_assistant_messages_guard_mode_check;
ALTER TABLE public.ai_dashboard_assistant_messages
  ADD CONSTRAINT ai_dashboard_assistant_messages_guard_mode_check
  CHECK (guard_mode IS NULL OR guard_mode IN ('llm', 'deterministic', 'blocked', 'none'));

COMMENT ON COLUMN public.ai_dashboard_assistant_messages.latency_breakdown IS
  'Assistant rows: phase timings for the turn (preload/model/tools/synth/guard/commit, total_ms, primary_module). See _shared/dashboardAssistantTurnTiming.ts.';
COMMENT ON COLUMN public.ai_dashboard_assistant_messages.guard_mode IS
  'Assistant rows: which safety guard produced the reply — llm (reviewer call), deterministic (grounding + quick scan only), blocked (quick scan rejected), none (no model-written text).';

-- The AI Usage rollup scans assistant rows by time; partial index keeps it cheap.
CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_messages_latency_created
  ON public.ai_dashboard_assistant_messages (created_at DESC)
  WHERE role = 'assistant' AND latency_breakdown IS NOT NULL;

-- ─── Super-admin rollup: p50/p95 per router module and per guard mode ─────────
-- One row per (dimension, key). dimension = 'module' (primary_module) or 'guard_mode'.
CREATE OR REPLACE FUNCTION public.super_admin_assistant_latency(p_since TIMESTAMPTZ)
RETURNS TABLE (
  dimension TEXT,
  key TEXT,
  turns BIGINT,
  total_p50_ms INT,
  total_p95_ms INT,
  model_p50_ms INT,
  tools_p50_ms INT,
  synth_p50_ms INT,
  guard_p50_ms INT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH turns AS (
    SELECT
      COALESCE(NULLIF(m.latency_breakdown->>'primary_module', ''), 'core') AS module,
      COALESCE(NULLIF(m.guard_mode, ''), 'unknown') AS guard_mode,
      NULLIF((m.latency_breakdown->>'total_ms')::NUMERIC, 0) AS total_ms,
      (
        SELECT COALESCE(SUM(v::NUMERIC), 0)
        FROM jsonb_array_elements_text(COALESCE(m.latency_breakdown->'model_ms', '[]'::jsonb)) AS v
      ) AS model_ms,
      (
        SELECT COALESCE(SUM((t->>'ms')::NUMERIC), 0)
        FROM jsonb_array_elements(COALESCE(m.latency_breakdown->'tools_ms', '[]'::jsonb)) AS t
      ) AS tools_ms,
      (m.latency_breakdown->>'synth_ms')::NUMERIC AS synth_ms,
      (m.latency_breakdown->>'guard_ms')::NUMERIC AS guard_ms
    FROM public.ai_dashboard_assistant_messages m
    WHERE m.role = 'assistant'
      AND m.latency_breakdown IS NOT NULL
      AND m.created_at >= p_since
  )
  SELECT
    'module'::TEXT,
    module,
    COUNT(*),
    (percentile_disc(0.5) WITHIN GROUP (ORDER BY total_ms) FILTER (WHERE total_ms IS NOT NULL))::INT,
    (percentile_disc(0.95) WITHIN GROUP (ORDER BY total_ms) FILTER (WHERE total_ms IS NOT NULL))::INT,
    (percentile_disc(0.5) WITHIN GROUP (ORDER BY model_ms))::INT,
    (percentile_disc(0.5) WITHIN GROUP (ORDER BY tools_ms))::INT,
    (percentile_disc(0.5) WITHIN GROUP (ORDER BY synth_ms) FILTER (WHERE synth_ms IS NOT NULL))::INT,
    (percentile_disc(0.5) WITHIN GROUP (ORDER BY guard_ms) FILTER (WHERE guard_ms IS NOT NULL))::INT
  FROM turns
  GROUP BY module
  UNION ALL
  SELECT
    'guard_mode'::TEXT,
    guard_mode,
    COUNT(*),
    (percentile_disc(0.5) WITHIN GROUP (ORDER BY total_ms) FILTER (WHERE total_ms IS NOT NULL))::INT,
    (percentile_disc(0.95) WITHIN GROUP (ORDER BY total_ms) FILTER (WHERE total_ms IS NOT NULL))::INT,
    (percentile_disc(0.5) WITHIN GROUP (ORDER BY model_ms))::INT,
    (percentile_disc(0.5) WITHIN GROUP (ORDER BY tools_ms))::INT,
    (percentile_disc(0.5) WITHIN GROUP (ORDER BY synth_ms) FILTER (WHERE synth_ms IS NOT NULL))::INT,
    (percentile_disc(0.5) WITHIN GROUP (ORDER BY guard_ms) FILTER (WHERE guard_ms IS NOT NULL))::INT
  FROM turns
  GROUP BY guard_mode;
$$;

REVOKE ALL ON FUNCTION public.super_admin_assistant_latency(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_assistant_latency(TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.super_admin_assistant_latency(TIMESTAMPTZ) IS
  'AI Usage tab: assistant turn latency p50/p95 grouped by primary router module and by guard mode since p_since. Service role only.';
