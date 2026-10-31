-- Indexes for public listing filter/sort endpoints (list-public-properties/developments/parkings).
-- Complements 20261005130000_search_indexes.sql (city, trgm, availability).

CREATE INDEX IF NOT EXISTS properties_status_type_idx
  ON public.properties (status, type)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS properties_status_created_at_idx
  ON public.properties (status, created_at DESC)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS app_settings_property_weekday_rate_idx
  ON public.app_settings (property_id, weekday_nightly_rate);

CREATE INDEX IF NOT EXISTS developments_status_type_idx
  ON public.developments (status, type)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS developments_status_created_at_idx
  ON public.developments (status, created_at DESC)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS parkings_status_parking_type_idx
  ON public.parkings (status, parking_type)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS parkings_status_tower_idx
  ON public.parkings (status, tower)
  WHERE status = 'ACTIVE';
