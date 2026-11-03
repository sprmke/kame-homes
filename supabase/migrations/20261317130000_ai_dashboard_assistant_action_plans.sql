-- AI Dashboard Assistant — Phase 3 plan-card approval (multi-step Tier-2 writes).
-- docs/workflow/in-progress/agentic-ai-assistants.md, Phase 3 item 1.
-- Same RLS/column conventions as 20261018120000_ai_dashboard_assistant.sql's
-- ai_dashboard_assistant_pending_actions table; a plan is a group of steps that used to be one
-- pending-action row each. Keeps single-action confirm working unmodified: a plan is only created
-- when a turn collects 2+ Tier-2 proposals, so most turns never touch this table at all.

CREATE TABLE IF NOT EXISTS public.ai_dashboard_assistant_action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_dashboard_assistant_conversations (id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.ai_dashboard_assistant_messages (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties (id) ON DELETE SET NULL,
  parking_id UUID REFERENCES public.parkings (id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'proposed',
  ledger JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_dashboard_assistant_action_plans_status_check CHECK (
    status IN ('proposed', 'approved', 'running', 'completed', 'partially_failed', 'cancelled', 'expired')
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_action_plans_user_status
  ON public.ai_dashboard_assistant_action_plans (user_id, status);

COMMENT ON TABLE public.ai_dashboard_assistant_action_plans IS
  'A turn''s collected Tier-2 (plus any plan-joined Tier-1) write proposals, approved and run as one unit. ledger is a point-in-time copy of the proposed steps (tool name, summary, risk tier) for host-facing rendering; the live per-step state lives on ai_dashboard_assistant_pending_actions rows via plan_id.';

-- ─── Join pending_actions rows into a plan ───────────────────────────────────

ALTER TABLE public.ai_dashboard_assistant_pending_actions
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.ai_dashboard_assistant_action_plans (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS step_index INT,
  ADD COLUMN IF NOT EXISTS depends_on INT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS selected BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS result JSONB;

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_pending_actions_plan
  ON public.ai_dashboard_assistant_pending_actions (plan_id, step_index)
  WHERE plan_id IS NOT NULL;

COMMENT ON COLUMN public.ai_dashboard_assistant_pending_actions.plan_id IS
  'Set when this row is one step of a multi-step plan (ai_dashboard_assistant_action_plans) rather than a standalone single-action proposal.';
COMMENT ON COLUMN public.ai_dashboard_assistant_pending_actions.step_index IS
  '0-based order within the plan. NULL for a standalone (non-plan) pending action.';
COMMENT ON COLUMN public.ai_dashboard_assistant_pending_actions.depends_on IS
  'step_index values of earlier steps this one reads a placeholder from (e.g. {{step1.bookingId}}). Skipped, not run, if any dependency failed.';
COMMENT ON COLUMN public.ai_dashboard_assistant_pending_actions.selected IS
  'Host tick state on the plan card. A plan-joined Tier-1 step defaults TRUE (pre-ticked, low risk); confirm only runs selected steps.';
COMMENT ON COLUMN public.ai_dashboard_assistant_pending_actions.result IS
  'Per-step execution result ({ ok, data?, error? }) once run, for the continuation turn and for re-rendering the plan card after a reload.';

-- ─── RLS: same shape as every other per-user assistant table ────────────────

ALTER TABLE public.ai_dashboard_assistant_action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_dashboard_assistant_action_plans_select
  ON public.ai_dashboard_assistant_action_plans
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT ALL ON public.ai_dashboard_assistant_action_plans TO service_role;

-- ─── Retention: fold plan rows into the existing nightly sweep ──────────────
-- Mirrors the existing ai_dashboard_assistant_pending_actions clause in run_ai_data_retention
-- (20261316123050_ai_llm_hardening.sql) — resolved/expired plans older than 30 days. Plans are
-- never actively expired by a cron sweep, same as single pending actions: expiry is checked
-- lazily (expires_at vs now()) at claim time in dashboard-assistant-confirm.

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
  v_plans INTEGER;
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

  DELETE FROM public.ai_dashboard_assistant_action_plans
   WHERE status NOT IN ('proposed', 'approved', 'running')
     AND created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_plans = ROW_COUNT;

  RETURN jsonb_build_object(
    'responseCacheDeleted', v_cache,
    'toolCallsCleared', v_tool_calls,
    'pendingActionsDeleted', v_pending,
    'actionPlansDeleted', v_plans
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_ai_data_retention(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_ai_data_retention(INTEGER) TO service_role;
