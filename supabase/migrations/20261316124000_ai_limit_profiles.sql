-- AI limit profiles — super-admin-owned AI limits (plan: docs/workflow/in-progress/ai-settings-super-admin-ownership.md).
--
-- Hosts keep only an on/off toggle per AI feature. Every numeric limit (calls, cost, credits,
-- assistant messages/writes, voice sessions, media generation caps) is resolved from:
--   per-tenant override → property profile → development profile → org profile
--   → plan-tier profile → plan credit allowance → default profile → global settings / constants
-- See supabase/functions/_shared/aiLimitResolver.ts. Behavior is byte-identical at migration time:
-- values equal to the old defaults become NULL (inherit), anything else stays as a stamped override.

-- ─── 1. Profiles ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_limit_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  daily_call_limit INT,
  monthly_call_limit INT,
  daily_cost_usd_limit NUMERIC(12, 6),
  daily_credit_limit NUMERIC(12, 3),
  monthly_credit_limit NUMERIC(12, 3),
  assistant_daily_message_limit INT,
  assistant_monthly_message_limit INT,
  assistant_daily_write_action_limit INT,
  voice_max_session_seconds INT,
  voice_max_sessions_per_guest_per_day INT,
  voice_max_concurrent_sessions INT,
  image_monthly_credit_cap INT,
  video_monthly_credit_cap INT,
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_limit_profiles_code_check CHECK (code ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  CONSTRAINT ai_limit_profiles_daily_call_check CHECK (daily_call_limit IS NULL OR daily_call_limit > 0),
  CONSTRAINT ai_limit_profiles_monthly_call_check CHECK (monthly_call_limit IS NULL OR monthly_call_limit > 0),
  CONSTRAINT ai_limit_profiles_daily_cost_check CHECK (daily_cost_usd_limit IS NULL OR daily_cost_usd_limit > 0),
  CONSTRAINT ai_limit_profiles_daily_credit_check CHECK (daily_credit_limit IS NULL OR daily_credit_limit >= 0),
  CONSTRAINT ai_limit_profiles_monthly_credit_check CHECK (monthly_credit_limit IS NULL OR monthly_credit_limit >= 0),
  CONSTRAINT ai_limit_profiles_assistant_daily_check CHECK (
    assistant_daily_message_limit IS NULL OR assistant_daily_message_limit > 0
  ),
  CONSTRAINT ai_limit_profiles_assistant_monthly_check CHECK (
    assistant_monthly_message_limit IS NULL OR assistant_monthly_message_limit > 0
  ),
  CONSTRAINT ai_limit_profiles_assistant_write_check CHECK (
    assistant_daily_write_action_limit IS NULL OR assistant_daily_write_action_limit > 0
  ),
  CONSTRAINT ai_limit_profiles_voice_seconds_check CHECK (
    voice_max_session_seconds IS NULL OR voice_max_session_seconds BETWEEN 60 AND 3600
  ),
  CONSTRAINT ai_limit_profiles_voice_daily_check CHECK (
    voice_max_sessions_per_guest_per_day IS NULL OR voice_max_sessions_per_guest_per_day BETWEEN 1 AND 999
  ),
  CONSTRAINT ai_limit_profiles_voice_concurrent_check CHECK (
    voice_max_concurrent_sessions IS NULL OR voice_max_concurrent_sessions BETWEEN 1 AND 50
  ),
  CONSTRAINT ai_limit_profiles_image_cap_check CHECK (image_monthly_credit_cap IS NULL OR image_monthly_credit_cap > 0),
  CONSTRAINT ai_limit_profiles_video_cap_check CHECK (video_monthly_credit_cap IS NULL OR video_monthly_credit_cap > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_limit_profiles_one_default_idx
  ON public.ai_limit_profiles (is_default)
  WHERE is_default = TRUE;

COMMENT ON TABLE public.ai_limit_profiles IS
  'Named, reusable AI limit sets owned by super admins. NULL column = inherit the next layer (see aiLimitResolver.ts).';

-- ─── 2. Assignments ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_limit_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  scope_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.ai_limit_profiles (id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  CONSTRAINT ai_limit_assignments_scope_check CHECK (scope IN ('organization', 'property', 'development')),
  CONSTRAINT ai_limit_assignments_unique_scope UNIQUE (scope, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_limit_assignments_profile
  ON public.ai_limit_assignments (profile_id);

COMMENT ON TABLE public.ai_limit_assignments IS
  'Binds a profile to one organization, property or development. scope_id is polymorphic (no FK); dangling rows are inert.';

DROP TRIGGER IF EXISTS update_ai_limit_profiles_updated_at ON public.ai_limit_profiles;
CREATE TRIGGER update_ai_limit_profiles_updated_at
  BEFORE UPDATE ON public.ai_limit_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.ai_limit_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_limit_assignments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ai_limit_profiles TO service_role;
GRANT ALL ON public.ai_limit_assignments TO service_role;

-- ─── 3. Seed: default profile (today's hard-coded assistant/voice values) + one per plan ─

INSERT INTO public.ai_limit_profiles (
  code, name, description, is_default,
  assistant_daily_message_limit, assistant_monthly_message_limit, assistant_daily_write_action_limit,
  voice_max_session_seconds, voice_max_sessions_per_guest_per_day, voice_max_concurrent_sessions
)
VALUES (
  'default', 'Platform default',
  'Fallback for every organization without a more specific profile. Call, cost and credit limits inherit platform defaults when blank.',
  TRUE, 50, 1000, 20, 300, 3, 3
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ai_limit_profiles (code, name, description)
SELECT p.code, p.name, 'Plan-tier profile. Blank limits inherit the platform default profile and the plan credit allowance.'
FROM public.pricing_plans p
WHERE p.code ~ '^[a-z0-9][a-z0-9_-]{0,39}$'
ON CONFLICT (code) DO NOTHING;

-- ─── 4. Plan → profile binding ───────────────────────────────────────────────

ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS ai_limit_profile_id UUID REFERENCES public.ai_limit_profiles (id) ON DELETE SET NULL;

UPDATE public.pricing_plans AS plan
SET ai_limit_profile_id = profile.id
FROM public.ai_limit_profiles AS profile
WHERE profile.code = plan.code
  AND profile.is_default = FALSE
  AND plan.ai_limit_profile_id IS NULL;

COMMENT ON COLUMN public.pricing_plans.ai_limit_profile_id IS
  'AI limit profile applied to every org on this plan. NULL = platform default profile.';

-- ─── 5. Org settings: limit columns become overrides ─────────────────────────

ALTER TABLE public.ai_platform_org_settings
  ALTER COLUMN daily_call_limit DROP NOT NULL,
  ALTER COLUMN daily_call_limit DROP DEFAULT,
  ALTER COLUMN monthly_call_limit DROP NOT NULL,
  ALTER COLUMN monthly_call_limit DROP DEFAULT,
  ADD COLUMN IF NOT EXISTS plan_credit_allowance NUMERIC(12, 3),
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS overridden_by UUID REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.ai_platform_org_settings.plan_credit_allowance IS
  'Monthly credit allowance synced from the org plan (syncAiCreditsFromPlan). Not an override.';
COMMENT ON COLUMN public.ai_platform_org_settings.override_reason IS
  'Why a non-NULL limit column on this row exists. Set by super admin (or the migration for legacy host-set values).';

-- monthly_credit_limit was only ever written by the plan sync: move it to plan_credit_allowance.
UPDATE public.ai_platform_org_settings
SET plan_credit_allowance = monthly_credit_limit,
    monthly_credit_limit = NULL
WHERE monthly_credit_limit IS NOT NULL;

-- Values equal to the platform defaults were never real overrides: inherit instead.
UPDATE public.ai_platform_org_settings AS o
SET daily_call_limit = NULL
FROM public.ai_platform_global_settings AS g
WHERE g.id = 1 AND o.daily_call_limit = g.default_daily_call_limit;

UPDATE public.ai_platform_org_settings AS o
SET monthly_call_limit = NULL
FROM public.ai_platform_global_settings AS g
WHERE g.id = 1 AND o.monthly_call_limit = g.default_monthly_call_limit;

UPDATE public.ai_platform_org_settings AS o
SET daily_cost_usd_limit = NULL
FROM public.ai_platform_global_settings AS g
WHERE g.id = 1 AND o.daily_cost_usd_limit = g.default_daily_cost_usd_limit;

UPDATE public.ai_platform_org_settings
SET override_reason = 'Migrated from host-set limit'
WHERE override_reason IS NULL
  AND (
    daily_call_limit IS NOT NULL
    OR monthly_call_limit IS NOT NULL
    OR daily_cost_usd_limit IS NOT NULL
    OR daily_credit_limit IS NOT NULL
  );

-- ─── 6. Property settings: stamp legacy overrides ────────────────────────────

ALTER TABLE public.ai_platform_property_settings
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS overridden_by UUID REFERENCES auth.users (id) ON DELETE SET NULL;

UPDATE public.ai_platform_property_settings
SET override_reason = 'Migrated from host-set limit'
WHERE override_reason IS NULL
  AND (
    daily_call_limit IS NOT NULL
    OR monthly_call_limit IS NOT NULL
    OR daily_cost_usd_limit IS NOT NULL
    OR daily_credit_limit IS NOT NULL
    OR monthly_credit_limit IS NOT NULL
    OR jsonb_exists(feature_configs -> 'marketing_image_generate', 'monthly_credit_cap')
    OR jsonb_exists(feature_configs -> 'marketing_video_generate', 'monthly_credit_cap')
    OR jsonb_exists_any(
      feature_configs -> 'voice_receptionist',
      ARRAY['max_session_seconds', 'max_sessions_per_guest_per_day', 'max_concurrent_sessions']
    )
  );

-- ─── 7. Dashboard assistant org settings: limits become overrides ────────────

ALTER TABLE public.ai_dashboard_assistant_org_settings
  ALTER COLUMN daily_message_limit DROP NOT NULL,
  ALTER COLUMN daily_message_limit DROP DEFAULT,
  ALTER COLUMN monthly_message_limit DROP NOT NULL,
  ALTER COLUMN monthly_message_limit DROP DEFAULT,
  ALTER COLUMN daily_write_action_limit DROP NOT NULL,
  ALTER COLUMN daily_write_action_limit DROP DEFAULT,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS overridden_by UUID REFERENCES auth.users (id) ON DELETE SET NULL;

UPDATE public.ai_dashboard_assistant_org_settings SET daily_message_limit = NULL WHERE daily_message_limit = 50;
UPDATE public.ai_dashboard_assistant_org_settings SET monthly_message_limit = NULL WHERE monthly_message_limit = 1000;
UPDATE public.ai_dashboard_assistant_org_settings SET daily_write_action_limit = NULL WHERE daily_write_action_limit = 20;

UPDATE public.ai_dashboard_assistant_org_settings
SET override_reason = 'Migrated from host-set limit'
WHERE override_reason IS NULL
  AND (
    daily_message_limit IS NOT NULL
    OR monthly_message_limit IS NOT NULL
    OR daily_write_action_limit IS NOT NULL
  );
