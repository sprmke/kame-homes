-- Public listing search index (properties, developments, parkings).
--
-- Replaces the "load every ACTIVE row into the edge function, then filter/sort/facet in
-- JS" hybrid (20k-row fail-closed ceiling) with a denormalized, trigger-maintained table
-- plus SECURITY DEFINER RPCs that return { total, ids, facets } for one page.
-- Plan: docs/workflow/for-testing/public-listing-pages-hardening.md (Phase 2).
--
-- Only filter / sort / facet columns live here. Card payloads are still mapped in TS from
-- the source rows of the current page, so display logic has one home.
--
-- Every derivation mirrors a TS helper — keep them in sync (parity test:
-- supabase/functions/tests/publicListingSearchParity.integration_test.ts):
--   pls_trim                    String.prototype.trim()
--   pls_normalize_city_place    _shared/listingPlace.ts normalizeCityPlace
--   pls_property_place_label    _shared/listingPlace.ts propertyPlaceLabel
--   pls_location_slug           _shared/listingPlace.ts toLocationSlug
--   pls_slugify_name            _shared/slugUtils.ts slugifyName
--   pls_try_number              _shared/searchIntents.ts readSettingsCoord (number | numeric string)
--   pls_json_number             strict `typeof value === 'number'` readers
--   pls_external_review_stats   _shared/propertyExternalReviews.ts listApprovedPublicExternalReviews
--   pls_text_rank               _shared/publicSearch.ts rankTextMatch
--   pls_flexible_date           _shared/availabilityService.ts parseFlexibleDate
--
-- Access: the table has RLS on with no policies and the RPCs are revoked from anon /
-- authenticated — only edge functions (service role) read them.

-- ---------------------------------------------------------------------------
-- Pure helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pls_trim(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(value, '^\s+|\s+$', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.pls_json_string(value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE WHEN jsonb_typeof(value) = 'string' THEN public.pls_trim(value #>> '{}') END;
$$;

-- Strict number reader (`typeof value === 'number' && Number.isFinite(value)`).
CREATE OR REPLACE FUNCTION public.pls_json_number(value jsonb)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::double precision END;
$$;

-- Number or numeric string (readSettingsCoord). Non-finite / unparsable → NULL.
CREATE OR REPLACE FUNCTION public.pls_try_number(value jsonb)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  raw text;
  parsed double precision;
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(value) = 'number' THEN
    RETURN (value #>> '{}')::double precision;
  END IF;
  IF jsonb_typeof(value) <> 'string' THEN
    RETURN NULL;
  END IF;
  raw := public.pls_trim(value #>> '{}');
  IF raw = '' OR raw !~ '^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$' THEN
    RETURN NULL;
  END IF;
  BEGIN
    parsed := raw::double precision;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  IF parsed = 'Infinity'::double precision OR parsed = '-Infinity'::double precision THEN
    RETURN NULL;
  END IF;
  RETURN parsed;
END;
$$;

CREATE OR REPLACE FUNCTION public.pls_normalize_city_place(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    NULLIF(public.pls_trim(regexp_replace(COALESCE(public.pls_trim(value), ''), '\s+City$', '', 'i')), ''),
    'Other'
  );
$$;

CREATE OR REPLACE FUNCTION public.pls_location_slug(place text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    NULLIF(
      regexp_replace(
        regexp_replace(
          regexp_replace(normalize(lower(public.pls_trim(COALESCE(place, ''))), NFD), '[̀-ͯ]', '', 'g'),
          '[^a-z0-9]+', '-', 'g'
        ),
        '^-+|-+$', '', 'g'
      ),
      ''
    ),
    'other'
  );
$$;

CREATE OR REPLACE FUNCTION public.pls_slugify_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    NULLIF(
      left(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(public.pls_trim(COALESCE(value, ''))), '[^a-z0-9]+', '-', 'g'),
            '^-+|-+$', '', 'g'
          ),
          '-{2,}', '-', 'g'
        ),
        64
      ),
      ''
    ),
    'item'
  );
$$;

-- buildPropertyLocationLabel → placeLabelFromPropertyLocation.
CREATE OR REPLACE FUNCTION public.pls_property_place_label(
  city text,
  residence_name text,
  settings jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  resolved_city text := NULLIF(public.pls_trim(COALESCE(city, '')), '');
  residence text := NULLIF(public.pls_trim(COALESCE(residence_name, '')), '');
  label text;
  parts text[];
  head text;
  second text;
  stripped text;
BEGIN
  IF resolved_city IS NULL THEN
    resolved_city := NULLIF(public.pls_json_string(settings -> 'city'), '');
  END IF;

  label := array_to_string(ARRAY_REMOVE(ARRAY[resolved_city, residence], NULL), ', ');
  IF label = '' THEN
    label := 'Philippines';
  END IF;

  SELECT COALESCE(array_agg(part ORDER BY ord), ARRAY[]::text[])
  INTO parts
  FROM (
    SELECT public.pls_trim(raw) AS part, ord
    FROM unnest(string_to_array(label, ',')) WITH ORDINALITY AS u(raw, ord)
  ) split
  WHERE part <> '';

  IF cardinality(parts) = 0 THEN
    RETURN 'Other';
  END IF;

  head := parts[1];
  second := parts[2];

  IF second IS NOT NULL AND head ~* 'bonifacio|fort bonifacio|\ybgc\y' THEN
    stripped := public.pls_trim(regexp_replace(second, '\s+City$', '', 'i'));
    RETURN CASE WHEN stripped = '' THEN second ELSE stripped END;
  END IF;

  stripped := public.pls_trim(regexp_replace(head, '\s+City$', '', 'i'));
  RETURN CASE WHEN stripped = '' THEN head ELSE stripped END;
END;
$$;

-- resolveListingCoords: settings lat/lng, else the Azure North default pin.
CREATE OR REPLACE FUNCTION public.pls_listing_lat(settings jsonb, residence_name text)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN public.pls_try_number(settings -> 'latitude') IS NOT NULL
      AND public.pls_try_number(settings -> 'longitude') IS NOT NULL
      THEN public.pls_try_number(settings -> 'latitude')
    WHEN lower(public.pls_trim(COALESCE(residence_name, ''))) IN ('azure north residences', 'azure north')
      THEN 15.1696
  END;
$$;

CREATE OR REPLACE FUNCTION public.pls_listing_lng(settings jsonb, residence_name text)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN public.pls_try_number(settings -> 'latitude') IS NOT NULL
      AND public.pls_try_number(settings -> 'longitude') IS NOT NULL
      THEN public.pls_try_number(settings -> 'longitude')
    WHEN lower(public.pls_trim(COALESCE(residence_name, ''))) IN ('azure north residences', 'azure north')
      THEN 120.5598
  END;
$$;

CREATE OR REPLACE FUNCTION public.pls_haversine_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT 6371 * 2 * atan2(sqrt(a), sqrt(GREATEST(1 - a, 0)))
  FROM (
    SELECT power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2) AS a
  ) s;
$$;

-- Approved external reviews (first 5 entries, normalizeStarRating with default 5).
CREATE OR REPLACE FUNCTION public.pls_external_review_stats(
  reviews jsonb,
  OUT rating_sum double precision,
  OUT rating_count integer
)
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  item jsonb;
  raw jsonb;
  n double precision;
  star integer;
BEGIN
  rating_sum := 0;
  rating_count := 0;
  IF reviews IS NULL OR jsonb_typeof(reviews) <> 'array' THEN
    RETURN;
  END IF;

  FOR item IN
    SELECT value FROM jsonb_array_elements(reviews) WITH ORDINALITY AS e(value, ord) WHERE ord <= 5
  LOOP
    IF jsonb_typeof(item) <> 'object' THEN
      CONTINUE;
    END IF;
    IF lower(COALESCE(public.pls_json_string(item -> 'moderationStatus'), '')) <> 'approved' THEN
      CONTINUE;
    END IF;

    raw := item -> 'starRating';
    n := NULL;
    IF raw IS NULL OR jsonb_typeof(raw) = 'null' THEN
      n := NULL;
    ELSIF jsonb_typeof(raw) = 'boolean' THEN
      n := CASE WHEN raw = 'true'::jsonb THEN 1 ELSE 0 END;
    ELSIF jsonb_typeof(raw) = 'string' AND raw #>> '{}' = '' THEN
      n := NULL;
    ELSE
      n := public.pls_try_number(raw);
    END IF;

    star := NULL;
    IF n IS NOT NULL THEN
      star := floor(n + 0.5)::integer;
      IF star < 1 OR star > 5 THEN
        star := NULL;
      END IF;
    END IF;

    rating_sum := rating_sum + COALESCE(star, 5);
    rating_count := rating_count + 1;
  END LOOP;
END;
$$;

-- Escape a literal for use inside a POSIX (ARE) regex.
CREATE OR REPLACE FUNCTION public.pls_regex_escape(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(value, '([!$()*+.:<=>?[\\\]^{|}-])', '\\\1', 'g');
$$;

-- Token-prefix regex for a lowercased, trimmed query, or NULL when the query itself
-- contains a separator (JS tokens never contain separators, so it can never match).
CREATE OR REPLACE FUNCTION public.pls_token_regex(query text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN COALESCE(query, '') = '' OR query ~ '[\s,/-]' THEN NULL
    ELSE '[\s,/-]' || public.pls_regex_escape(query)
  END;
$$;

-- rankTextMatch for ONE field (inlinable): exact 100, prefix 80, token prefix 70,
-- substring 50. `query` is lowercased + trimmed; `token_re` from pls_token_regex.
CREATE OR REPLACE FUNCTION public.pls_field_rank(query text, token_re text, field text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN field IS NULL OR COALESCE(query, '') = '' THEN 0
    WHEN strpos(lower(field), query) = 0 THEN 0
    WHEN lower(public.pls_trim(field)) = query THEN 100
    WHEN starts_with(lower(public.pls_trim(field)), query) THEN 80
    WHEN token_re IS NOT NULL AND lower(field) ~ token_re THEN 70
    ELSE 50
  END;
$$;

-- rankTextMatch across fields (best field wins).
CREATE OR REPLACE FUNCTION public.pls_text_rank(query text, fields text[])
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(MAX(public.pls_field_rank(query, public.pls_token_regex(query), field)), 0)
  FROM unnest(fields) AS field;
$$;

-- Best rank across expanded concept terms.
CREATE OR REPLACE FUNCTION public.pls_terms_rank(terms text[], fields text[])
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(MAX(public.pls_text_rank(lower(public.pls_trim(term)), fields)), 0)
  FROM unnest(terms) AS term
  WHERE term IS NOT NULL;
$$;

-- MM-DD-YYYY or YYYY-MM-DD text → date; malformed / non-calendar → NULL.
CREATE OR REPLACE FUNCTION public.pls_flexible_date(value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  raw text := public.pls_trim(COALESCE(value, ''));
BEGIN
  IF raw ~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN make_date(substr(raw, 1, 4)::int, substr(raw, 6, 2)::int, substr(raw, 9, 2)::int);
  ELSIF raw ~ '^\d{2}-\d{2}-\d{4}$' THEN
    RETURN make_date(substr(raw, 7, 4)::int, substr(raw, 1, 2)::int, substr(raw, 4, 2)::int);
  END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.pls_jsonb_text_array(value jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(value) = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(value))
    ELSE ARRAY[]::text[]
  END;
$$;

-- ---------------------------------------------------------------------------
-- Index table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_listing_search (
  family text NOT NULL CHECK (family IN ('property', 'development', 'parking')),
  id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  city text,
  place_label text NOT NULL,
  place_slug text NOT NULL,
  residence_name text,
  residence_key text,
  residence_slug text,
  location text,
  developer_name text,
  tower text,
  slot_label text,
  type_key text,
  price double precision NOT NULL DEFAULT 0,
  price_max double precision,
  bedrooms double precision,
  capacity integer,
  amenity_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  lat double precision,
  lng double precision,
  rating double precision,
  review_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family, id)
);

COMMENT ON TABLE public.public_listing_search IS
  'Trigger-maintained filter/sort/facet index for ACTIVE public listings. Read only via search_public_* RPCs (service role).';

CREATE INDEX IF NOT EXISTS public_listing_search_place_idx
  ON public.public_listing_search (family, place_slug);
CREATE INDEX IF NOT EXISTS public_listing_search_lat_idx
  ON public.public_listing_search (family, lat) WHERE lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS public_listing_search_created_idx
  ON public.public_listing_search (family, created_at DESC, id);
CREATE INDEX IF NOT EXISTS public_listing_search_price_idx
  ON public.public_listing_search (family, price);
CREATE INDEX IF NOT EXISTS public_listing_search_residence_idx
  ON public.public_listing_search (family, residence_key);
CREATE INDEX IF NOT EXISTS public_listing_search_amenities_idx
  ON public.public_listing_search USING gin (amenity_ids);
CREATE INDEX IF NOT EXISTS public_listing_search_name_trgm_idx
  ON public.public_listing_search USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS public_listing_search_city_trgm_idx
  ON public.public_listing_search USING gin (city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS public_listing_search_residence_trgm_idx
  ON public.public_listing_search USING gin (residence_name gin_trgm_ops);

-- Development lookup by normalized name (properties/parkings link to developments by name).
CREATE INDEX IF NOT EXISTS developments_name_key_idx
  ON public.developments ((lower(public.pls_trim(name))))
  WHERE status = 'ACTIVE';

ALTER TABLE public.public_listing_search ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_listing_search FROM anon, authenticated;

-- Catalog version: bumped on every index change; folded into edge cache keys so cached
-- listing responses invalidate as soon as a listing, price, or review changes.
CREATE TABLE IF NOT EXISTS public.public_listing_catalog_version (
  family text PRIMARY KEY CHECK (family IN ('property', 'development', 'parking')),
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.public_listing_catalog_version (family)
VALUES ('property'), ('development'), ('parking')
ON CONFLICT (family) DO NOTHING;

ALTER TABLE public.public_listing_catalog_version ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_listing_catalog_version FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.pls_bump_catalog_version(p_family text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.public_listing_catalog_version
  SET version = version + 1, updated_at = now()
  WHERE family = p_family;
$$;

-- ---------------------------------------------------------------------------
-- Row refresh (one listing)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pls_refresh_property(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.properties%ROWTYPE;
  s jsonb;
  max_adults double precision;
  max_children double precision;
  cap integer;
  weekday numeric;
  external_reviews jsonb;
  guest_sum double precision;
  guest_count integer;
  ext record;
  total_count integer;
  amenities text[];
  display_city text;
BEGIN
  IF p_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO r FROM public.properties WHERE id = p_id;
  IF NOT FOUND OR r.status IS DISTINCT FROM 'ACTIVE' THEN
    DELETE FROM public.public_listing_search WHERE family = 'property' AND id = p_id;
    PERFORM public.pls_bump_catalog_version('property');
    RETURN;
  END IF;

  s := CASE WHEN jsonb_typeof(r.settings) = 'object' THEN r.settings ELSE '{}'::jsonb END;

  max_adults := public.pls_json_number(s -> 'maxAdults');
  max_children := COALESCE(public.pls_json_number(s -> 'maxChildren'), 0);
  cap := CASE
    WHEN r.max_guests IS NOT NULL AND r.max_guests > 0 THEN r.max_guests
    WHEN max_adults IS NOT NULL THEN GREATEST(floor(max_adults + GREATEST(max_children, 0))::int, 1)
  END;

  SELECT a.weekday_nightly_rate, a.external_reviews
  INTO weekday, external_reviews
  FROM public.app_settings a
  WHERE a.property_id = p_id;

  SELECT COALESCE(SUM(g.star_rating), 0), COUNT(*)
  INTO guest_sum, guest_count
  FROM public.guest_reviews g
  WHERE g.property_id = p_id;

  ext := public.pls_external_review_stats(external_reviews);
  total_count := guest_count + ext.rating_count;

  SELECT COALESCE(array_agg(DISTINCT public.pls_trim(v)), ARRAY[]::text[])
  INTO amenities
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(s -> 'enabledAmenities') = 'array' THEN s -> 'enabledAmenities' ELSE '[]'::jsonb END
  ) AS v
  WHERE public.pls_trim(v) <> '';

  display_city := COALESCE(
    NULLIF(public.pls_trim(COALESCE(r.city, '')), ''),
    NULLIF(public.pls_json_string(s -> 'city'), '')
  );

  INSERT INTO public.public_listing_search AS t (
    family, id, slug, name, city, place_label, place_slug, residence_name, residence_key,
    residence_slug, type_key, price, bedrooms, capacity, amenity_ids, lat, lng, rating,
    review_count, created_at, refreshed_at
  )
  VALUES (
    'property',
    r.id,
    r.slug,
    r.name,
    display_city,
    public.pls_property_place_label(r.city, r.residence_name, s),
    public.pls_location_slug(public.pls_property_place_label(r.city, r.residence_name, s)),
    NULLIF(public.pls_trim(COALESCE(r.residence_name, '')), ''),
    NULLIF(lower(public.pls_trim(COALESCE(r.residence_name, ''))), ''),
    CASE WHEN NULLIF(public.pls_trim(COALESCE(r.residence_name, '')), '') IS NOT NULL
      THEN public.pls_slugify_name(r.residence_name) END,
    lower(COALESCE(r.type, '')),
    COALESCE(weekday::double precision, 2799),
    public.pls_json_number(s -> 'bedrooms'),
    cap,
    amenities,
    public.pls_listing_lat(s, r.residence_name),
    public.pls_listing_lng(s, r.residence_name),
    CASE WHEN total_count > 0
      THEN floor(((guest_sum + ext.rating_sum) / total_count) * 10 + 0.5) / 10 END,
    total_count,
    r.created_at,
    now()
  )
  ON CONFLICT (family, id) DO UPDATE SET
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    city = EXCLUDED.city,
    place_label = EXCLUDED.place_label,
    place_slug = EXCLUDED.place_slug,
    residence_name = EXCLUDED.residence_name,
    residence_key = EXCLUDED.residence_key,
    residence_slug = EXCLUDED.residence_slug,
    type_key = EXCLUDED.type_key,
    price = EXCLUDED.price,
    bedrooms = EXCLUDED.bedrooms,
    capacity = EXCLUDED.capacity,
    amenity_ids = EXCLUDED.amenity_ids,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    rating = EXCLUDED.rating,
    review_count = EXCLUDED.review_count,
    created_at = EXCLUDED.created_at,
    refreshed_at = now();

  PERFORM public.pls_bump_catalog_version('property');
END;
$$;

CREATE OR REPLACE FUNCTION public.pls_refresh_development(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.developments%ROWTYPE;
  s jsonb;
  price_min double precision;
  place text;
BEGIN
  IF p_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO r FROM public.developments WHERE id = p_id;
  IF NOT FOUND OR r.status IS DISTINCT FROM 'ACTIVE' THEN
    DELETE FROM public.public_listing_search WHERE family = 'development' AND id = p_id;
    PERFORM public.pls_bump_catalog_version('development');
    RETURN;
  END IF;

  s := CASE WHEN jsonb_typeof(r.settings) = 'object' THEN r.settings ELSE '{}'::jsonb END;
  price_min := COALESCE(public.pls_json_number(s -> 'priceRangeMin'), 0);
  place := public.pls_normalize_city_place(r.city);

  INSERT INTO public.public_listing_search AS t (
    family, id, slug, name, city, place_label, place_slug, residence_name, residence_key,
    location, developer_name, type_key, price, price_max, lat, lng, created_at, refreshed_at
  )
  VALUES (
    'development',
    r.id,
    r.slug,
    r.name,
    r.city,
    place,
    public.pls_location_slug(place),
    r.name,
    NULLIF(lower(public.pls_trim(COALESCE(r.name, ''))), ''),
    r.location,
    r.developer_name,
    upper(COALESCE(r.type, '')),
    price_min,
    COALESCE(public.pls_json_number(s -> 'priceRangeMax'), price_min),
    public.pls_listing_lat(s, r.name),
    public.pls_listing_lng(s, r.name),
    r.created_at,
    now()
  )
  ON CONFLICT (family, id) DO UPDATE SET
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    city = EXCLUDED.city,
    place_label = EXCLUDED.place_label,
    place_slug = EXCLUDED.place_slug,
    residence_name = EXCLUDED.residence_name,
    residence_key = EXCLUDED.residence_key,
    location = EXCLUDED.location,
    developer_name = EXCLUDED.developer_name,
    type_key = EXCLUDED.type_key,
    price = EXCLUDED.price,
    price_max = EXCLUDED.price_max,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    created_at = EXCLUDED.created_at,
    refreshed_at = now();

  PERFORM public.pls_bump_catalog_version('development');
END;
$$;

CREATE OR REPLACE FUNCTION public.pls_refresh_parking(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.parkings%ROWTYPE;
  s jsonb;
  weekday numeric;
  has_settings boolean;
  settings_city text;
  place text;
BEGIN
  IF p_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO r FROM public.parkings WHERE id = p_id;
  IF NOT FOUND OR r.status IS DISTINCT FROM 'ACTIVE' THEN
    DELETE FROM public.public_listing_search WHERE family = 'parking' AND id = p_id;
    PERFORM public.pls_bump_catalog_version('parking');
    RETURN;
  END IF;

  s := CASE WHEN jsonb_typeof(r.settings) = 'object' THEN r.settings ELSE '{}'::jsonb END;
  settings_city := NULLIF(public.pls_json_string(s -> 'city'), '');
  place := public.pls_normalize_city_place(settings_city);

  -- Guests are charged from parking_settings (pricing engine); default matches
  -- DEFAULT_PARKING_WEEKDAY so list cards agree with the detail page and checkout.
  SELECT ps.weekday_nightly_rate, true
  INTO weekday, has_settings
  FROM public.parking_settings ps
  WHERE ps.parking_id = p_id;

  INSERT INTO public.public_listing_search AS t (
    family, id, slug, name, city, place_label, place_slug, residence_name, residence_key,
    residence_slug, tower, slot_label, type_key, price, lat, lng, created_at, refreshed_at
  )
  VALUES (
    'parking',
    r.id,
    r.slug,
    r.name,
    settings_city,
    place,
    public.pls_location_slug(place),
    NULLIF(public.pls_trim(COALESCE(r.residence_name, '')), ''),
    NULLIF(lower(public.pls_trim(COALESCE(r.residence_name, ''))), ''),
    CASE WHEN NULLIF(public.pls_trim(COALESCE(r.residence_name, '')), '') IS NOT NULL
      THEN public.pls_slugify_name(r.residence_name) END,
    r.tower,
    r.slot_label,
    r.parking_type,
    COALESCE(weekday::double precision, 300),
    public.pls_listing_lat(s, r.residence_name),
    public.pls_listing_lng(s, r.residence_name),
    r.created_at,
    now()
  )
  ON CONFLICT (family, id) DO UPDATE SET
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    city = EXCLUDED.city,
    place_label = EXCLUDED.place_label,
    place_slug = EXCLUDED.place_slug,
    residence_name = EXCLUDED.residence_name,
    residence_key = EXCLUDED.residence_key,
    residence_slug = EXCLUDED.residence_slug,
    tower = EXCLUDED.tower,
    slot_label = EXCLUDED.slot_label,
    type_key = EXCLUDED.type_key,
    price = EXCLUDED.price,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    created_at = EXCLUDED.created_at,
    refreshed_at = now();

  PERFORM public.pls_bump_catalog_version('parking');
END;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pls_trg_properties()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.pls_refresh_property(OLD.id);
    RETURN OLD;
  END IF;
  PERFORM public.pls_refresh_property(NEW.id);
  IF TG_OP = 'UPDATE' AND OLD.id IS DISTINCT FROM NEW.id THEN
    PERFORM public.pls_refresh_property(OLD.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pls_trg_property_child()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.pls_refresh_property(OLD.property_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.property_id IS DISTINCT FROM OLD.property_id) THEN
    PERFORM public.pls_refresh_property(NEW.property_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.pls_trg_developments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.pls_refresh_development(OLD.id);
    RETURN OLD;
  END IF;
  PERFORM public.pls_refresh_development(NEW.id);
  -- Property/parking development links resolve by name at query time; bump so cached
  -- property/parking responses pick up renamed or (de)activated developments.
  PERFORM public.pls_bump_catalog_version('property');
  PERFORM public.pls_bump_catalog_version('parking');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pls_trg_parkings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.pls_refresh_parking(OLD.id);
    RETURN OLD;
  END IF;
  PERFORM public.pls_refresh_parking(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pls_trg_parking_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.pls_refresh_parking(OLD.parking_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.parking_id IS DISTINCT FROM OLD.parking_id) THEN
    PERFORM public.pls_refresh_parking(NEW.parking_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS pls_properties_sync ON public.properties;
CREATE TRIGGER pls_properties_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.pls_trg_properties();

DROP TRIGGER IF EXISTS pls_app_settings_sync ON public.app_settings;
CREATE TRIGGER pls_app_settings_sync
  AFTER INSERT OR DELETE OR UPDATE OF property_id, weekday_nightly_rate, external_reviews
  ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.pls_trg_property_child();

DROP TRIGGER IF EXISTS pls_guest_reviews_sync ON public.guest_reviews;
CREATE TRIGGER pls_guest_reviews_sync
  AFTER INSERT OR DELETE OR UPDATE OF property_id, star_rating
  ON public.guest_reviews
  FOR EACH ROW EXECUTE FUNCTION public.pls_trg_property_child();

DROP TRIGGER IF EXISTS pls_developments_sync ON public.developments;
CREATE TRIGGER pls_developments_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.developments
  FOR EACH ROW EXECUTE FUNCTION public.pls_trg_developments();

DROP TRIGGER IF EXISTS pls_parkings_sync ON public.parkings;
CREATE TRIGGER pls_parkings_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.parkings
  FOR EACH ROW EXECUTE FUNCTION public.pls_trg_parkings();

DROP TRIGGER IF EXISTS pls_parking_settings_sync ON public.parking_settings;
CREATE TRIGGER pls_parking_settings_sync
  AFTER INSERT OR DELETE OR UPDATE OF parking_id, weekday_nightly_rate
  ON public.parking_settings
  FOR EACH ROW EXECUTE FUNCTION public.pls_trg_parking_settings();

-- ---------------------------------------------------------------------------
-- Search RPCs
--
-- Param object (all optional): see _shared/publicListingSearch.ts for the typed builder.
-- Text modes: 'none' | 'ilike' (browse `where`) | 'literal' | 'concept' (search-listings).
-- Facets are disjunctive: each dimension counts rows matching every *other* filter.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_public_properties(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text_mode text := COALESCE(p ->> 'textMode', 'none');
  v_q text := lower(public.pls_trim(COALESCE(p ->> 'q', '')));
  v_pat text;
  v_terms text[] := ARRAY(
    SELECT DISTINCT lower(public.pls_trim(x))
    FROM unnest(public.pls_jsonb_text_array(p -> 'terms')) AS x
    WHERE public.pls_trim(x) <> ''
  );
  v_term_res text[];
  v_terms_any text;
  v_q_re text;
  v_concept_types text[] := ARRAY(SELECT upper(x) FROM unnest(public.pls_jsonb_text_array(p -> 'conceptTypes')) AS x);
  v_types text[] := ARRAY(SELECT lower(x) FROM unnest(public.pls_jsonb_text_array(p -> 'types')) AS x);
  v_amenities text[] := ARRAY(SELECT public.pls_trim(x) FROM unnest(public.pls_jsonb_text_array(p -> 'amenities')) AS x);
  v_devs text[] := ARRAY(SELECT lower(x) FROM unnest(public.pls_jsonb_text_array(p -> 'developments')) AS x);
  v_min double precision := (p ->> 'minPrice')::double precision;
  v_max double precision := (p ->> 'maxPrice')::double precision;
  v_bed double precision := (p ->> 'bedrooms')::double precision;
  v_guests integer := COALESCE((p ->> 'guests')::integer, 0);
  v_place text := NULLIF(lower(public.pls_trim(COALESCE(p ->> 'placeSlug', ''))), '');
  v_lat double precision := (p ->> 'lat')::double precision;
  v_lng double precision := (p ->> 'lng')::double precision;
  v_radius double precision := COALESCE((p ->> 'radiusKm')::double precision, 120);
  v_sw_lat double precision := (p ->> 'swLat')::double precision;
  v_sw_lng double precision := (p ->> 'swLng')::double precision;
  v_ne_lat double precision := (p ->> 'neLat')::double precision;
  v_ne_lng double precision := (p ->> 'neLng')::double precision;
  v_check_in date := (p ->> 'checkIn')::date;
  v_check_out date := (p ->> 'checkOut')::date;
  v_order text := COALESCE(p ->> 'order', 'recommended');
  v_limit integer := LEAST(GREATEST(COALESCE((p ->> 'limit')::integer, 24), 0), 500);
  v_offset integer := GREATEST(COALESCE((p ->> 'offset')::integer, 0), 0);
  v_facets boolean := COALESCE((p ->> 'facets')::boolean, false);
  v_has_geo boolean;
  v_has_bbox boolean;
  v_has_dates boolean;
  result jsonb;
BEGIN
  v_has_geo := v_lat IS NOT NULL AND v_lng IS NOT NULL;
  v_has_bbox := v_sw_lat IS NOT NULL AND v_sw_lng IS NOT NULL AND v_ne_lat IS NOT NULL AND v_ne_lng IS NOT NULL;
  v_has_dates := v_check_in IS NOT NULL AND v_check_out IS NOT NULL AND v_check_in < v_check_out;
  IF v_text_mode IN ('ilike', 'literal') AND v_q <> '' THEN
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;
  v_q_re := public.pls_token_regex(v_q);
  v_term_res := ARRAY(SELECT public.pls_token_regex(t) FROM unnest(v_terms) WITH ORDINALITY AS u(t, ord) ORDER BY ord);
  -- One alternation regex = "any term is a substring of any field" (JS matchesExpandedTerms).
  v_terms_any := CASE WHEN cardinality(v_terms) > 0
    THEN '(' || array_to_string(ARRAY(SELECT public.pls_regex_escape(t) FROM unnest(v_terms) AS t), '|') || ')'
  END;

  WITH base AS MATERIALIZED (
    SELECT
      s.id,
      s.name,
      s.type_key,
      s.price,
      s.bedrooms,
      s.amenity_ids,
      s.rating,
      s.review_count,
      s.created_at,
      dev.slug AS dev_slug,
      dev.name AS dev_name,
      CASE WHEN v_has_geo THEN public.pls_haversine_km(v_lat, v_lng, s.lat, s.lng) END AS distance_km,
      CASE
        WHEN v_text_mode = 'literal' AND v_q <> ''
          THEN GREATEST(
            public.pls_field_rank(v_q, v_q_re, s.name),
            public.pls_field_rank(v_q, v_q_re, s.city),
            public.pls_field_rank(v_q, v_q_re, s.residence_name)
          )
        WHEN v_text_mode = 'concept'
          THEN (
            SELECT COALESCE(MAX(GREATEST(
              public.pls_field_rank(t.q, t.re, s.name),
              public.pls_field_rank(t.q, t.re, s.city),
              public.pls_field_rank(t.q, t.re, s.residence_name),
              (SELECT COALESCE(MAX(public.pls_field_rank(t.q, t.re, a)), 0) FROM unnest(s.amenity_ids) AS a)
            )), 0)
            FROM unnest(v_terms, v_term_res) AS t(q, re)
          )
        ELSE 0
      END AS text_rank
    FROM public.public_listing_search s
    LEFT JOIN (
      SELECT DISTINCT ON (lower(public.pls_trim(d.name)))
        lower(public.pls_trim(d.name)) AS name_key, d.slug, d.name
      FROM public.developments d
      WHERE d.status = 'ACTIVE'
      ORDER BY lower(public.pls_trim(d.name)), d.id DESC
    ) dev ON dev.name_key = s.residence_key
    WHERE s.family = 'property'
      AND (v_pat IS NULL OR s.name ILIKE v_pat OR s.city ILIKE v_pat OR s.residence_name ILIKE v_pat)
      AND (
        v_text_mode <> 'concept'
        OR upper(s.type_key) = ANY (v_concept_types)
        OR (
          v_terms_any IS NOT NULL
          AND lower(concat_ws(chr(31), s.name, s.city, s.residence_name, array_to_string(s.amenity_ids, chr(31)))) ~ v_terms_any
        )
      )
      AND (v_place IS NULL OR s.place_slug = v_place)
      AND (v_guests <= 0 OR s.capacity IS NULL OR s.capacity >= v_guests)
      AND (
        NOT v_has_geo
        OR (
          s.lat IS NOT NULL AND s.lng IS NOT NULL
          AND s.lat BETWEEN v_lat - v_radius / 111.0 AND v_lat + v_radius / 111.0
          AND public.pls_haversine_km(v_lat, v_lng, s.lat, s.lng) <= v_radius
        )
      )
      AND (
        NOT v_has_bbox
        OR (
          s.lat IS NOT NULL AND s.lng IS NOT NULL
          AND s.lat BETWEEN v_sw_lat AND v_ne_lat
          AND CASE WHEN v_sw_lng <= v_ne_lng
            THEN s.lng BETWEEN v_sw_lng AND v_ne_lng
            ELSE s.lng >= v_sw_lng OR s.lng <= v_ne_lng
          END
        )
      )
      AND (
        NOT v_has_dates
        OR (
          NOT EXISTS (
            SELECT 1 FROM public.guest_submissions g
            WHERE g.property_id = s.id
              AND g.status <> 'CANCELLED'
              AND g.check_in_date_sql < v_check_out
              AND g.check_out_date_sql > v_check_in
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.property_blocked_dates b
            WHERE b.property_id = s.id
              AND b.start_date < v_check_out
              AND b.end_date > v_check_in
          )
        )
      )
  ),
  flags AS MATERIALIZED (
    SELECT
      b.*,
      (cardinality(v_types) = 0 OR b.type_key = ANY (v_types)) AS m_type,
      ((v_min IS NULL OR b.price >= v_min) AND (v_max IS NULL OR b.price <= v_max)) AS m_price,
      (
        v_bed IS NULL
        OR (b.bedrooms IS NOT NULL AND CASE WHEN v_bed >= 5 THEN b.bedrooms >= 5 ELSE b.bedrooms = v_bed END)
      ) AS m_bed,
      (cardinality(v_amenities) = 0 OR b.amenity_ids @> v_amenities) AS m_amen,
      (cardinality(v_devs) = 0 OR lower(b.dev_slug) = ANY (v_devs)) AS m_dev
    FROM base b
  ),
  hits AS (
    SELECT * FROM flags WHERE m_type AND m_price AND m_bed AND m_amen AND m_dev
  ),
  page AS (
    SELECT id, distance_km
    FROM hits
    ORDER BY
      CASE WHEN v_order = 'nearest' THEN distance_km END ASC NULLS LAST,
      CASE WHEN v_order = 'rank' THEN text_rank END DESC,
      CASE WHEN v_order IN ('recommended', 'rating') THEN COALESCE(rating, 0) END DESC,
      CASE WHEN v_order IN ('recommended', 'rating', 'reviews') THEN review_count END DESC,
      CASE WHEN v_order = 'reviews' THEN COALESCE(rating, 0) END DESC,
      CASE WHEN v_order = 'newest' THEN created_at END DESC,
      CASE WHEN v_order IN ('recommended', 'name', 'rank', 'nearest') THEN lower(name) END ASC,
      distance_km ASC NULLS LAST,
      id
    LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM hits),
    'ids', COALESCE((SELECT jsonb_agg(id) FROM page), '[]'::jsonb),
    'facets', CASE WHEN v_facets THEN jsonb_build_object(
      'types', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('value', type_key, 'count', c) ORDER BY c DESC, type_key)
        FROM (
          SELECT type_key, count(*) AS c FROM flags
          WHERE m_price AND m_bed AND m_amen AND m_dev AND public.pls_trim(type_key) <> ''
          GROUP BY type_key
        ) x
      ), '[]'::jsonb),
      'price', (
        SELECT jsonb_build_object('min', COALESCE(min(price), 0), 'max', COALESCE(max(price), 0))
        FROM flags WHERE m_type AND m_bed AND m_amen AND m_dev
      ),
      'bedrooms', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('value', v, 'count', c) ORDER BY v)
        FROM (
          SELECT floor(bedrooms)::integer AS v, count(*) AS c FROM flags
          WHERE m_type AND m_price AND m_amen AND m_dev AND bedrooms IS NOT NULL
          GROUP BY floor(bedrooms)::integer
        ) x
      ), '[]'::jsonb),
      'amenities', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', a, 'count', c) ORDER BY c DESC, a)
        FROM (
          SELECT a, count(*) AS c FROM hits, unnest(amenity_ids) AS a GROUP BY a
        ) x
      ), '[]'::jsonb),
      'developments', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'count', c) ORDER BY c DESC, name)
        FROM (
          SELECT max(dev_slug) AS slug, max(dev_name) AS name, count(*) AS c FROM flags
          WHERE m_type AND m_price AND m_bed AND m_amen AND dev_slug IS NOT NULL
          GROUP BY lower(dev_slug)
        ) x
      ), '[]'::jsonb)
    ) END,
    'distances', CASE WHEN v_has_geo THEN COALESCE((
      SELECT jsonb_object_agg(id::text, distance_km) FROM page
    ), '{}'::jsonb) END
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_public_developments(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text_mode text := COALESCE(p ->> 'textMode', 'none');
  v_q text := lower(public.pls_trim(COALESCE(p ->> 'q', '')));
  v_pat text;
  v_terms text[] := ARRAY(
    SELECT DISTINCT lower(public.pls_trim(x))
    FROM unnest(public.pls_jsonb_text_array(p -> 'terms')) AS x
    WHERE public.pls_trim(x) <> ''
  );
  v_term_res text[];
  v_terms_any text;
  v_q_re text;
  v_concept_types text[] := ARRAY(SELECT upper(x) FROM unnest(public.pls_jsonb_text_array(p -> 'conceptTypes')) AS x);
  v_types text[] := ARRAY(SELECT upper(x) FROM unnest(public.pls_jsonb_text_array(p -> 'types')) AS x);
  v_cities text[] := ARRAY(SELECT lower(x) FROM unnest(public.pls_jsonb_text_array(p -> 'cities')) AS x);
  v_developers text[] := ARRAY(SELECT lower(x) FROM unnest(public.pls_jsonb_text_array(p -> 'developers')) AS x);
  v_slug text := NULLIF(lower(public.pls_trim(COALESCE(p ->> 'slug', ''))), '');
  v_min double precision := (p ->> 'minPrice')::double precision;
  v_max double precision := (p ->> 'maxPrice')::double precision;
  v_place text := NULLIF(lower(public.pls_trim(COALESCE(p ->> 'placeSlug', ''))), '');
  v_lat double precision := (p ->> 'lat')::double precision;
  v_lng double precision := (p ->> 'lng')::double precision;
  v_radius double precision := COALESCE((p ->> 'radiusKm')::double precision, 120);
  v_sw_lat double precision := (p ->> 'swLat')::double precision;
  v_sw_lng double precision := (p ->> 'swLng')::double precision;
  v_ne_lat double precision := (p ->> 'neLat')::double precision;
  v_ne_lng double precision := (p ->> 'neLng')::double precision;
  v_order text := COALESCE(p ->> 'order', 'recommended');
  v_limit integer := LEAST(GREATEST(COALESCE((p ->> 'limit')::integer, 24), 0), 500);
  v_offset integer := GREATEST(COALESCE((p ->> 'offset')::integer, 0), 0);
  v_facets boolean := COALESCE((p ->> 'facets')::boolean, false);
  v_has_geo boolean;
  v_has_bbox boolean;
  result jsonb;
BEGIN
  v_has_geo := v_lat IS NOT NULL AND v_lng IS NOT NULL;
  v_has_bbox := v_sw_lat IS NOT NULL AND v_sw_lng IS NOT NULL AND v_ne_lat IS NOT NULL AND v_ne_lng IS NOT NULL;
  IF v_text_mode IN ('ilike', 'literal') AND v_q <> '' THEN
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;
  v_q_re := public.pls_token_regex(v_q);
  v_term_res := ARRAY(SELECT public.pls_token_regex(t) FROM unnest(v_terms) WITH ORDINALITY AS u(t, ord) ORDER BY ord);
  -- One alternation regex = "any term is a substring of any field" (JS matchesExpandedTerms).
  v_terms_any := CASE WHEN cardinality(v_terms) > 0
    THEN '(' || array_to_string(ARRAY(SELECT public.pls_regex_escape(t) FROM unnest(v_terms) AS t), '|') || ')'
  END;

  WITH base AS MATERIALIZED (
    SELECT
      s.id,
      s.name,
      s.type_key,
      s.city,
      s.developer_name,
      s.price,
      s.price_max,
      s.created_at,
      CASE WHEN v_has_geo THEN public.pls_haversine_km(v_lat, v_lng, s.lat, s.lng) END AS distance_km,
      CASE
        WHEN v_text_mode = 'literal' AND v_q <> ''
          THEN GREATEST(
            public.pls_field_rank(v_q, v_q_re, s.name),
            public.pls_field_rank(v_q, v_q_re, s.city),
            public.pls_field_rank(v_q, v_q_re, s.location)
          )
        WHEN v_text_mode = 'concept'
          THEN (
            SELECT COALESCE(MAX(GREATEST(
              public.pls_field_rank(t.q, t.re, s.name),
              public.pls_field_rank(t.q, t.re, s.city),
              public.pls_field_rank(t.q, t.re, s.location)
            )), 0)
            FROM unnest(v_terms, v_term_res) AS t(q, re)
          )
        ELSE 0
      END AS text_rank
    FROM public.public_listing_search s
    WHERE s.family = 'development'
      AND (v_slug IS NULL OR lower(s.slug) = v_slug)
      AND (
        v_pat IS NULL
        OR s.name ILIKE v_pat OR s.city ILIKE v_pat OR s.location ILIKE v_pat
        OR (v_text_mode = 'ilike' AND s.developer_name ILIKE v_pat)
      )
      AND (
        v_text_mode <> 'concept'
        OR s.type_key = ANY (v_concept_types)
        OR (
          v_terms_any IS NOT NULL
          AND lower(concat_ws(chr(31), s.name, s.city, s.location)) ~ v_terms_any
        )
      )
      AND (v_place IS NULL OR s.place_slug = v_place)
      AND (
        NOT v_has_geo
        OR (
          s.lat IS NOT NULL AND s.lng IS NOT NULL
          AND s.lat BETWEEN v_lat - v_radius / 111.0 AND v_lat + v_radius / 111.0
          AND public.pls_haversine_km(v_lat, v_lng, s.lat, s.lng) <= v_radius
        )
      )
      AND (
        NOT v_has_bbox
        OR (
          s.lat IS NOT NULL AND s.lng IS NOT NULL
          AND s.lat BETWEEN v_sw_lat AND v_ne_lat
          AND CASE WHEN v_sw_lng <= v_ne_lng
            THEN s.lng BETWEEN v_sw_lng AND v_ne_lng
            ELSE s.lng >= v_sw_lng OR s.lng <= v_ne_lng
          END
        )
      )
  ),
  flags AS MATERIALIZED (
    SELECT
      b.*,
      (cardinality(v_types) = 0 OR b.type_key = ANY (v_types)) AS m_type,
      (cardinality(v_cities) = 0 OR lower(b.city) = ANY (v_cities)) AS m_city,
      (cardinality(v_developers) = 0 OR lower(b.developer_name) = ANY (v_developers)) AS m_developer,
      ((v_min IS NULL OR b.price_max >= v_min) AND (v_max IS NULL OR b.price <= v_max)) AS m_price
    FROM base b
  ),
  hits AS (
    SELECT * FROM flags WHERE m_type AND m_city AND m_developer AND m_price
  ),
  page AS (
    SELECT id, distance_km
    FROM hits
    ORDER BY
      CASE WHEN v_order = 'nearest' THEN distance_km END ASC NULLS LAST,
      CASE WHEN v_order = 'rank' THEN text_rank END DESC,
      CASE WHEN v_order IN ('recommended', 'newest') THEN created_at END DESC,
      CASE WHEN v_order IN ('recommended', 'name', 'rank', 'nearest') THEN lower(name) END ASC,
      distance_km ASC NULLS LAST,
      id
    LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM hits),
    'ids', COALESCE((SELECT jsonb_agg(id) FROM page), '[]'::jsonb),
    'facets', CASE WHEN v_facets THEN jsonb_build_object(
      'types', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('value', v, 'count', c) ORDER BY c DESC, v)
        FROM (
          SELECT public.pls_trim(type_key) AS v, count(*) AS c FROM flags
          WHERE m_city AND m_developer AND m_price AND public.pls_trim(type_key) <> ''
          GROUP BY public.pls_trim(type_key)
        ) x
      ), '[]'::jsonb),
      'cities', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('value', v, 'count', c) ORDER BY c DESC, v)
        FROM (
          SELECT public.pls_trim(city) AS v, count(*) AS c FROM flags
          WHERE m_type AND m_developer AND m_price AND public.pls_trim(COALESCE(city, '')) <> ''
          GROUP BY public.pls_trim(city)
        ) x
      ), '[]'::jsonb),
      'price', (
        SELECT jsonb_build_object('min', COALESCE(min(price), 0), 'max', COALESCE(max(price), 0))
        FROM flags WHERE m_type AND m_city AND m_developer
      ),
      'developers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('value', v, 'count', c) ORDER BY c DESC, v)
        FROM (
          SELECT public.pls_trim(developer_name) AS v, count(*) AS c FROM flags
          WHERE m_type AND m_city AND m_price AND public.pls_trim(COALESCE(developer_name, '')) <> ''
          GROUP BY public.pls_trim(developer_name)
        ) x
      ), '[]'::jsonb)
    ) END,
    'distances', CASE WHEN v_has_geo THEN COALESCE((
      SELECT jsonb_object_agg(id::text, distance_km) FROM page
    ), '{}'::jsonb) END
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_public_parkings(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text_mode text := COALESCE(p ->> 'textMode', 'none');
  v_q text := lower(public.pls_trim(COALESCE(p ->> 'q', '')));
  v_pat text;
  v_terms text[] := ARRAY(
    SELECT DISTINCT lower(public.pls_trim(x))
    FROM unnest(public.pls_jsonb_text_array(p -> 'terms')) AS x
    WHERE public.pls_trim(x) <> ''
  );
  v_term_res text[];
  v_terms_any text;
  v_q_re text;
  v_locations text[] := public.pls_jsonb_text_array(p -> 'locations');
  v_towers text[] := ARRAY(SELECT lower(x) FROM unnest(public.pls_jsonb_text_array(p -> 'towers')) AS x);
  v_dev_slug text := NULLIF(lower(public.pls_trim(COALESCE(p ->> 'developmentSlug', ''))), '');
  v_min double precision := (p ->> 'minPrice')::double precision;
  v_max double precision := (p ->> 'maxPrice')::double precision;
  v_place text := NULLIF(lower(public.pls_trim(COALESCE(p ->> 'placeSlug', ''))), '');
  v_lat double precision := (p ->> 'lat')::double precision;
  v_lng double precision := (p ->> 'lng')::double precision;
  v_radius double precision := COALESCE((p ->> 'radiusKm')::double precision, 120);
  v_sw_lat double precision := (p ->> 'swLat')::double precision;
  v_sw_lng double precision := (p ->> 'swLng')::double precision;
  v_ne_lat double precision := (p ->> 'neLat')::double precision;
  v_ne_lng double precision := (p ->> 'neLng')::double precision;
  v_check_in date := (p ->> 'checkIn')::date;
  v_check_out date := (p ->> 'checkOut')::date;
  v_order text := COALESCE(p ->> 'order', 'tower');
  v_limit integer := LEAST(GREATEST(COALESCE((p ->> 'limit')::integer, 24), 0), 500);
  v_offset integer := GREATEST(COALESCE((p ->> 'offset')::integer, 0), 0);
  v_facets boolean := COALESCE((p ->> 'facets')::boolean, false);
  v_has_geo boolean;
  v_has_bbox boolean;
  v_has_dates boolean;
  result jsonb;
BEGIN
  v_has_geo := v_lat IS NOT NULL AND v_lng IS NOT NULL;
  v_has_bbox := v_sw_lat IS NOT NULL AND v_sw_lng IS NOT NULL AND v_ne_lat IS NOT NULL AND v_ne_lng IS NOT NULL;
  v_has_dates := v_check_in IS NOT NULL AND v_check_out IS NOT NULL AND v_check_in < v_check_out;
  IF v_text_mode IN ('ilike', 'literal') AND v_q <> '' THEN
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;
  v_q_re := public.pls_token_regex(v_q);
  v_term_res := ARRAY(SELECT public.pls_token_regex(t) FROM unnest(v_terms) WITH ORDINALITY AS u(t, ord) ORDER BY ord);
  -- One alternation regex = "any term is a substring of any field" (JS matchesExpandedTerms).
  v_terms_any := CASE WHEN cardinality(v_terms) > 0
    THEN '(' || array_to_string(ARRAY(SELECT public.pls_regex_escape(t) FROM unnest(v_terms) AS t), '|') || ')'
  END;

  WITH base AS MATERIALIZED (
    SELECT
      s.id,
      s.name,
      s.type_key,
      s.tower,
      s.price,
      s.created_at,
      CASE WHEN v_has_geo THEN public.pls_haversine_km(v_lat, v_lng, s.lat, s.lng) END AS distance_km,
      CASE
        WHEN v_text_mode = 'literal' AND v_q <> ''
          THEN GREATEST(
            public.pls_field_rank(v_q, v_q_re, s.name),
            public.pls_field_rank(v_q, v_q_re, s.residence_name),
            public.pls_field_rank(v_q, v_q_re, s.tower),
            public.pls_field_rank(v_q, v_q_re, s.city)
          )
        WHEN v_text_mode = 'concept'
          THEN (
            SELECT COALESCE(MAX(GREATEST(
              public.pls_field_rank(t.q, t.re, s.name),
              public.pls_field_rank(t.q, t.re, s.residence_name),
              public.pls_field_rank(t.q, t.re, s.tower),
              public.pls_field_rank(t.q, t.re, s.city)
            )), 0)
            FROM unnest(v_terms, v_term_res) AS t(q, re)
          )
        ELSE 0
      END AS text_rank
    FROM public.public_listing_search s
    LEFT JOIN (
      SELECT DISTINCT ON (lower(public.pls_trim(d.name)))
        lower(public.pls_trim(d.name)) AS name_key, d.slug
      FROM public.developments d
      WHERE d.status = 'ACTIVE'
      ORDER BY lower(public.pls_trim(d.name)), d.id DESC
    ) dev ON dev.name_key = s.residence_key
    WHERE s.family = 'parking'
      AND (v_dev_slug IS NULL OR lower(COALESCE(dev.slug, s.residence_slug)) = v_dev_slug)
      AND (
        v_pat IS NULL
        OR s.name ILIKE v_pat OR s.residence_name ILIKE v_pat OR s.tower ILIKE v_pat
        OR (v_text_mode = 'ilike' AND s.slot_label ILIKE v_pat)
        OR (v_text_mode = 'literal' AND s.city ILIKE v_pat)
      )
      AND (
        v_text_mode <> 'concept'
        OR (
          v_terms_any IS NOT NULL
          AND lower(concat_ws(chr(31), s.name, s.residence_name, s.tower, s.city)) ~ v_terms_any
        )
      )
      AND (v_place IS NULL OR s.place_slug = v_place)
      AND (
        NOT v_has_geo
        OR (
          s.lat IS NOT NULL AND s.lng IS NOT NULL
          AND s.lat BETWEEN v_lat - v_radius / 111.0 AND v_lat + v_radius / 111.0
          AND public.pls_haversine_km(v_lat, v_lng, s.lat, s.lng) <= v_radius
        )
      )
      AND (
        NOT v_has_bbox
        OR (
          s.lat IS NOT NULL AND s.lng IS NOT NULL
          AND s.lat BETWEEN v_sw_lat AND v_ne_lat
          AND CASE WHEN v_sw_lng <= v_ne_lng
            THEN s.lng BETWEEN v_sw_lng AND v_ne_lng
            ELSE s.lng >= v_sw_lng OR s.lng <= v_ne_lng
          END
        )
      )
      AND (
        NOT v_has_dates
        OR (
          NOT EXISTS (
            SELECT 1 FROM public.guest_submissions g
            WHERE g.parking_id = s.id
              AND g.status <> 'CANCELLED'
              AND public.pls_flexible_date(g.parking_check_in_date) < v_check_out
              AND public.pls_flexible_date(g.parking_check_out_date) > v_check_in
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.parking_blocked_dates b
            WHERE b.parking_id = s.id
              AND b.start_date < v_check_out
              AND b.end_date > v_check_in
          )
        )
      )
  ),
  flags AS MATERIALIZED (
    SELECT
      b.*,
      (cardinality(v_locations) = 0 OR b.type_key = ANY (v_locations)) AS m_location,
      (cardinality(v_towers) = 0 OR (b.tower IS NOT NULL AND lower(b.tower) = ANY (v_towers))) AS m_tower,
      ((v_min IS NULL OR b.price >= v_min) AND (v_max IS NULL OR b.price <= v_max)) AS m_price
    FROM base b
  ),
  hits AS (
    SELECT * FROM flags WHERE m_location AND m_tower AND m_price
  ),
  page AS (
    SELECT id, distance_km
    FROM hits
    ORDER BY
      CASE WHEN v_order = 'nearest' THEN distance_km END ASC NULLS LAST,
      CASE WHEN v_order = 'rank' THEN text_rank END DESC,
      CASE WHEN v_order = 'tower' THEN COALESCE(tower, '') END ASC,
      CASE WHEN v_order = 'tower' THEN price END ASC,
      lower(name) ASC,
      distance_km ASC NULLS LAST,
      id
    LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM hits),
    'ids', COALESCE((SELECT jsonb_agg(id) FROM page), '[]'::jsonb),
    'facets', CASE WHEN v_facets THEN jsonb_build_object(
      'locations', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('value', type_key, 'count', c) ORDER BY c DESC, type_key)
        FROM (
          SELECT type_key, count(*) AS c FROM flags
          WHERE m_tower AND m_price AND public.pls_trim(COALESCE(type_key, '')) <> ''
          GROUP BY type_key
        ) x
      ), '[]'::jsonb),
      'towers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('value', v, 'count', c) ORDER BY c DESC, v)
        FROM (
          SELECT public.pls_trim(tower) AS v, count(*) AS c FROM flags
          WHERE m_location AND m_price AND type_key = 'inside_tower'
            AND public.pls_trim(COALESCE(tower, '')) <> ''
          GROUP BY public.pls_trim(tower)
        ) x
      ), '[]'::jsonb),
      'price', (
        SELECT jsonb_build_object('min', COALESCE(min(price), 0), 'max', COALESCE(max(price), 0))
        FROM flags WHERE m_location AND m_tower
      )
    ) END,
    'distances', CASE WHEN v_has_geo THEN COALESCE((
      SELECT jsonb_object_agg(id::text, distance_km) FROM page
    ), '{}'::jsonb) END
  )
  INTO result;

  RETURN result;
END;
$$;

-- Location rows for unfiltered browse: groups ordered by size then place, previews newest first.
CREATE OR REPLACE FUNCTION public.public_listing_place_groups(
  p_family text,
  p_group_offset integer,
  p_group_limit integer,
  p_preview_size integer
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH grouped AS (
    SELECT place_label, count(*) AS c
    FROM public.public_listing_search
    WHERE family = p_family
    GROUP BY place_label
  ),
  ordered AS (
    SELECT place_label, c, row_number() OVER (ORDER BY c DESC, place_label) AS rn
    FROM grouped
  ),
  selected AS (
    SELECT * FROM ordered
    WHERE rn > GREATEST(p_group_offset, 0)
      AND rn <= GREATEST(p_group_offset, 0) + LEAST(GREATEST(p_group_limit, 1), 50)
  )
  SELECT jsonb_build_object(
    'total', (SELECT COALESCE(sum(c), 0) FROM grouped),
    'groupTotal', (SELECT count(*) FROM grouped),
    'groups', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'place', sel.place_label,
          'locationSlug', public.pls_location_slug(sel.place_label),
          'total', sel.c,
          'ids', (
            SELECT COALESCE(jsonb_agg(pv.id ORDER BY pv.created_at DESC, pv.id::text), '[]'::jsonb)
            FROM (
              SELECT s.id, s.created_at
              FROM public.public_listing_search s
              WHERE s.family = p_family AND s.place_label = sel.place_label
              ORDER BY s.created_at DESC, s.id::text
              LIMIT LEAST(GREATEST(p_preview_size, 1), 50)
            ) pv
          )
        )
        ORDER BY sel.rn
      )
      FROM selected sel
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.public_listing_catalog_versions()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(family, version), '{}'::jsonb)
  FROM public.public_listing_catalog_version;
$$;

REVOKE ALL ON FUNCTION public.search_public_properties(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_public_developments(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_public_parkings(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_listing_place_groups(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_listing_catalog_versions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pls_refresh_property(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pls_refresh_development(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pls_refresh_parking(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pls_bump_catalog_version(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pls_trg_properties() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pls_trg_property_child() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pls_trg_developments() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pls_trg_parkings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pls_trg_parking_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_public_properties(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_public_developments(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_public_parkings(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_listing_place_groups(text, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_listing_catalog_versions() TO service_role;
GRANT SELECT ON public.public_listing_search TO service_role;
GRANT SELECT ON public.public_listing_catalog_version TO service_role;

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------

SELECT public.pls_refresh_property(id) FROM public.properties;
SELECT public.pls_refresh_development(id) FROM public.developments;
SELECT public.pls_refresh_parking(id) FROM public.parkings;
