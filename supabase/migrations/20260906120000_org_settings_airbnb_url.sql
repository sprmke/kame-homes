-- Org Airbnb listing URL (Socials & branding).

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS airbnb_url TEXT;

COMMENT ON COLUMN public.org_settings.airbnb_url IS
  'Airbnb listing or host profile URL for org branding.';
