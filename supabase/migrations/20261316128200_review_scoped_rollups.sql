-- Two-way reviews hardening: listing-scoped org rollups, accurate "to write"
-- counts, and keyset pagination for the host "To write" list.
-- Plan: docs/workflow/for-testing/two-way-reviews.md (Phase 8 review pass)
--
-- * review_summary_for_properties — published-only summary over a property set,
--   so org rollups honor org-member listing assignments (org_review_summary
--   always covered the whole org).
-- * review_stats_by_property — one grouped query instead of one RPC per property.
-- * host_review_due_counts — open windows (not expired, not published) with no
--   host review yet. The old count included windows the host already reviewed.
-- * host_reviews_to_write — same filter, ordered by (closes_at, booking_id) with
--   a keyset cursor. Same-day check-outs share closes_at, so a closes_at-only
--   cursor skipped rows.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_booking_review_windows_property_open
  ON public.booking_review_windows (property_id, closes_at, booking_id)
  WHERE published_at IS NULL;

CREATE OR REPLACE FUNCTION public.review_summary_for_properties(p_property_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'count', COUNT(*),
    'avgOverall', ROUND(AVG(star_rating)::numeric, 2),
    'distribution', jsonb_build_object(
      '1', COUNT(*) FILTER (WHERE star_rating = 1),
      '2', COUNT(*) FILTER (WHERE star_rating = 2),
      '3', COUNT(*) FILTER (WHERE star_rating = 3),
      '4', COUNT(*) FILTER (WHERE star_rating = 4),
      '5', COUNT(*) FILTER (WHERE star_rating = 5)
    ),
    'categoryAvgs', jsonb_build_object(
      'cleanliness', ROUND(AVG((category_ratings ->> 'cleanliness')::numeric), 2),
      'accuracy', ROUND(AVG((category_ratings ->> 'accuracy')::numeric), 2),
      'checkIn', ROUND(AVG((category_ratings ->> 'check_in')::numeric), 2),
      'communication', ROUND(AVG((category_ratings ->> 'communication')::numeric), 2),
      'location', ROUND(AVG((category_ratings ->> 'location')::numeric), 2),
      'value', ROUND(AVG((category_ratings ->> 'value')::numeric), 2)
    ),
    'categorySample', COUNT(*) FILTER (WHERE category_ratings ? 'cleanliness'),
    'responseRate', CASE
      WHEN COUNT(*) > 0 THEN ROUND(
        (COUNT(*) FILTER (WHERE response_text IS NOT NULL))::numeric / COUNT(*),
        2
      )
      ELSE 0
    END
  )
  INTO result
  FROM public.guest_reviews
  WHERE property_id = ANY (COALESCE(p_property_ids, ARRAY[]::UUID[]))
    AND status = 'published';

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.review_summary_for_properties(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_summary_for_properties(UUID[]) TO service_role;

CREATE OR REPLACE FUNCTION public.review_stats_by_property(p_property_ids UUID[])
RETURNS TABLE (
  property_id UUID,
  review_count BIGINT,
  avg_overall NUMERIC,
  response_rate NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.property_id,
    COUNT(*) AS review_count,
    ROUND(AVG(g.star_rating)::numeric, 2) AS avg_overall,
    ROUND((COUNT(*) FILTER (WHERE g.response_text IS NOT NULL))::numeric / COUNT(*), 2)
      AS response_rate
  FROM public.guest_reviews g
  WHERE g.property_id = ANY (COALESCE(p_property_ids, ARRAY[]::UUID[]))
    AND g.status = 'published'
  GROUP BY g.property_id;
$$;

REVOKE ALL ON FUNCTION public.review_stats_by_property(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_stats_by_property(UUID[]) TO service_role;

CREATE OR REPLACE FUNCTION public.host_review_due_counts(p_property_ids UUID[])
RETURNS TABLE (property_id UUID, due_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.property_id, COUNT(*) AS due_count
  FROM public.booking_review_windows w
  WHERE w.property_id = ANY (COALESCE(p_property_ids, ARRAY[]::UUID[]))
    AND w.published_at IS NULL
    AND w.closes_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.host_guest_reviews h WHERE h.booking_id = w.booking_id
    )
  GROUP BY w.property_id;
$$;

REVOKE ALL ON FUNCTION public.host_review_due_counts(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_review_due_counts(UUID[]) TO service_role;

CREATE OR REPLACE FUNCTION public.host_reviews_to_write(
  p_property_id UUID,
  p_after_closes_at TIMESTAMPTZ,
  p_after_booking_id UUID,
  p_limit INTEGER
)
RETURNS TABLE (booking_id UUID, closes_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.booking_id, w.closes_at
  FROM public.booking_review_windows w
  WHERE w.property_id = p_property_id
    AND w.published_at IS NULL
    AND w.closes_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.host_guest_reviews h WHERE h.booking_id = w.booking_id
    )
    AND (
      p_after_closes_at IS NULL
      OR (w.closes_at, w.booking_id) > (p_after_closes_at, COALESCE(p_after_booking_id, '00000000-0000-0000-0000-000000000000'::UUID))
    )
  ORDER BY w.closes_at, w.booking_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.host_reviews_to_write(UUID, TIMESTAMPTZ, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_reviews_to_write(UUID, TIMESTAMPTZ, UUID, INTEGER) TO service_role;

COMMIT;
