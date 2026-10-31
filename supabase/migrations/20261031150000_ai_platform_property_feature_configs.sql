-- Voice receptionist (and future per-feature knobs) live in ai_platform_property_settings.feature_configs.
-- Code moved from voice_receptionist_settings; column was missing from the table.

ALTER TABLE public.ai_platform_property_settings
  ADD COLUMN IF NOT EXISTS feature_configs JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.ai_platform_property_settings.feature_configs IS
  'Per-feature JSON config blobs keyed by feature id (e.g. voice_receptionist).';

-- Backfill from legacy voice_receptionist_settings when present.
INSERT INTO public.ai_platform_property_settings (property_id, organization_id, feature_configs)
SELECT
  vrs.property_id,
  p.organization_id,
  jsonb_build_object(
    'voice_receptionist',
    jsonb_build_object(
      'enabled', vrs.enabled,
      'voice_id', vrs.voice_id,
      'persona_prompt', vrs.persona_prompt,
      'max_session_seconds', vrs.max_session_seconds,
      'max_sessions_per_guest_per_day', vrs.max_sessions_per_guest_per_day,
      'max_concurrent_sessions', vrs.max_concurrent_sessions
    )
  )
FROM public.voice_receptionist_settings AS vrs
INNER JOIN public.properties AS p ON p.id = vrs.property_id
ON CONFLICT (property_id) DO UPDATE
SET feature_configs =
  COALESCE(public.ai_platform_property_settings.feature_configs, '{}'::jsonb)
  || EXCLUDED.feature_configs;
