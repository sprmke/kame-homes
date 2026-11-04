-- AI Dashboard Assistant — Phase 6 guardrails: new super-admin limit keys + kill switches.
-- docs/workflow/in-progress/agentic-ai-assistants.md, Phase 6.
-- Same three-table shape every other numeric AI limit already uses (ai_limit_profiles for the
-- profile tiers, ai_dashboard_assistant_org_settings for the org override layer, the global
-- defaults live in code as AI_LIMIT_CONSTANT_DEFAULTS) — see _shared/aiLimitResolver.ts.
-- Kill switches reuse the existing ai_dashboard_assistant_global_settings / org_settings
-- singleton+per-org pattern already proven by `ai_mode_enabled` (global-only kill switch added
-- in an earlier migration) rather than feature_availability_overrides, which has no org scoping
-- at all (`feature_key TEXT PRIMARY KEY`) and so cannot satisfy "global AND per-org".

-- ─── New numeric limit keys ──────────────────────────────────────────────────

ALTER TABLE public.ai_limit_profiles
  ADD COLUMN IF NOT EXISTS assistant_max_tool_rounds INTEGER,
  ADD COLUMN IF NOT EXISTS assistant_max_plan_steps INTEGER,
  ADD COLUMN IF NOT EXISTS guest_request_daily_limit INTEGER,
  ADD COLUMN IF NOT EXISTS assistant_turn_credit_ceiling NUMERIC(12, 3);

ALTER TABLE public.ai_limit_profiles
  ADD CONSTRAINT ai_limit_profiles_assistant_max_rounds_check
    CHECK (assistant_max_tool_rounds IS NULL OR (assistant_max_tool_rounds >= 1 AND assistant_max_tool_rounds <= 20)),
  ADD CONSTRAINT ai_limit_profiles_assistant_max_plan_steps_check
    CHECK (assistant_max_plan_steps IS NULL OR (assistant_max_plan_steps >= 1 AND assistant_max_plan_steps <= 30)),
  ADD CONSTRAINT ai_limit_profiles_guest_request_daily_check
    CHECK (guest_request_daily_limit IS NULL OR (guest_request_daily_limit >= 1 AND guest_request_daily_limit <= 20)),
  ADD CONSTRAINT ai_limit_profiles_turn_credit_ceiling_check
    CHECK (assistant_turn_credit_ceiling IS NULL OR assistant_turn_credit_ceiling > 0);

ALTER TABLE public.ai_dashboard_assistant_org_settings
  ADD COLUMN IF NOT EXISTS assistant_max_tool_rounds INTEGER,
  ADD COLUMN IF NOT EXISTS assistant_max_plan_steps INTEGER,
  ADD COLUMN IF NOT EXISTS guest_request_daily_limit INTEGER,
  ADD COLUMN IF NOT EXISTS assistant_turn_credit_ceiling NUMERIC(12, 3);

ALTER TABLE public.ai_dashboard_assistant_org_settings
  ADD CONSTRAINT ai_dashboard_assistant_org_settings_max_rounds_check
    CHECK (assistant_max_tool_rounds IS NULL OR (assistant_max_tool_rounds >= 1 AND assistant_max_tool_rounds <= 20)),
  ADD CONSTRAINT ai_dashboard_assistant_org_settings_max_plan_steps_check
    CHECK (assistant_max_plan_steps IS NULL OR (assistant_max_plan_steps >= 1 AND assistant_max_plan_steps <= 30)),
  ADD CONSTRAINT ai_dashboard_assistant_org_settings_guest_request_daily_check
    CHECK (guest_request_daily_limit IS NULL OR (guest_request_daily_limit >= 1 AND guest_request_daily_limit <= 20)),
  ADD CONSTRAINT ai_dashboard_assistant_org_settings_turn_credit_ceiling_check
    CHECK (assistant_turn_credit_ceiling IS NULL OR assistant_turn_credit_ceiling > 0);

COMMENT ON COLUMN public.ai_limit_profiles.assistant_max_tool_rounds IS
  'Max tool-calling rounds per dashboard-assistant turn. NULL falls through to AI_LIMIT_CONSTANT_DEFAULTS (8, matching the pre-Phase-6 hardcoded MAX_TOOL_ROUNDS).';
COMMENT ON COLUMN public.ai_limit_profiles.assistant_max_plan_steps IS
  'Max steps in a Phase 3 action plan. NULL falls through to AI_LIMIT_CONSTANT_DEFAULTS (10, matching the pre-Phase-6 hardcoded PLAN_STEP_CAP).';
COMMENT ON COLUMN public.ai_limit_profiles.guest_request_daily_limit IS
  'Max guest-write-tool calls (report_maintenance_issue, request_booking_inquiry, request_early_checkin_late_checkout) per guest per day. NULL falls through to AI_LIMIT_CONSTANT_DEFAULTS (3, matching the pre-Phase-6 hardcoded GUEST_REQUEST_DAILY_LIMIT).';
COMMENT ON COLUMN public.ai_limit_profiles.assistant_turn_credit_ceiling IS
  'Max AI credits one dashboard-assistant turn may consume before it stops cleanly with a partial answer. NULL falls through to AI_LIMIT_CONSTANT_DEFAULTS (100 — several multiples of a typical 8-round turn''s observed 5-24 credit cost).';

-- ─── Kill switches: agentic_mode, plan_approval, guest_actions ──────────────

ALTER TABLE public.ai_dashboard_assistant_global_settings
  ADD COLUMN IF NOT EXISTS agentic_mode_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS plan_approval_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS guest_actions_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.ai_dashboard_assistant_global_settings.agentic_mode_enabled IS
  'Platform-wide kill switch. Off caps a turn to a single tool-calling round (no multi-round agent loop) instead of disabling the assistant outright.';
COMMENT ON COLUMN public.ai_dashboard_assistant_global_settings.plan_approval_enabled IS
  'Platform-wide kill switch for the Phase 3 action-plan card. Off makes 2+ write proposals fall back to the pre-Phase-3 single-card-plus-held-back-notes behavior.';
COMMENT ON COLUMN public.ai_dashboard_assistant_global_settings.guest_actions_enabled IS
  'Platform-wide kill switch for guest-write tools (report_maintenance_issue, request_booking_inquiry, request_early_checkin_late_checkout). Off strips them from the guest receptionist tool list entirely.';

ALTER TABLE public.ai_dashboard_assistant_org_settings
  ADD COLUMN IF NOT EXISTS agentic_mode_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS plan_approval_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS guest_actions_enabled BOOLEAN;

COMMENT ON COLUMN public.ai_dashboard_assistant_org_settings.agentic_mode_enabled IS
  'Per-org override of the global agentic_mode kill switch. NULL inherits the global value.';
COMMENT ON COLUMN public.ai_dashboard_assistant_org_settings.plan_approval_enabled IS
  'Per-org override of the global plan_approval kill switch. NULL inherits the global value.';
COMMENT ON COLUMN public.ai_dashboard_assistant_org_settings.guest_actions_enabled IS
  'Per-org override of the global guest_actions kill switch. NULL inherits the global value.';
