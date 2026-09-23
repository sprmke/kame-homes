ALTER TABLE public.voice_receptionist_start_attempts
  ADD COLUMN IF NOT EXISTS reservation_latency_ms INT,
  ADD COLUMN IF NOT EXISTS mint_latency_ms INT;

ALTER TABLE public.voice_receptionist_start_attempts
  ADD CONSTRAINT voice_receptionist_start_attempts_reservation_latency_check
    CHECK (reservation_latency_ms IS NULL OR reservation_latency_ms >= 0),
  ADD CONSTRAINT voice_receptionist_start_attempts_mint_latency_check
    CHECK (mint_latency_ms IS NULL OR mint_latency_ms >= 0);
