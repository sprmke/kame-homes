-- Durable, non-transcript start telemetry. Failed provisioning does not consume session caps.

CREATE TABLE IF NOT EXISTS public.voice_receptionist_start_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  guest_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (
    outcome IN ('started', 'provider_failed', 'cap_denied', 'gate_denied')
  ),
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_receptionist_start_attempts_property_created
  ON public.voice_receptionist_start_attempts (property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_receptionist_start_attempts_guest_created
  ON public.voice_receptionist_start_attempts (guest_user_id, created_at DESC);

ALTER TABLE public.voice_receptionist_start_attempts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.voice_receptionist_start_attempts TO service_role;
