-- Super-admin Hosts list: server-side search + pagination over org owners.
--
-- "Hosts" are distinct organizations.owner_id values enriched with the owner's
-- auth.users profile (name/email/avatar). PostgREST does not expose auth.users,
-- and name/email search can't be pushed down to a `.ilike()` on `organizations`
-- since those fields live on the auth user, not the org row. A SECURITY DEFINER
-- RPC lets us join organizations -> auth.users and filter/paginate in SQL instead
-- of fetching every host into the edge function and filtering in memory.

CREATE OR REPLACE FUNCTION public.super_admin_search_hosts(
  search_query TEXT DEFAULT NULL,
  page_limit INT DEFAULT 31,
  page_offset INT DEFAULT 0
)
RETURNS TABLE (
  owner_id UUID,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  organization_count BIGINT,
  property_count BIGINT,
  parking_count BIGINT,
  member_since TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH escaped_search AS (
    -- Escape ILIKE wildcards (%, _) in the raw query so "50%" or "a_b" search
    -- literally instead of acting as pattern wildcards.
    SELECT
      CASE
        WHEN search_query IS NULL OR TRIM(search_query) = '' THEN NULL
        ELSE
          '%' || REPLACE(REPLACE(REPLACE(TRIM(search_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      END AS pattern
  ),
  host_orgs AS (
    SELECT
      o.owner_id,
      COUNT(*) AS organization_count,
      MIN(o.created_at) AS member_since
    FROM public.organizations o
    GROUP BY o.owner_id
  ),
  host_properties AS (
    SELECT o.owner_id, COUNT(p.id) AS property_count
    FROM public.organizations o
    LEFT JOIN public.properties p ON p.organization_id = o.id
    GROUP BY o.owner_id
  ),
  host_parking AS (
    SELECT o.owner_id, COUNT(pk.id) AS parking_count
    FROM public.organizations o
    LEFT JOIN public.parkings pk ON pk.organization_id = o.id
    GROUP BY o.owner_id
  ),
  hosts AS (
    SELECT
      ho.owner_id,
      COALESCE(
        NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''),
        NULLIF(TRIM(u.raw_user_meta_data ->> 'name'), ''),
        NULLIF(SPLIT_PART(u.email, '@', 1), ''),
        'Host'
      ) AS full_name,
      COALESCE(u.email, '') AS email,
      COALESCE(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') AS avatar_url,
      ho.organization_count,
      COALESCE(hp.property_count, 0) AS property_count,
      COALESCE(hpk.parking_count, 0) AS parking_count,
      ho.member_since
    FROM host_orgs ho
    JOIN auth.users u ON u.id = ho.owner_id
    LEFT JOIN host_properties hp ON hp.owner_id = ho.owner_id
    LEFT JOIN host_parking hpk ON hpk.owner_id = ho.owner_id
  )
  SELECT
    h.owner_id,
    h.full_name,
    h.email,
    h.avatar_url,
    h.organization_count,
    h.property_count,
    h.parking_count,
    h.member_since,
    COUNT(*) OVER () AS total_count
  FROM hosts h, escaped_search
  WHERE
    escaped_search.pattern IS NULL
    OR h.full_name ILIKE escaped_search.pattern ESCAPE '\'
    OR h.email ILIKE escaped_search.pattern ESCAPE '\'
  ORDER BY LOWER(h.full_name) ASC, h.owner_id ASC
  LIMIT GREATEST(page_limit, 0)
  OFFSET GREATEST(page_offset, 0);
$$;

COMMENT ON FUNCTION public.super_admin_search_hosts(TEXT, INT, INT) IS
  'Super-admin only. Paginated, searchable host list — joins organizations (grouped by owner_id) with auth.users so name/email search can run in SQL instead of loading every host into the edge function.';

REVOKE ALL ON FUNCTION public.super_admin_search_hosts(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_search_hosts(TEXT, INT, INT) TO service_role;
