-- Org social links (Facebook page, Instagram, TikTok).

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_url TEXT;

COMMENT ON COLUMN public.org_settings.facebook_reviews_url IS
  'Facebook page URL for guest-facing review CTAs (legacy column name).';

COMMENT ON COLUMN public.org_settings.instagram_url IS
  'Instagram profile URL for org branding.';

COMMENT ON COLUMN public.org_settings.tiktok_url IS
  'TikTok profile URL for org branding.';
