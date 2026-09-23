ALTER TABLE public.voice_receptionist_sessions
  ADD COLUMN IF NOT EXISTS handoff_at TIMESTAMPTZ;
