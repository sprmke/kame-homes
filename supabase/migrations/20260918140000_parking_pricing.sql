-- Parking pricing: weekday/weekend defaults + per-date calendar overrides.

ALTER TABLE public.parking_settings
  ADD COLUMN IF NOT EXISTS weekday_nightly_rate NUMERIC(12, 2)
    CHECK (weekday_nightly_rate IS NULL OR weekday_nightly_rate >= 0),
  ADD COLUMN IF NOT EXISTS weekend_nightly_rate NUMERIC(12, 2)
    CHECK (weekend_nightly_rate IS NULL OR weekend_nightly_rate >= 0);

COMMENT ON COLUMN public.parking_settings.weekday_nightly_rate IS
  'Default Mon–Thu nightly rate for this parking slot (Pricing page).';
COMMENT ON COLUMN public.parking_settings.weekend_nightly_rate IS
  'Default Fri–Sun nightly rate for this parking slot.';

UPDATE public.parking_settings
SET
  weekday_nightly_rate = COALESCE(weekday_nightly_rate, 300),
  weekend_nightly_rate = COALESCE(weekend_nightly_rate, 400);

CREATE TABLE IF NOT EXISTS public.parking_pricing_date_overrides (
  id BIGSERIAL PRIMARY KEY,
  parking_id UUID NOT NULL REFERENCES public.parkings(id) ON DELETE CASCADE,
  pricing_date DATE NOT NULL,
  nightly_rate NUMERIC(12, 2) NOT NULL CHECK (nightly_rate >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parking_id, pricing_date)
);

CREATE INDEX IF NOT EXISTS parking_pricing_date_overrides_parking_date_idx
  ON public.parking_pricing_date_overrides (parking_id, pricing_date);

ALTER TABLE public.parking_pricing_date_overrides ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.parking_pricing_date_overrides IS
  'Per-date nightly rate overrides from the parking Pricing calendar.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_pricing_date_overrides TO service_role;
