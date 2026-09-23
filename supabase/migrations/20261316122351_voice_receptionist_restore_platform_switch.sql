-- Restore the AI platform switch saved immediately before the legacy voice backfill.

UPDATE public.ai_platform_global_settings
SET enabled = voice_receptionist_pre_backfill_platform_enabled
WHERE id = 1
  AND voice_receptionist_pre_backfill_platform_enabled IS NOT NULL;

ALTER TABLE public.ai_platform_global_settings
  DROP COLUMN IF EXISTS voice_receptionist_pre_backfill_platform_enabled;
