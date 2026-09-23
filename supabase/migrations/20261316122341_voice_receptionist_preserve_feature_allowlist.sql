-- Preserve the platform feature allowlist across the legacy voice backfill.
-- An empty allowlist means all features, so appending only voice would narrow it incorrectly.

ALTER TABLE public.ai_platform_global_settings
  ADD COLUMN IF NOT EXISTS voice_receptionist_pre_backfill_allowed_features TEXT[];

UPDATE public.ai_platform_global_settings
SET voice_receptionist_pre_backfill_allowed_features = allowed_features
WHERE id = 1;
