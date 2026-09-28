ALTER TABLE public.ai_platform_global_settings
  ADD COLUMN IF NOT EXISTS voice_receptionist_rollout_percentage INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voice_receptionist_rollout_property_ids UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE public.ai_platform_global_settings
  ADD CONSTRAINT ai_platform_global_voice_rollout_percentage_check
  CHECK (voice_receptionist_rollout_percentage BETWEEN 0 AND 100);
