-- AI Platform Hardening — unified kill switch, per-feature allowlist, per-property quotas, and response cache.
-- This migration hardens the foundation before the AI Dashboard Assistant and broader AI roadmap.

-- ============================================================================
-- 1. Global settings: feature allowlist, default quotas, safer default state
-- ============================================================================
-- Fresh `db reset` runs this file (20260814) before ai_platform_usage (20261009).
-- Bootstrap the singleton table here so ALTER/INSERT below succeed; later migration no-ops via IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.ai_platform_global_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  enforce_quotas BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_features TEXT[] NOT NULL DEFAULT '{}',
  default_daily_call_limit INT NOT NULL DEFAULT 200,
  default_monthly_call_limit INT NOT NULL DEFAULT 5000,
  default_daily_cost_usd_limit NUMERIC(12, 6) NOT NULL DEFAULT 10,
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_platform_global_settings
  ADD COLUMN IF NOT EXISTS allowed_features TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS default_daily_call_limit INT NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS default_monthly_call_limit INT NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS default_daily_cost_usd_limit NUMERIC(12, 6) NOT NULL DEFAULT 10,
  ALTER COLUMN enabled SET DEFAULT FALSE;

UPDATE public.ai_platform_global_settings
  SET allowed_features = COALESCE(allowed_features, '{}')
  WHERE id = 1;

INSERT INTO public.ai_platform_global_settings (
  id,
  enabled,
  enforce_quotas,
  allowed_features,
  default_daily_call_limit,
  default_monthly_call_limit,
  default_daily_cost_usd_limit
)
VALUES (1, FALSE, TRUE, '{}', 200, 5000, 10)
ON CONFLICT (id) DO NOTHING;

-- Migrate legacy voice receptionist global switch into the unified platform switch.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'voice_receptionist_global_settings'
  ) THEN
    UPDATE public.ai_platform_global_settings AS tgt
    SET
      enabled = COALESCE(src.enabled, FALSE),
      allowed_features = (
        SELECT array_agg(DISTINCT f)
        FROM unnest(array_append(COALESCE(tgt.allowed_features, '{}'), 'voice_receptionist')) AS f
      )
    FROM public.voice_receptionist_global_settings AS src
    WHERE tgt.id = 1 AND src.id = 1;
  END IF;
END $$;


COMMENT ON COLUMN public.ai_platform_global_settings.allowed_features IS
  'Feature ids allowed platform-wide. Empty array = all existing AI_FEATURES allowed for backward compatibility during transition.';
COMMENT ON COLUMN public.ai_platform_global_settings.default_daily_call_limit IS
  'Default daily AI call cap for organizations that have no org-level override.';
COMMENT ON COLUMN public.ai_platform_global_settings.default_monthly_call_limit IS
  'Default monthly AI call cap for organizations that have no org-level override.';
COMMENT ON COLUMN public.ai_platform_global_settings.default_daily_cost_usd_limit IS
  'Default daily estimated-cost USD cap for organizations that have no org-level override.';

-- ============================================================================
-- 2. Per-property daily usage counters
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_platform_property_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  call_count INT NOT NULL DEFAULT 0,
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  UNIQUE (property_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_platform_property_usage_daily_org_date
  ON public.ai_platform_property_usage_daily (organization_id, usage_date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_platform_property_usage_daily_prop_date
  ON public.ai_platform_property_usage_daily (property_id, usage_date DESC);

COMMENT ON TABLE public.ai_platform_property_usage_daily IS
  'Rolling daily counters for AI usage per property — backs property-level quota checks and cost visibility.';

-- ============================================================================
-- 3. Per-property AI settings (opt-in + override quotas)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_platform_property_settings (
  property_id UUID PRIMARY KEY REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  daily_call_limit INT,
  monthly_call_limit INT,
  daily_cost_usd_limit NUMERIC(12, 6),
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_platform_property_settings_daily_limit_check CHECK (daily_call_limit IS NULL OR daily_call_limit > 0),
  CONSTRAINT ai_platform_property_settings_monthly_limit_check CHECK (monthly_call_limit IS NULL OR monthly_call_limit > 0)
);

CREATE INDEX IF NOT EXISTS idx_ai_platform_property_settings_org
  ON public.ai_platform_property_settings (organization_id);

COMMENT ON TABLE public.ai_platform_property_settings IS
  'Per-property AI overrides. NULL limits = inherit from organization settings.';

-- ============================================================================
-- 4. Deterministic AI response cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_platform_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  response_text TEXT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  estimated_cost_usd NUMERIC(12, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  UNIQUE (feature, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_ai_platform_response_cache_expires
  ON public.ai_platform_response_cache (expires_at);

COMMENT ON TABLE public.ai_platform_response_cache IS
  'Short-term deterministic cache for AI responses keyed by feature + prompt fingerprint.';

-- ============================================================================
-- 5. Atomic increment functions
-- ============================================================================

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

CREATE OR REPLACE FUNCTION public.increment_ai_platform_property_usage_daily(
  p_organization_id UUID,
  p_property_id UUID,
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
  INSERT INTO public.ai_platform_property_usage_daily (
    organization_id,
    property_id,
    usage_date,
    call_count,
    input_tokens,
    output_tokens,
    estimated_cost_usd
  )
  VALUES (
    p_organization_id,
    p_property_id,
    p_usage_date,
    p_call_count,
    p_input_tokens,
    p_output_tokens,
    p_estimated_cost_usd
  )
  ON CONFLICT (property_id, usage_date) DO UPDATE SET
    call_count = ai_platform_property_usage_daily.call_count + EXCLUDED.call_count,
    input_tokens = ai_platform_property_usage_daily.input_tokens + EXCLUDED.input_tokens,
    output_tokens = ai_platform_property_usage_daily.output_tokens + EXCLUDED.output_tokens,
    estimated_cost_usd = ai_platform_property_usage_daily.estimated_cost_usd + EXCLUDED.estimated_cost_usd;
END;
$$;

-- ============================================================================
-- 6. RLS + service_role grants
-- ============================================================================

ALTER TABLE public.ai_platform_property_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_platform_property_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_platform_response_cache ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ai_platform_property_usage_daily TO service_role;
GRANT ALL ON public.ai_platform_property_settings TO service_role;
GRANT ALL ON public.ai_platform_response_cache TO service_role;

GRANT EXECUTE ON FUNCTION public.increment_ai_platform_property_usage_daily(
  UUID, UUID, DATE, INT, BIGINT, BIGINT, NUMERIC
) TO service_role;

-- ============================================================================
-- 7. Voice receptionist global settings migrated to platform-wide switch
-- The old table is left in place for now and will be removed in a later cleanup migration.
-- ============================================================================

DO $$
DECLARE
  v_old_enabled BOOLEAN;
BEGIN
  IF to_regclass('public.voice_receptionist_global_settings') IS NULL THEN
    RETURN;
  END IF;

  SELECT enabled INTO v_old_enabled
  FROM public.voice_receptionist_global_settings
  WHERE id = 1;

  IF v_old_enabled IS TRUE THEN
    UPDATE public.ai_platform_global_settings
      SET enabled = TRUE,
          allowed_features = array_append(
            COALESCE(allowed_features, '{}'),
            'voice_receptionist'
          )
      WHERE id = 1;
  END IF;
END $$;

-- ============================================================================
-- 8. Triggers
-- ============================================================================

CREATE OR REPLACE TRIGGER update_ai_platform_property_settings_updated_at
  BEFORE UPDATE ON public.ai_platform_property_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
