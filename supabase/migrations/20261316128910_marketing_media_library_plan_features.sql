-- Marketing media library — Phase 1 (T1.4): seed `marketingMediaLibrary` per plan tier.
-- Values per docs/workflow/in-progress/marketing-video-editor-multitrack.md §3.1.
-- Editable afterwards in the super-admin plan editor. Applies to inactive plans too.

UPDATE public.pricing_plans
SET features = features || jsonb_build_object(
  'marketingMediaLibrary',
  CASE code
    WHEN 'free' THEN '{"storageMb":100,"maxFiles":30,"maxImageMb":10,"maxVideoMb":50,"maxVideoSec":30,"maxAudioMb":15,"dailyUploads":20}'::jsonb
    WHEN 'starter' THEN '{"storageMb":500,"maxFiles":100,"maxImageMb":10,"maxVideoMb":100,"maxVideoSec":60,"maxAudioMb":15,"dailyUploads":50}'::jsonb
    WHEN 'growth' THEN '{"storageMb":3072,"maxFiles":500,"maxImageMb":10,"maxVideoMb":150,"maxVideoSec":60,"maxAudioMb":25,"dailyUploads":150}'::jsonb
    WHEN 'pro' THEN '{"storageMb":10240,"maxFiles":2000,"maxImageMb":10,"maxVideoMb":150,"maxVideoSec":60,"maxAudioMb":25,"dailyUploads":300}'::jsonb
    WHEN 'business_plus' THEN '{"storageMb":10240,"maxFiles":2000,"maxImageMb":10,"maxVideoMb":150,"maxVideoSec":60,"maxAudioMb":25,"dailyUploads":300}'::jsonb
    WHEN 'managed' THEN '{"storageMb":25600,"maxFiles":5000,"maxImageMb":10,"maxVideoMb":150,"maxVideoSec":60,"maxAudioMb":25,"dailyUploads":500}'::jsonb
    ELSE '{"storageMb":100,"maxFiles":30,"maxImageMb":10,"maxVideoMb":50,"maxVideoSec":30,"maxAudioMb":15,"dailyUploads":20}'::jsonb
  END
)
WHERE NOT (features ? 'marketingMediaLibrary');
