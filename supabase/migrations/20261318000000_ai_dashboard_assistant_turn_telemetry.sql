-- AI Dashboard Assistant — Phase 7 "Telemetry" (the last remaining Phase 7 item): rounds per
-- turn, Phase 3 plan size + approval outcome, Phase 3 step-failure rate, Phase 2 completion-check
-- misses, and credits per turn, for the existing assistantLatencySummary-style rollup and the
-- `/admin/ai` Usage tab.
-- Plan: docs/workflow/in-progress/agentic-ai-assistants.md, Phase 7 "Telemetry".
--
-- No new columns and no schema change to the Phase 3 tables. `rounds` and `credits_consumed`
-- were already recorded on `ai_dashboard_assistant_messages.latency_breakdown` (migration
-- 20261316127700) just never rolled up; `plan_size` and `completion_check_miss` are two new keys
-- inside that same JSONB column, written by dashboard-assistant-chat (older rows simply omit
-- them — read as NULL / false below, never an error). Plan approval outcome and step-failure
-- counts are read directly off the existing `ai_dashboard_assistant_action_plans` /
-- `ai_dashboard_assistant_pending_actions` tables (Phase 3, migration 20261317130000) —
-- `dashboard-assistant-confirm` already writes the final plan status and each step's status, so
-- this is a read-only rollup over data that already exists.

-- ─── Turn-level rollup: rounds / plan size / completion-check misses / credits ───────────────
CREATE OR REPLACE FUNCTION public.super_admin_assistant_turn_telemetry(p_since TIMESTAMPTZ)
RETURNS TABLE (
  turns BIGINT,
  avg_rounds NUMERIC,
  p50_rounds NUMERIC,
  p95_rounds NUMERIC,
  turns_with_plan BIGINT,
  avg_plan_size NUMERIC,
  completion_miss_turns BIGINT,
  avg_credits NUMERIC,
  p50_credits NUMERIC,
  p95_credits NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH turns AS (
    SELECT
      (m.latency_breakdown->>'rounds')::NUMERIC AS rounds,
      (m.latency_breakdown->>'credits_consumed')::NUMERIC AS credits,
      (m.latency_breakdown->>'plan_size')::NUMERIC AS plan_size,
      COALESCE((m.latency_breakdown->>'completion_check_miss')::BOOLEAN, FALSE)
        AS completion_check_miss
    FROM public.ai_dashboard_assistant_messages m
    WHERE m.role = 'assistant'
      AND m.latency_breakdown IS NOT NULL
      AND m.created_at >= p_since
  )
  SELECT
    COUNT(*),
    AVG(rounds),
    (percentile_disc(0.5) WITHIN GROUP (ORDER BY rounds)),
    (percentile_disc(0.95) WITHIN GROUP (ORDER BY rounds)),
    COUNT(*) FILTER (WHERE plan_size IS NOT NULL),
    AVG(plan_size) FILTER (WHERE plan_size IS NOT NULL),
    COUNT(*) FILTER (WHERE completion_check_miss),
    AVG(credits),
    (percentile_disc(0.5) WITHIN GROUP (ORDER BY credits)),
    (percentile_disc(0.95) WITHIN GROUP (ORDER BY credits))
  FROM turns;
$$;

REVOKE ALL ON FUNCTION public.super_admin_assistant_turn_telemetry(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_assistant_turn_telemetry(TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.super_admin_assistant_turn_telemetry(TIMESTAMPTZ) IS
  'AI Usage tab: assistant turn-level telemetry since p_since — rounds and credits distribution, how many turns proposed a Phase 3 action plan and its average size, and how many turns hit the Phase 2 completion check (ran out of rounds/budget/deadline/credit ceiling with a declared goal still open). Service role only.';

-- ─── Plan-level rollup: approval outcome + step-failure counts ───────────────────────────────
CREATE OR REPLACE FUNCTION public.super_admin_assistant_plan_outcomes(p_since TIMESTAMPTZ)
RETURNS TABLE (
  status TEXT,
  plans BIGINT,
  total_steps BIGINT,
  failed_steps BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    p.status,
    COUNT(DISTINCT p.id),
    COUNT(a.id) FILTER (WHERE a.status IN ('executed', 'failed')),
    COUNT(a.id) FILTER (WHERE a.status = 'failed')
  FROM public.ai_dashboard_assistant_action_plans p
  LEFT JOIN public.ai_dashboard_assistant_pending_actions a ON a.plan_id = p.id
  WHERE p.created_at >= p_since
  GROUP BY p.status;
$$;

REVOKE ALL ON FUNCTION public.super_admin_assistant_plan_outcomes(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_assistant_plan_outcomes(TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.super_admin_assistant_plan_outcomes(TIMESTAMPTZ) IS
  'AI Usage tab: Phase 3 action-plan outcomes since p_since, grouped by final status (proposed/approved/running/completed/partially_failed/cancelled/expired) — plan count plus step execution/failure counts per status. Service role only.';
