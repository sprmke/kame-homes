-- Platform-wide AI usage metering, org quotas, and audit events.
-- Production billing uses a single paid Gemini project; this layer caps spend per org.

CREATE TABLE IF NOT EXISTS public.ai_platform_global_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  enforce_quotas BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.ai_platform_global_settings (id, enabled, enforce_quotas)
VALUES (1, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.ai_platform_global_settings IS
  'Singleton platform kill switch + quota enforcement for shared Gemini/Groq AI features.';

CREATE TABLE IF NOT EXISTS public.ai_platform_org_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  daily_call_limit INT NOT NULL DEFAULT 200,
  monthly_call_limit INT NOT NULL DEFAULT 5000,
  plan_tier TEXT NOT NULL DEFAULT 'included',
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_platform_org_settings_daily_limit_check CHECK (daily_call_limit > 0),
  CONSTRAINT ai_platform_org_settings_monthly_limit_check CHECK (monthly_call_limit > 0)
);

COMMENT ON TABLE public.ai_platform_org_settings IS
  'Per-org AI allowance (calls/day + calls/month). Missing row = platform defaults + enabled.';

CREATE TABLE IF NOT EXISTS public.ai_platform_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  call_count INT NOT NULL DEFAULT 0,
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  UNIQUE (organization_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_platform_usage_daily_org_date
  ON public.ai_platform_usage_daily (organization_id, usage_date DESC);

COMMENT ON TABLE public.ai_platform_usage_daily IS
  'Rolling daily counters for org AI usage — backs quota checks and admin visibility.';

CREATE TABLE IF NOT EXISTS public.ai_platform_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties (id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  estimated_cost_usd NUMERIC(12, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_platform_usage_events_org_created
  ON public.ai_platform_usage_events (organization_id, created_at DESC);

COMMENT ON TABLE public.ai_platform_usage_events IS
  'Append-only AI call audit log (feature, model, token counts, estimated USD).';

DROP TRIGGER IF EXISTS update_ai_platform_global_settings_updated_at ON public.ai_platform_global_settings;
CREATE TRIGGER update_ai_platform_global_settings_updated_at
  BEFORE UPDATE ON public.ai_platform_global_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_platform_org_settings_updated_at ON public.ai_platform_org_settings;
CREATE TRIGGER update_ai_platform_org_settings_updated_at
  BEFORE UPDATE ON public.ai_platform_org_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.ai_platform_global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_platform_org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_platform_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_platform_usage_events ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ai_platform_global_settings TO service_role;
GRANT ALL ON public.ai_platform_org_settings TO service_role;
GRANT ALL ON public.ai_platform_usage_daily TO service_role;
GRANT ALL ON public.ai_platform_usage_events TO service_role;

-- Atomic daily counter bump (avoids read-modify-write races under concurrent AI calls).
CREATE OR REPLACE FUNCTION public.increment_ai_platform_usage_daily(
  p_organization_id UUID,
  p_usage_date DATE,
  p_call_count INT,
  p_input_tokens BIGINT,
  p_output_tokens BIGINT,
  p_estimated_cost_usd NUMERIC
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
    estimated_cost_usd
  )
  VALUES (
    p_organization_id,
    p_usage_date,
    p_call_count,
    p_input_tokens,
    p_output_tokens,
    p_estimated_cost_usd
  )
  ON CONFLICT (organization_id, usage_date) DO UPDATE SET
    call_count = ai_platform_usage_daily.call_count + EXCLUDED.call_count,
    input_tokens = ai_platform_usage_daily.input_tokens + EXCLUDED.input_tokens,
    output_tokens = ai_platform_usage_daily.output_tokens + EXCLUDED.output_tokens,
    estimated_cost_usd = ai_platform_usage_daily.estimated_cost_usd + EXCLUDED.estimated_cost_usd;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_ai_platform_usage_daily(UUID, DATE, INT, BIGINT, BIGINT, NUMERIC) TO service_role;
