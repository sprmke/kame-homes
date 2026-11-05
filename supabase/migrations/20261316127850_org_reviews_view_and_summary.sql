-- Org Reviews rollup: org.reviews:view leaf + org_review_summary RPC.
-- Grant the leaf to anyone who already had org.bookings:view (or the legacy colon id).

BEGIN;

CREATE OR REPLACE FUNCTION public._gfm_grant_leaf_if_has(
  raw jsonb,
  source_leaves text[],
  new_leaf text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF raw IS NULL OR jsonb_typeof(raw) <> 'array' THEN
    RETURN raw;
  END IF;
  IF raw ? new_leaf THEN
    RETURN raw;
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(source_leaves) AS s(leaf) WHERE raw ? s.leaf
  ) THEN
    RETURN raw || to_jsonb(new_leaf);
  END IF;
  RETURN raw;
END;
$$;

UPDATE public.organization_members
SET permissions = public._gfm_grant_leaf_if_has(
      permissions, ARRAY['org.bookings:view', 'org:bookings:view'], 'org.reviews:view'),
    saved_permissions = public._gfm_grant_leaf_if_has(
      saved_permissions, ARRAY['org.bookings:view', 'org:bookings:view'], 'org.reviews:view');
UPDATE public.organization_custom_roles
SET permissions = public._gfm_grant_leaf_if_has(
      permissions, ARRAY['org.bookings:view', 'org:bookings:view'], 'org.reviews:view');
UPDATE public.organization_invitations
SET permissions = public._gfm_grant_leaf_if_has(
      permissions, ARRAY['org.bookings:view', 'org:bookings:view'], 'org.reviews:view');

DROP FUNCTION public._gfm_grant_leaf_if_has(jsonb, text[], text);

CREATE OR REPLACE FUNCTION public.org_review_summary(p_organization_id UUID)
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
      WHEN COUNT(*) > 0 THEN ROUND(
        (COUNT(*) FILTER (WHERE response_text IS NOT NULL))::numeric / COUNT(*),
        2
      )
      ELSE 0
    END
  )
  INTO result
  FROM public.guest_reviews
  WHERE organization_id = p_organization_id AND status = 'published';

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.org_review_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_review_summary(UUID) TO service_role;

COMMENT ON FUNCTION public.org_review_summary(UUID) IS
  'Published-only org rollup: count, truncated avg, distribution, category avgs, response rate.';

COMMIT;
