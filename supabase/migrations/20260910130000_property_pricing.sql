-- Property pricing defaults (app_settings) + per-date nightly overrides.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS weekday_nightly_rate NUMERIC(12, 2)
    CHECK (weekday_nightly_rate IS NULL OR weekday_nightly_rate >= 0),
  ADD COLUMN IF NOT EXISTS weekend_nightly_rate NUMERIC(12, 2)
    CHECK (weekend_nightly_rate IS NULL OR weekend_nightly_rate >= 0),
  ADD COLUMN IF NOT EXISTS default_down_payment NUMERIC(12, 2)
    CHECK (default_down_payment IS NULL OR default_down_payment >= 0),
  ADD COLUMN IF NOT EXISTS default_security_deposit NUMERIC(12, 2)
    CHECK (default_security_deposit IS NULL OR default_security_deposit >= 0),
  ADD COLUMN IF NOT EXISTS default_pet_fee NUMERIC(12, 2)
    CHECK (default_pet_fee IS NULL OR default_pet_fee >= 0),
  ADD COLUMN IF NOT EXISTS default_guest_additional_fee NUMERIC(12, 2)
    CHECK (default_guest_additional_fee IS NULL OR default_guest_additional_fee >= 0);

COMMENT ON COLUMN public.app_settings.weekday_nightly_rate IS
  'Default Mon–Thu nightly rate (property Pricing page / ReviewPricingForm).';
COMMENT ON COLUMN public.app_settings.weekend_nightly_rate IS
  'Default Fri–Sun nightly rate.';
COMMENT ON COLUMN public.app_settings.default_down_payment IS
  'Default down payment for new booking pricing review.';
COMMENT ON COLUMN public.app_settings.default_security_deposit IS
  'Default security deposit for new booking pricing review.';
COMMENT ON COLUMN public.app_settings.default_pet_fee IS
  'Default pet fee when booking has pets.';
COMMENT ON COLUMN public.app_settings.default_guest_additional_fee IS
  'Default extra guest fee per pax.';

UPDATE public.app_settings
SET
  weekday_nightly_rate = COALESCE(weekday_nightly_rate, 2799),
  weekend_nightly_rate = COALESCE(weekend_nightly_rate, 2999),
  default_down_payment = COALESCE(default_down_payment, 1500),
  default_security_deposit = COALESCE(default_security_deposit, 1500),
  default_pet_fee = COALESCE(default_pet_fee, 300),
  default_guest_additional_fee = COALESCE(default_guest_additional_fee, 0),
  default_parking_rate_guest = COALESCE(default_parking_rate_guest, 400)
WHERE property_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.property_pricing_date_overrides (
  id BIGSERIAL PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  pricing_date DATE NOT NULL,
  nightly_rate NUMERIC(12, 2) NOT NULL CHECK (nightly_rate >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, pricing_date)
);

CREATE INDEX IF NOT EXISTS property_pricing_date_overrides_property_date_idx
  ON public.property_pricing_date_overrides (property_id, pricing_date);

ALTER TABLE public.property_pricing_date_overrides ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.property_pricing_date_overrides IS
  'Per-date nightly rate overrides from the property Pricing calendar.';
