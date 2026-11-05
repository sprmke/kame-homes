-- Marketing media: "used in" counts for the delete warning, and last-used tracking.
-- Service role only; edge functions are the access layer (see marketing_media_assets).

-- How many saved designs (not deleted) of a property mention each asset id. Matching the id text
-- is deliberate: clips store `assetId`, and storage URLs carry the id in their path, so one scan
-- covers both. Counts designs, not clips.
CREATE OR REPLACE FUNCTION public.marketing_media_used_in(p_property_id UUID, p_ids UUID[])
RETURNS TABLE (asset_id UUID, uses INTEGER)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT wanted.id, COUNT(t.id)::INTEGER
  FROM unnest(p_ids) AS wanted(id)
  LEFT JOIN public.marketing_templates t
    ON t.property_id = p_property_id
   AND t.deleted_at IS NULL
   AND t.content_type IN ('video', 'design')
   AND t.design_json::TEXT LIKE '%' || wanted.id::TEXT || '%'
  GROUP BY wanted.id;
$$;

REVOKE ALL ON FUNCTION public.marketing_media_used_in(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_media_used_in(UUID, UUID[]) TO service_role;

-- Stamp assets a saved design references. Skips rows touched within the hour so a busy autosave
-- does not rewrite the same rows over and over.
CREATE OR REPLACE FUNCTION public.marketing_media_touch(p_property_id UUID, p_ids UUID[])
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.marketing_media_assets
  SET last_used_at = now()
  WHERE property_id = p_property_id
    AND id = ANY (p_ids)
    AND status = 'ready'
    AND (last_used_at IS NULL OR last_used_at < now() - INTERVAL '1 hour');
$$;

REVOKE ALL ON FUNCTION public.marketing_media_touch(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_media_touch(UUID, UUID[]) TO service_role;
