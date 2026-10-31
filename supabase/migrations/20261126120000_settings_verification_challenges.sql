-- OTP challenges for sensitive operator settings saves (payment settings v1).

CREATE TABLE IF NOT EXISTS public.settings_verification_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  parking_id UUID REFERENCES public.parkings(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  patch_fingerprint TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  requested_by UUID NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settings_verification_one_listing CHECK (
    (property_id IS NOT NULL AND parking_id IS NULL)
    OR (property_id IS NULL AND parking_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_settings_verification_challenges_rate
  ON public.settings_verification_challenges (requested_by, organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_settings_verification_challenges_open
  ON public.settings_verification_challenges (id)
  WHERE consumed_at IS NULL;

ALTER TABLE public.settings_verification_challenges ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.settings_verification_challenges TO service_role;
