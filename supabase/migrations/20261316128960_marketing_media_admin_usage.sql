-- Marketing media: storage usage for the super-admin org hub and overview. Same accounting as
-- marketing_media_usage (pending and ready rows of upload sources). Service role only.

CREATE OR REPLACE FUNCTION public.marketing_media_org_usage(p_org_id UUID)
RETURNS TABLE (property_id UUID, property_name TEXT, used_bytes BIGINT, files BIGINT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    COALESCE(SUM(COALESCE(a.size_bytes, a.reserved_bytes)), 0)::BIGINT,
    COUNT(a.id)::BIGINT
  FROM public.properties p
  LEFT JOIN public.marketing_media_assets a
    ON a.property_id = p.id
   AND a.status IN ('pending', 'ready')
   AND a.source IN ('upload', 'legacy_upload', 'music_upload')
  WHERE p.organization_id = p_org_id
  GROUP BY p.id, p.name
  ORDER BY 3 DESC, p.name;
$$;

CREATE OR REPLACE FUNCTION public.marketing_media_platform_usage()
RETURNS TABLE (used_bytes BIGINT, files BIGINT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(COALESCE(size_bytes, reserved_bytes)), 0)::BIGINT,
    COUNT(*)::BIGINT
  FROM public.marketing_media_assets
  WHERE status IN ('pending', 'ready')
    AND source IN ('upload', 'legacy_upload', 'music_upload');
$$;

REVOKE ALL ON FUNCTION public.marketing_media_org_usage(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_media_org_usage(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.marketing_media_platform_usage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_media_platform_usage() TO service_role;
