ALTER TABLE public.ai_platform_global_settings
  ADD COLUMN IF NOT EXISTS voice_receptionist_health_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS voice_receptionist_health_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voice_receptionist_health_failure_code TEXT,
  ADD COLUMN IF NOT EXISTS voice_receptionist_health_token_mint_ms INT,
  ADD COLUMN IF NOT EXISTS voice_receptionist_health_setup_ms INT,
  ADD COLUMN IF NOT EXISTS voice_receptionist_health_model TEXT,
  ADD COLUMN IF NOT EXISTS voice_receptionist_health_protocol_version TEXT;

ALTER TABLE public.ai_platform_global_settings
  ADD CONSTRAINT ai_platform_global_voice_health_status_check
  CHECK (voice_receptionist_health_status IN ('unknown', 'healthy', 'unhealthy'));
