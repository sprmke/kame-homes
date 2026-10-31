-- platform_settings — singleton row of platform-wide operational knobs.
-- GET/PUT via the `platform-settings` edge function (serveSuperAdmin). Consumers
-- (signup gate, maintenance banner, default plan, public rate limit) read it via
-- that function; there is no RLS read path.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_plan_code TEXT,
  signups_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message TEXT,
  support_email TEXT,
  legal_terms_url TEXT,
  legal_privacy_url TEXT,
  public_rate_limit_per_min INT NOT NULL DEFAULT 60 CHECK (public_rate_limit_per_min > 0),
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.platform_settings IS
  'Singleton platform operational config — signups on/off, maintenance mode, default plan, support/legal links, public rate limit.';

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.platform_settings TO service_role;
-- No RLS read policy: access is edge-function only (`platform-settings`, serveSuperAdmin).
