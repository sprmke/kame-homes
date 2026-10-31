-- Public search: promote properties.city, enable pg_trgm, and add search/availability indexes.
-- Consumed by search-suggestions / search-listings; shared with future list-public-* filters.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Promote city out of settings JSON so "where" queries can use a real column + index.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS city TEXT;

UPDATE public.properties
SET city = NULLIF(trim(settings ->> 'city'), '')
WHERE city IS NULL
  AND settings ? 'city'
  AND NULLIF(trim(settings ->> 'city'), '') IS NOT NULL;

COMMENT ON COLUMN public.properties.city IS
  'Marketing city for public search/filters. Backfilled from settings.city; keep in sync on property updates.';

-- Trigram indexes for ILIKE '%q%' / similarity-style matching
CREATE INDEX IF NOT EXISTS properties_name_trgm_idx
  ON public.properties USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS properties_city_trgm_idx
  ON public.properties USING gin (city gin_trgm_ops);

CREATE INDEX IF NOT EXISTS properties_residence_name_trgm_idx
  ON public.properties USING gin (residence_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS developments_name_trgm_idx
  ON public.developments USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS developments_city_trgm_idx
  ON public.developments USING gin (city gin_trgm_ops);

CREATE INDEX IF NOT EXISTS developments_location_trgm_idx
  ON public.developments USING gin (location gin_trgm_ops);

CREATE INDEX IF NOT EXISTS parkings_name_trgm_idx
  ON public.parkings USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS parkings_residence_name_trgm_idx
  ON public.parkings USING gin (residence_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS parkings_tower_trgm_idx
  ON public.parkings USING gin (tower gin_trgm_ops);

-- Batch conflict lookups for availability (parking already has parking_id+status partial index)
CREATE INDEX IF NOT EXISTS idx_guest_submissions_property_id_status
  ON public.guest_submissions (property_id, status)
  WHERE property_id IS NOT NULL;

-- Helpful for ACTIVE-only public catalog scans used by search + future filters
CREATE INDEX IF NOT EXISTS properties_status_city_idx
  ON public.properties (status, city)
  WHERE status = 'ACTIVE';

-- Keep properties.city in sync when settings.city changes (filters + search).
CREATE OR REPLACE FUNCTION public.sync_property_city_from_settings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.city := NULLIF(trim(NEW.settings ->> 'city'), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_property_city_from_settings ON public.properties;
CREATE TRIGGER trg_sync_property_city_from_settings
  BEFORE INSERT OR UPDATE OF settings ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_property_city_from_settings();
