-- Server-side filtering, sorting, and pagination for the admin bookings list.
-- Plan: docs/workflow/planned/supabase-capacity-and-operational-readiness.md (Phase 3)
--
-- Before this function, org-wide lists and the default `status_priority` sort
-- fetched every matching row into the Edge Function isolate and paginated in
-- memory. That is O(tenant history) per request and the first path expected to
-- fail once a host accumulates tens of thousands of bookings.
--
-- This function returns exactly one page plus the filtered total. The sort
-- mirrors `_shared/bookingsListSort.ts` (keep both in sync):
--   * status priority order,
--   * nearest check-in first for PENDING_REVIEW / PENDING_DOCUMENTS,
--   * check-in date ascending, with missing dates first,
--   * created_at descending as the stable tie-break.
--
-- Missing or malformed check-in text produces a NULL `check_in_date_sql`;
-- NULLs sort as "empty" (first ascending, last descending), matching the
-- client helper's `''` fallback. Pass a trimmed `p_q`; the caller does.

CREATE OR REPLACE FUNCTION public.list_bookings_page(
  p_org_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_parking_id uuid DEFAULT NULL,
  p_property_ids uuid[] DEFAULT NULL,
  p_parking_ids uuid[] DEFAULT NULL,
  p_extra_booking_ids uuid[] DEFAULT NULL,
  p_booking_kind text DEFAULT NULL,
  p_q text DEFAULT NULL,
  p_status text[] DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_has_pets boolean DEFAULT NULL,
  p_need_parking boolean DEFAULT NULL,
  p_sort text DEFAULT 'status_priority:asc',
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 31,
  p_show_completed boolean DEFAULT false,
  p_expand_imported boolean DEFAULT false
)
RETURNS TABLE(rows jsonb, total bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
WITH scoped AS (
  SELECT gs.*
  FROM public.guest_submissions gs
  WHERE
    -- Single property scope.
    (p_property_id IS NOT NULL AND gs.property_id = p_property_id)
    -- Single parking scope, plus pre-claim broadcast candidates passed by id.
    OR (
      p_parking_id IS NOT NULL
      AND (
        gs.parking_id = p_parking_id
        OR (p_extra_booking_ids IS NOT NULL AND gs.id = ANY (p_extra_booking_ids))
      )
    )
    -- Org-wide scope: resolve the relation through its parent listing, never by
    -- materialising an id list (that breaks URI/payload limits at scale).
    OR (
      p_org_id IS NOT NULL
      AND (
        (
          p_booking_kind IS DISTINCT FROM 'parking'
          AND EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = gs.property_id AND p.organization_id = p_org_id
          )
        )
        OR (
          p_booking_kind IS DISTINCT FROM 'property'
          AND EXISTS (
            SELECT 1 FROM public.parkings k
            WHERE k.id = gs.parking_id AND k.organization_id = p_org_id
          )
        )
      )
    )
    -- Scoped admin: explicit assigned listing ids (small sets by design).
    OR (
      p_property_id IS NULL AND p_parking_id IS NULL AND p_org_id IS NULL
      AND (
        (p_property_ids IS NOT NULL AND gs.property_id = ANY (p_property_ids))
        OR (p_parking_ids IS NOT NULL AND gs.parking_id = ANY (p_parking_ids))
      )
    )
),
filtered AS (
  SELECT s.*
  FROM scoped s
  WHERE
    (p_booking_kind IS NULL
      OR (p_booking_kind = 'property' AND s.property_id IS NOT NULL)
      OR (p_booking_kind = 'parking' AND s.parking_id IS NOT NULL))
    AND (
      p_q IS NULL OR p_q = ''
      OR s.guest_facebook_name ILIKE '%' || p_q || '%'
      OR s.primary_guest_name ILIKE '%' || p_q || '%'
      OR s.guest_email ILIKE '%' || p_q || '%'
      OR s.guest_phone_number ILIKE '%' || p_q || '%'
      OR s.guest_address ILIKE '%' || p_q || '%'
      OR s.nationality ILIKE '%' || p_q || '%'
      OR s.guest2_name ILIKE '%' || p_q || '%'
      OR s.guest3_name ILIKE '%' || p_q || '%'
      OR s.guest4_name ILIKE '%' || p_q || '%'
      OR s.guest5_name ILIKE '%' || p_q || '%'
      OR s.pet_name ILIKE '%' || p_q || '%'
      OR s.pet_type ILIKE '%' || p_q || '%'
      OR s.pet_breed ILIKE '%' || p_q || '%'
      OR s.car_plate_number ILIKE '%' || p_q || '%'
      OR s.car_brand_model ILIKE '%' || p_q || '%'
      OR s.car_color ILIKE '%' || p_q || '%'
      OR s.guest_special_requests ILIKE '%' || p_q || '%'
      OR s.find_us_details ILIKE '%' || p_q || '%'
    )
    AND (
      p_status IS NULL OR cardinality(p_status) = 0
      OR s.status = ANY (p_status)
      OR (p_expand_imported AND 'IMPORTED' = ANY (p_status) AND s.imported_from_batch_id IS NOT NULL)
    )
    AND (p_has_pets IS NULL OR s.has_pets = p_has_pets)
    AND (p_need_parking IS NULL OR s.need_parking = p_need_parking)
    -- Date range: NULL -> open bound. Malformed text yields NULL and is
    -- excluded from a bounded range (same behaviour as the finance SQL path).
    AND (p_from IS NULL OR s.check_in_date_sql >= p_from)
    AND (p_to IS NULL OR s.check_in_date_sql <= p_to)
    -- Default visibility: cancelled/completed hidden unless explicitly asked for.
    AND (
      p_status IS NOT NULL AND 'CANCELLED' = ANY (p_status)
      OR s.status <> 'CANCELLED'
    )
    AND (
      p_show_completed
      OR (p_status IS NOT NULL AND 'COMPLETED' = ANY (p_status))
      OR s.status <> 'COMPLETED'
    )
),
counted AS (
  SELECT count(*)::bigint AS total FROM filtered
),
ordered AS (
  SELECT
    f.*,
    CASE WHEN p_sort = 'status_priority:asc' THEN
      CASE f.status
        WHEN 'PENDING_SD_REFUND' THEN 0
        WHEN 'PENDING_REVIEW' THEN 1
        WHEN 'PENDING_DOCUMENTS' THEN 2
        WHEN 'PENDING_GAF' THEN 3
        WHEN 'PENDING_PARKING_REQUEST' THEN 4
        WHEN 'PENDING_PET_REQUEST' THEN 5
        WHEN 'READY_FOR_CHECKOUT' THEN 6
        WHEN 'READY_FOR_CHECKIN' THEN 7
        WHEN 'COMPLETED' THEN 8
        WHEN 'CANCELLED' THEN 9
        WHEN 'IMPORTED' THEN 10
        ELSE 50
      END
    END AS sort_priority,
    CASE WHEN p_sort = 'status_priority:asc'
      AND f.status IN ('PENDING_REVIEW', 'PENDING_DOCUMENTS')
      THEN abs(
        coalesce(f.check_in_date_sql, DATE '9999-12-31')
        - (now() AT TIME ZONE 'Asia/Manila')::date
      )
    END AS sort_proximity,
    CASE WHEN p_sort IN ('status_priority:asc', 'check_in_date:asc')
      THEN coalesce(f.check_in_date_sql, DATE '0001-01-01')
    END AS sort_check_in_asc,
    CASE WHEN p_sort = 'check_in_date:desc'
      THEN coalesce(f.check_in_date_sql, DATE '9999-12-31')
    END AS sort_check_in_desc,
    CASE WHEN p_sort = 'created_at:asc' THEN f.created_at END AS sort_created_asc,
    CASE WHEN p_sort = 'created_at:desc' THEN f.created_at END AS sort_created_desc
  FROM filtered f
  ORDER BY
    sort_priority ASC,
    sort_proximity ASC,
    sort_check_in_asc ASC,
    sort_check_in_desc DESC,
    sort_created_asc ASC,
    sort_created_desc DESC,
    f.created_at DESC
  LIMIT greatest(p_limit, 1)
  OFFSET greatest(p_page - 1, 0) * greatest(p_limit, 1)
)
SELECT
  -- Aggregate ORDER BY is explicit: a CTE's physical row order is not a
  -- contract, and parallel plans can otherwise return an unordered page.
  coalesce(
    jsonb_agg(
      to_jsonb(o) - 'sort_priority' - 'sort_proximity' - 'sort_check_in_asc'
        - 'sort_check_in_desc' - 'sort_created_asc' - 'sort_created_desc'
      ORDER BY
        o.sort_priority ASC,
        o.sort_proximity ASC,
        o.sort_check_in_asc ASC,
        o.sort_check_in_desc DESC,
        o.sort_created_asc ASC,
        o.sort_created_desc DESC,
        o.created_at DESC
    ),
    '[]'::jsonb
  ),
  (SELECT total FROM counted)
FROM ordered o;
$fn$;

COMMENT ON FUNCTION public.list_bookings_page IS
  'One page of the admin bookings list plus the filtered total. Pushes filtering, '
  'sorting, and pagination into Postgres so a tenant history never materialises in '
  'the Edge Function. Sort order mirrors _shared/bookingsListSort.ts. service_role only.';

REVOKE ALL ON FUNCTION public.list_bookings_page(
  uuid, uuid, uuid, uuid[], uuid[], uuid[], text, text, text[], date, date, boolean, boolean, text, integer, integer, boolean, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_bookings_page(
  uuid, uuid, uuid, uuid[], uuid[], uuid[], text, text, text[], date, date, boolean, boolean, text, integer, integer, boolean, boolean
) TO service_role;
