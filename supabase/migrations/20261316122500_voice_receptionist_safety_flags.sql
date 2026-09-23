-- Post-session safety signals are derived from unverified browser captions.
-- Flags aid incident review; they never make the transcript authoritative.

ALTER TABLE public.voice_receptionist_sessions
  ADD COLUMN IF NOT EXISTS safety_flags TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.voice_receptionist_sessions.safety_flags IS
  'Non-PII safety categories derived from unverified client-reported captions.';
