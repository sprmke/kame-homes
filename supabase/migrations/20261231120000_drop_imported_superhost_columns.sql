-- Remove imported Airbnb Superhost proof columns; badge is earned-only via organizations.settings.superhost.

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_superhost_status_check;

ALTER TABLE public.app_settings
  DROP COLUMN IF EXISTS superhost_verification_url,
  DROP COLUMN IF EXISTS superhost_proof_image_url,
  DROP COLUMN IF EXISTS superhost_status;
