-- External review proof + Superhost verification on app_settings (per property).

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS external_reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS superhost_verification_url TEXT,
  ADD COLUMN IF NOT EXISTS superhost_proof_image_url TEXT,
  ADD COLUMN IF NOT EXISTS superhost_status TEXT NOT NULL DEFAULT 'none';

ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_superhost_status_check;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_superhost_status_check
  CHECK (superhost_status IN ('none', 'pending', 'approved', 'rejected'));

ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_external_reviews_is_array;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_external_reviews_is_array
  CHECK (jsonb_typeof(external_reviews) = 'array');

COMMENT ON COLUMN public.app_settings.external_reviews IS
  'Up to 5 owner-submitted Facebook/Airbnb reviews with proof; moderation_status pending until super-admin approval.';
COMMENT ON COLUMN public.app_settings.superhost_status IS
  'Superhost badge: none | pending (awaiting review) | approved | rejected';
