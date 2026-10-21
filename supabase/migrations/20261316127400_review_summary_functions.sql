-- Two-way reviews: aggregate + atomic-publish SQL functions.
-- SECURITY DEFINER, revoked from PUBLIC — edge functions (service role) are the only callers.

BEGIN;

-- ---------------------------------------------------------------------------
-- property_review_summary — published guest_reviews only. Replaces the
-- truncated in-memory average (listPublicGuestReviews was capped at 20 rows).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.property_review_summary(p_property_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
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
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE response_text IS NOT NULL))::numeric / COUNT(*), 2)
      ELSE 0
    END
  )
  INTO result
  FROM public.guest_reviews
  WHERE property_id = p_property_id AND status = 'published';

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.property_review_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.property_review_summary(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- guest_reputation — published host_guest_reviews matched by account or
-- identity key (D6). Never includes internal_note.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guest_reputation(p_guest_user_id UUID, p_identity_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF p_guest_user_id IS NULL AND (p_identity_key IS NULL OR p_identity_key = '') THEN
    RETURN jsonb_build_object(
      'reviewCount', 0,
      'avgOverall', NULL,
      'categoryAvgs', '{}'::jsonb,
      'wouldHostAgainRate', NULL,
      'topStrengthTags', '[]'::jsonb,
      'topIssueTags', '[]'::jsonb,
      'lastStayAt', NULL
    );
  END IF;

  WITH matched AS (
    SELECT *
    FROM public.host_guest_reviews
    WHERE status = 'published'
      AND (
        (p_guest_user_id IS NOT NULL AND guest_user_id = p_guest_user_id)
        OR (p_identity_key IS NOT NULL AND p_identity_key <> '' AND guest_identity_key = p_identity_key)
      )
  ),
  strength AS (
    SELECT tag, COUNT(*) AS n
    FROM matched, unnest(strength_tags) AS tag
    GROUP BY tag
    ORDER BY n DESC
    LIMIT 5
  ),
  issue AS (
    SELECT tag, COUNT(*) AS n
    FROM matched, unnest(issue_tags) AS tag
    GROUP BY tag
    ORDER BY n DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'reviewCount', (SELECT COUNT(*) FROM matched),
    'avgOverall', (SELECT ROUND(AVG(overall_rating)::numeric, 2) FROM matched),
    'categoryAvgs', jsonb_build_object(
      'cleanliness', (SELECT ROUND(AVG(cleanliness_rating)::numeric, 2) FROM matched),
      'communication', (SELECT ROUND(AVG(communication_rating)::numeric, 2) FROM matched),
      'houseRules', (SELECT ROUND(AVG(house_rules_rating)::numeric, 2) FROM matched)
    ),
    'wouldHostAgainRate', (
      SELECT CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE would_host_again))::numeric / COUNT(*), 2)
      END
      FROM matched
    ),
    'topStrengthTags', COALESCE((SELECT jsonb_agg(tag) FROM strength), '[]'::jsonb),
    'topIssueTags', COALESCE((SELECT jsonb_agg(tag) FROM issue), '[]'::jsonb),
    'lastStayAt', (SELECT MAX(submitted_at) FROM matched)
  )
  INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.guest_reputation(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_reputation(UUID, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- publish_booking_reviews — atomic double-blind publish. Locks the window row
-- FOR UPDATE so two near-simultaneous submits can't each miss the other.
--
-- p_force = false (normal submit path): publishes only when BOTH sides have a
--   'submitted' row; otherwise no-op (still returns current readiness).
-- p_force = true (cron at window close): publishes whichever side exists,
--   closes the window regardless ('published' if both existed, else 'expired').
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.publish_booking_reviews(p_booking_id UUID, p_force BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.booking_review_windows%ROWTYPE;
  g public.guest_reviews%ROWTYPE;
  h public.host_guest_reviews%ROWTYPE;
  now_ts TIMESTAMPTZ := now();
  guest_ready BOOLEAN;
  host_ready BOOLEAN;
  guest_now_published BOOLEAN := FALSE;
  host_now_published BOOLEAN := FALSE;
BEGIN
  SELECT * INTO w FROM public.booking_review_windows WHERE booking_id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'window_not_found');
  END IF;

  IF w.published_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', TRUE, 'alreadyResolved', TRUE, 'publishedAt', w.published_at, 'closedReason', w.closed_reason
    );
  END IF;

  SELECT * INTO g FROM public.guest_reviews WHERE booking_id = p_booking_id;
  SELECT * INTO h FROM public.host_guest_reviews WHERE booking_id = p_booking_id;

  guest_ready := (g.id IS NOT NULL AND g.status = 'submitted');
  host_ready := (h.id IS NOT NULL AND h.status = 'submitted');

  IF guest_ready AND host_ready THEN
    guest_now_published := TRUE;
    host_now_published := TRUE;
  ELSIF p_force THEN
    guest_now_published := guest_ready;
    host_now_published := host_ready;
  END IF;

  IF guest_now_published THEN
    UPDATE public.guest_reviews SET status = 'published', published_at = now_ts WHERE id = g.id;
  END IF;
  IF host_now_published THEN
    UPDATE public.host_guest_reviews SET status = 'published', published_at = now_ts WHERE id = h.id;
  END IF;

  IF guest_now_published OR host_now_published OR p_force THEN
    UPDATE public.booking_review_windows
    SET
      published_at = now_ts,
      closed_reason = CASE WHEN guest_now_published AND host_now_published THEN 'published' ELSE 'expired' END
    WHERE booking_id = p_booking_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'alreadyResolved', FALSE,
    'guestPublished', guest_now_published,
    'hostPublished', host_now_published,
    'guestPending', (g.id IS NOT NULL AND NOT guest_now_published),
    'hostPending', (h.id IS NOT NULL AND NOT host_now_published),
    'windowClosed', (guest_now_published OR host_now_published OR p_force)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_booking_reviews(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_booking_reviews(UUID, BOOLEAN) TO service_role;

COMMIT;
