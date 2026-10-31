-- Marketing media library — per-tier quotas on the shipped plan catalog.
--
-- The later `…940_marketing_media_library_plan_features.sql` migration backfills
-- `marketingMediaLibrary` per code, but its `WHERE NOT (features ? 'marketingMediaLibrary')`
-- guard never fires on a fresh replay: earlier plan seeds already write the Free
-- defaults into every tier, so Starter → Managed come up with Free limits and
-- `bun run check:plan-catalog` fails on a fresh database.
--
-- This migration writes the per-tier values from `planTierGolden.ts` wherever a
-- plan still carries the Free default, so super-admin edits are left alone.

UPDATE public.pricing_plans
SET features = features || jsonb_build_object(
  'marketingMediaLibrary',
  CASE code
    WHEN 'starter' THEN '{"storageMb":500,"maxFiles":100,"maxImageMb":10,"maxVideoMb":100,"maxVideoSec":60,"maxAudioMb":15,"dailyUploads":50}'::jsonb
    WHEN 'growth' THEN '{"storageMb":3072,"maxFiles":500,"maxImageMb":10,"maxVideoMb":150,"maxVideoSec":60,"maxAudioMb":25,"dailyUploads":150}'::jsonb
    WHEN 'pro' THEN '{"storageMb":10240,"maxFiles":2000,"maxImageMb":10,"maxVideoMb":150,"maxVideoSec":60,"maxAudioMb":25,"dailyUploads":300}'::jsonb
    WHEN 'business_plus' THEN '{"storageMb":10240,"maxFiles":2000,"maxImageMb":10,"maxVideoMb":150,"maxVideoSec":60,"maxAudioMb":25,"dailyUploads":300}'::jsonb
    WHEN 'managed' THEN '{"storageMb":25600,"maxFiles":5000,"maxImageMb":10,"maxVideoMb":150,"maxVideoSec":60,"maxAudioMb":25,"dailyUploads":500}'::jsonb
  END
)
WHERE code IN ('starter', 'growth', 'pro', 'business_plus', 'managed')
  AND COALESCE(
        features -> 'marketingMediaLibrary',
        '{"storageMb":100,"maxFiles":30,"maxImageMb":10,"maxVideoMb":50,"maxVideoSec":30,"maxAudioMb":15,"dailyUploads":20}'::jsonb
      ) =
      '{"storageMb":100,"maxFiles":30,"maxImageMb":10,"maxVideoMb":50,"maxVideoSec":30,"maxAudioMb":15,"dailyUploads":20}'::jsonb;
