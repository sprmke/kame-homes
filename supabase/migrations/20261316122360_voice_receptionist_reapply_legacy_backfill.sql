-- Bugfix: 20261316122351/20261316122352 unconditionally restored the pre-backfill
-- snapshot of ai_platform_global_settings.enabled/allowed_features, which silently
-- discarded the legacy voice-receptionist merge that 20261316122350 had just applied.
-- The very next migration (20261316122400) then drops the legacy source tables, so
-- without this fix the merge is unrecoverable: any org with legacy voice receptionist
-- enabled would lose that opt-in permanently the moment this batch runs.
--
-- This re-applies the same merge as 20261316122350, one more time, after the restore
-- migrations have already run and before the legacy tables are dropped, so the merged
-- result is what actually survives.

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
END $$;
