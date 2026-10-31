-- Step-up OTP challenges for sensitive Super Admin (/admin/*) actions.
-- Mirrors settings_verification_challenges but platform-scoped (no org/property FK):
-- the OTP is emailed to the acting super admin's own login email and, once verified,
-- unlocks every gated super-admin mutation for a short "sudo" window.

CREATE TABLE IF NOT EXISTS public.super_admin_verification_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL,
  requested_email TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'super_admin_step_up',
  code_hash TEXT NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_super_admin_verification_challenges_rate
  ON public.super_admin_verification_challenges (requested_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_admin_verification_challenges_open
  ON public.super_admin_verification_challenges (id)
  WHERE consumed_at IS NULL;

ALTER TABLE public.super_admin_verification_challenges ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.super_admin_verification_challenges TO service_role;
