-- Vehicle types a parking slot accepts (Phase 0 of parking E2E broadcast/claim plan).

ALTER TABLE public.parkings
  ADD COLUMN IF NOT EXISTS accepted_vehicle_types TEXT[] NOT NULL DEFAULT ARRAY['car']::text[];

ALTER TABLE public.parkings
  ADD CONSTRAINT parkings_accepted_vehicle_types_check
  CHECK (
    accepted_vehicle_types <@ ARRAY['car', 'motorcycle']::text[]
    AND cardinality(accepted_vehicle_types) >= 1
  );

UPDATE public.parkings
SET accepted_vehicle_types = ARRAY['motorcycle']::text[]
WHERE parking_type = 'motorcycle'
  AND accepted_vehicle_types = ARRAY['car']::text[];

CREATE INDEX IF NOT EXISTS parkings_accepted_vehicle_types_gin_idx
  ON public.parkings USING GIN (accepted_vehicle_types);

COMMENT ON COLUMN public.parkings.accepted_vehicle_types IS
  'Guest vehicle types this slot accepts: car and/or motorcycle. Used for broadcast candidate matching.';
