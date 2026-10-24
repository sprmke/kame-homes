-- Org Reviews "To write" tab.
--
-- host_reviews_to_write covers one property. The org rollup needs the same open
-- windows across every listing the caller can see, in one query — looping the
-- per-property function would be one round trip per listing (up to 200).
-- Ordering matches the per-property function: (closes_at, booking_id), so
-- same-day check-outs stay stable. Searching, sorting and paging happen in the
-- handler, which caps the scan; the 14-day review window keeps the set small.
--
-- Uses idx_booking_review_windows_property_open (property_id, closes_at, booking_id)
-- from 20261316128200_review_scoped_rollups.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.host_reviews_to_write_for_properties(
  p_property_ids UUID[],
  p_limit INTEGER
)
RETURNS TABLE (booking_id UUID, property_id UUID, closes_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.booking_id, w.property_id, w.closes_at
  FROM public.booking_review_windows w
  WHERE w.property_id = ANY (COALESCE(p_property_ids, ARRAY[]::UUID[]))
    AND w.published_at IS NULL
    AND w.closes_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.host_guest_reviews h WHERE h.booking_id = w.booking_id
    )
  ORDER BY w.closes_at, w.booking_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
$$;

REVOKE ALL ON FUNCTION public.host_reviews_to_write_for_properties(UUID[], INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_reviews_to_write_for_properties(UUID[], INTEGER) TO service_role;

COMMIT;
