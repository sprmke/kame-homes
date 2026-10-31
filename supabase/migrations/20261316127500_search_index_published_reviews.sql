-- Two-way reviews: the public listing search index must only count published,
-- non-removed guest_reviews (gap: it previously summed every row regardless of
-- the new submitted/published/removed lifecycle). CREATE OR REPLACE — never
-- edit the shipped 20261316126800_public_listing_search_index.sql.

BEGIN;

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

  -- Two-way reviews: only published, non-removed reviews count toward the public rating.
  SELECT COALESCE(SUM(g.star_rating), 0), COUNT(*)
  INTO guest_sum, guest_count
  FROM public.guest_reviews g
  WHERE g.property_id = p_id AND g.status = 'published';

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

-- Re-fire the refresh trigger on the new lifecycle columns too (publish / removal
-- must update the public rating immediately, not just a star_rating edit).
DROP TRIGGER IF EXISTS pls_guest_reviews_sync ON public.guest_reviews;
CREATE TRIGGER pls_guest_reviews_sync
  AFTER INSERT OR DELETE OR UPDATE OF property_id, star_rating, status, published_at, removed_at
  ON public.guest_reviews
  FOR EACH ROW EXECUTE FUNCTION public.pls_trg_property_child();

-- One-off: recompute every property row now that published-only counts differ
-- from the prior all-rows count (legacy rows were already backfilled to
-- status='published' by 20261316127300, so this is a no-op in practice, but
-- cheap insurance against drift).
DO $$
DECLARE
  prop_id uuid;
BEGIN
  FOR prop_id IN SELECT id FROM public.properties WHERE status = 'ACTIVE' LOOP
    PERFORM public.pls_refresh_property(prop_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.pls_refresh_property(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
