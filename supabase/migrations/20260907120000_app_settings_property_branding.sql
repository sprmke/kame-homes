-- Per-property branding and social links (org_settings remain org-level defaults).

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS brand_color TEXT,
  ADD COLUMN IF NOT EXISTS facebook_reviews_url TEXT,
  ADD COLUMN IF NOT EXISTS airbnb_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_url TEXT;

COMMENT ON COLUMN public.app_settings.brand_color IS
  'Property brand hex (#RRGGBB). Falls back to organizations.settings.brandColor when unset.';
COMMENT ON COLUMN public.app_settings.facebook_reviews_url IS
  'Property Facebook page URL. Falls back to org_settings.facebook_reviews_url when unset.';
COMMENT ON COLUMN public.app_settings.airbnb_url IS
  'Property Airbnb listing URL. Falls back to org_settings.airbnb_url when unset.';
COMMENT ON COLUMN public.app_settings.instagram_url IS
  'Property Instagram profile URL. Falls back to org_settings.instagram_url when unset.';
COMMENT ON COLUMN public.app_settings.tiktok_url IS
  'Property TikTok profile URL. Falls back to org_settings.tiktok_url when unset.';
