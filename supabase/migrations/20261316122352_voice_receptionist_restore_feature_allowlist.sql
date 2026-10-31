-- Restore the platform feature allowlist saved before the legacy voice backfill.

UPDATE public.ai_platform_global_settings
SET allowed_features = voice_receptionist_pre_backfill_allowed_features
WHERE id = 1
  AND voice_receptionist_pre_backfill_allowed_features IS NOT NULL;

ALTER TABLE public.ai_platform_global_settings
  DROP COLUMN IF EXISTS voice_receptionist_pre_backfill_allowed_features;
