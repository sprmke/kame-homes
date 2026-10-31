-- Final idempotent legacy backfill before the hardening migration removes the old tables.
-- Existing unified settings win; legacy values only fill a missing property config.

DO $$
BEGIN
  IF to_regclass('public.voice_receptionist_global_settings') IS NOT NULL THEN
    UPDATE public.ai_platform_global_settings AS target
    SET
      enabled = target.enabled OR COALESCE(legacy.enabled, FALSE),
      allowed_features = CASE
        WHEN legacy.enabled IS TRUE
          AND NOT ('voice_receptionist' = ANY(COALESCE(target.allowed_features, '{}')))
          THEN array_append(COALESCE(target.allowed_features, '{}'), 'voice_receptionist')
        ELSE target.allowed_features
      END
    FROM public.voice_receptionist_global_settings AS legacy
    WHERE target.id = 1
      AND legacy.id = 1;
  END IF;

  IF to_regclass('public.voice_receptionist_settings') IS NOT NULL THEN
    INSERT INTO public.ai_platform_property_settings (
      property_id,
      organization_id,
      feature_configs
    )
    SELECT
      legacy.property_id,
      property.organization_id,
      jsonb_build_object(
        'voice_receptionist',
        jsonb_build_object(
          'enabled', legacy.enabled,
          'voice_id', legacy.voice_id,
          'persona_prompt', legacy.persona_prompt,
          'max_session_seconds', legacy.max_session_seconds,
          'max_sessions_per_guest_per_day', legacy.max_sessions_per_guest_per_day,
          'max_concurrent_sessions', legacy.max_concurrent_sessions
        )
      )
    FROM public.voice_receptionist_settings AS legacy
    INNER JOIN public.properties AS property ON property.id = legacy.property_id
    ON CONFLICT (property_id) DO UPDATE
    SET feature_configs = CASE
      WHEN COALESCE(public.ai_platform_property_settings.feature_configs, '{}'::jsonb)
        ? 'voice_receptionist'
        THEN public.ai_platform_property_settings.feature_configs
      ELSE COALESCE(public.ai_platform_property_settings.feature_configs, '{}'::jsonb)
        || EXCLUDED.feature_configs
    END;
  END IF;
END $$;
