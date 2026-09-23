ALTER TABLE public.voice_receptionist_start_attempts
  DROP CONSTRAINT IF EXISTS voice_receptionist_start_attempts_outcome_check;

ALTER TABLE public.voice_receptionist_start_attempts
  ADD CONSTRAINT voice_receptionist_start_attempts_outcome_check
  CHECK (outcome IN ('started', 'provider_failed', 'cap_denied', 'gate_denied'));
