-- Preserve the AI platform switch across the legacy voice-settings backfill.
-- A legacy voice opt-in must never re-enable the whole AI platform.

ALTER TABLE public.ai_platform_global_settings
  ADD COLUMN IF NOT EXISTS voice_receptionist_pre_backfill_platform_enabled BOOLEAN;

UPDATE public.ai_platform_global_settings
SET voice_receptionist_pre_backfill_platform_enabled = enabled
WHERE id = 1;
