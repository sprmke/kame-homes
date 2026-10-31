-- Main social platform for guest review / booking CTAs (org + property).
-- Empty property column inherits org. Facebook is no longer a required field.

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS main_social_platform TEXT;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS main_social_platform TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'org_settings_main_social_platform_check'
  ) THEN
    ALTER TABLE public.org_settings
      ADD CONSTRAINT org_settings_main_social_platform_check
      CHECK (
        main_social_platform IS NULL
        OR main_social_platform IN ('facebook', 'airbnb', 'instagram', 'tiktok')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_main_social_platform_check'
  ) THEN
    ALTER TABLE public.app_settings
      ADD CONSTRAINT app_settings_main_social_platform_check
      CHECK (
        main_social_platform IS NULL
        OR main_social_platform IN ('facebook', 'airbnb', 'instagram', 'tiktok')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.org_settings.main_social_platform IS
  'Primary social platform for guest review / voucher CTAs. One of facebook|airbnb|instagram|tiktok.';

COMMENT ON COLUMN public.app_settings.main_social_platform IS
  'Property override for main social platform. NULL/empty inherits org_settings.main_social_platform.';

-- Backfill: orgs that already have a Facebook page default to facebook as main.
UPDATE public.org_settings
SET main_social_platform = 'facebook'
WHERE main_social_platform IS NULL
  AND NULLIF(TRIM(facebook_reviews_url), '') IS NOT NULL;
