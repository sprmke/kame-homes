-- AI Credit Foundation — Phase 1 of the AI usage metering plan
-- (docs/workflow/planned/ai-usage-metering-credits-foundation.md).
--
-- Additive, non-breaking: adds per-user attribution and a derived "credits" shadow
-- ledger on top of the existing $-cost metering (ai_platform_*). No enforcement change —
-- credits are recorded for visibility only. Also creates the (inert until Phase 3) org
-- credit wallet + ledger tables that a future paid top-up phase will draw down.

-- ============================================================================
-- 1. Attribution + credits on the existing usage event/rollup tables
-- ============================================================================

ALTER TABLE public.ai_platform_usage_events
  ADD COLUMN IF NOT EXISTS actor_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_type TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS cost_basis TEXT NOT NULL DEFAULT 'tokens',
  ADD COLUMN IF NOT EXISTS credits_consumed NUMERIC(12, 3),
  ADD CONSTRAINT ai_platform_usage_events_actor_type_check
    CHECK (actor_type IS NULL OR actor_type IN ('staff', 'guest', 'system')),
  ADD CONSTRAINT ai_platform_usage_events_cost_basis_check
    CHECK (cost_basis IN ('tokens', 'duration'));

COMMENT ON COLUMN public.ai_platform_usage_events.actor_user_id IS
  'Who triggered this call (staff/guest auth.users id), when known. Attribution only — not a quota axis (org/property remain the only enforcement axes).';
COMMENT ON COLUMN public.ai_platform_usage_events.actor_type IS
  'staff = admin/org/property member action; guest = authenticated guest portal action; system = automated (cron, webhook, auto-reply).';
COMMENT ON COLUMN public.ai_platform_usage_events.cost_basis IS
  'tokens = estimated via aiModelRouter input/output rates; duration = per-minute estimate (voice_receptionist only).';
COMMENT ON COLUMN public.ai_platform_usage_events.credits_consumed IS
  'Derived from estimated_cost_usd via ai_platform_global_settings.credit_unit_usd. 0 on cache hits. NULL for events recorded before this column existed.';

ALTER TABLE public.ai_platform_usage_daily
  ADD COLUMN IF NOT EXISTS credits_consumed NUMERIC(12, 3) NOT NULL DEFAULT 0;

ALTER TABLE public.ai_platform_property_usage_daily
  ADD COLUMN IF NOT EXISTS credits_consumed NUMERIC(12, 3) NOT NULL DEFAULT 0;

ALTER TABLE public.ai_dashboard_assistant_usage_daily
  ADD COLUMN IF NOT EXISTS credits_consumed NUMERIC(12, 3) NOT NULL DEFAULT 0;

-- ============================================================================
-- 2. Platform-wide credit conversion settings
-- ============================================================================

ALTER TABLE public.ai_platform_global_settings
  ADD COLUMN IF NOT EXISTS credit_unit_usd NUMERIC(12, 6) NOT NULL DEFAULT 0.001,
  ADD COLUMN IF NOT EXISTS voice_receptionist_cost_per_minute_usd NUMERIC(12, 6) NOT NULL DEFAULT 0.023;

COMMENT ON COLUMN public.ai_platform_global_settings.credit_unit_usd IS
  'USD value of 1 credit. credits_consumed = ceil(estimated_cost_usd / credit_unit_usd), min 1 per non-cached call. Working default only — sets gross margin on every paid tier, must be confirmed by pricing owner before Phase 3 enforcement ships (see plan doc Open Decisions).';
COMMENT ON COLUMN public.ai_platform_global_settings.voice_receptionist_cost_per_minute_usd IS
  'Configurable replacement for the previously hardcoded per-minute Gemini Live cost estimate used by voice_receptionist session billing.';

-- ============================================================================
-- 3. Org credit wallet + ledger (inert until Phase 3 enforcement wires them up)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_platform_org_credit_wallet (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  balance_credits NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (balance_credits >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.ai_platform_org_credit_wallet IS
  'Purchased top-up credit balance per org (Level 5 "extra AI token" SKU). Created empty for every org — inert until Phase 3 enforcement + Phase 4 payment wiring.';

CREATE TABLE IF NOT EXISTS public.ai_platform_org_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  credits_delta NUMERIC(12, 3) NOT NULL,
  related_usage_event_id UUID REFERENCES public.ai_platform_usage_events (id) ON DELETE SET NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_platform_org_credit_ledger_entry_type_check
    CHECK (entry_type IN ('usage_debit', 'purchase_credit', 'manual_adjustment'))
);

CREATE INDEX IF NOT EXISTS idx_ai_platform_org_credit_ledger_org_created
  ON public.ai_platform_org_credit_ledger (organization_id, created_at DESC);

COMMENT ON TABLE public.ai_platform_org_credit_ledger IS
  'Append-only credit wallet audit log (usage_debit / purchase_credit / manual_adjustment). Mirrors ai_platform_usage_events'' append-only convention.';

DROP TRIGGER IF EXISTS update_ai_platform_org_credit_wallet_updated_at ON public.ai_platform_org_credit_wallet;
CREATE TRIGGER update_ai_platform_org_credit_wallet_updated_at
  BEFORE UPDATE ON public.ai_platform_org_credit_wallet
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.ai_platform_org_credit_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_platform_org_credit_ledger ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ai_platform_org_credit_wallet TO service_role;
GRANT ALL ON public.ai_platform_org_credit_ledger TO service_role;

-- ============================================================================
-- 4. Atomic increment functions — re-declared with p_credits_consumed
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_ai_platform_usage_daily(
  p_organization_id UUID,
  p_usage_date DATE,
  p_call_count INT,
  p_input_tokens BIGINT,
  p_output_tokens BIGINT,
  p_estimated_cost_usd NUMERIC,
  p_credits_consumed NUMERIC DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_platform_usage_daily (
    organization_id,
    usage_date,
    call_count,
    input_tokens,
    output_tokens,
    estimated_cost_usd,
    credits_consumed
  )
  VALUES (
    p_organization_id,
    p_usage_date,
    p_call_count,
    p_input_tokens,
    p_output_tokens,
    p_estimated_cost_usd,
    p_credits_consumed
  )
  ON CONFLICT (organization_id, usage_date) DO UPDATE SET
    call_count = ai_platform_usage_daily.call_count + EXCLUDED.call_count,
    input_tokens = ai_platform_usage_daily.input_tokens + EXCLUDED.input_tokens,
    output_tokens = ai_platform_usage_daily.output_tokens + EXCLUDED.output_tokens,
    estimated_cost_usd = ai_platform_usage_daily.estimated_cost_usd + EXCLUDED.estimated_cost_usd,
    credits_consumed = ai_platform_usage_daily.credits_consumed + EXCLUDED.credits_consumed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_ai_platform_usage_daily(UUID, DATE, INT, BIGINT, BIGINT, NUMERIC, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION public.increment_ai_platform_property_usage_daily(
  p_organization_id UUID,
  p_property_id UUID,
  p_usage_date DATE,
  p_call_count INT,
  p_input_tokens BIGINT,
  p_output_tokens BIGINT,
  p_estimated_cost_usd NUMERIC,
  p_credits_consumed NUMERIC DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_platform_property_usage_daily (
    organization_id,
    property_id,
    usage_date,
    call_count,
    input_tokens,
    output_tokens,
    estimated_cost_usd,
    credits_consumed
  )
  VALUES (
    p_organization_id,
    p_property_id,
    p_usage_date,
    p_call_count,
    p_input_tokens,
    p_output_tokens,
    p_estimated_cost_usd,
    p_credits_consumed
  )
  ON CONFLICT (property_id, usage_date) DO UPDATE SET
    call_count = ai_platform_property_usage_daily.call_count + EXCLUDED.call_count,
    input_tokens = ai_platform_property_usage_daily.input_tokens + EXCLUDED.input_tokens,
    output_tokens = ai_platform_property_usage_daily.output_tokens + EXCLUDED.output_tokens,
    estimated_cost_usd = ai_platform_property_usage_daily.estimated_cost_usd + EXCLUDED.estimated_cost_usd,
    credits_consumed = ai_platform_property_usage_daily.credits_consumed + EXCLUDED.credits_consumed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_ai_platform_property_usage_daily(UUID, UUID, DATE, INT, BIGINT, BIGINT, NUMERIC, NUMERIC) TO service_role;
