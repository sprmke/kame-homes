-- Marketing media library: two leaves split out of the existing marketing ones.
--
--   marketing.media:add     uploads (reserve / finalize / abandon)
--   marketing.media:delete  remove / restore from the 7-day window
--
-- Uploads are content creation, so holders of `marketing.content:add` keep them; deleting or
-- restoring a library file is a destructive marketing action, so it follows
-- `marketing.content:edit`. Roles that never had the source leaves are untouched, and the new
-- leaves stay individually revocable (no read-time expansion).
--
-- The grant helper is created and dropped here, exactly like the earlier leaf migrations do:
-- it is a per-migration utility, not a permanent function.

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

-- Property scope ----------------------------------------------------------------------------

UPDATE public.property_members
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['marketing.content:add'], 'marketing.media:add'),
    saved_permissions = public._gfm_grant_leaf_if_has(saved_permissions, ARRAY['marketing.content:add'], 'marketing.media:add');
UPDATE public.property_custom_roles
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['marketing.content:add'], 'marketing.media:add');
UPDATE public.property_invitations
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['marketing.content:add'], 'marketing.media:add');

UPDATE public.property_members
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['marketing.content:edit'], 'marketing.media:delete'),
    saved_permissions = public._gfm_grant_leaf_if_has(saved_permissions, ARRAY['marketing.content:edit'], 'marketing.media:delete');
UPDATE public.property_custom_roles
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['marketing.content:edit'], 'marketing.media:delete');
UPDATE public.property_invitations
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['marketing.content:edit'], 'marketing.media:delete');

DROP FUNCTION public._gfm_grant_leaf_if_has(jsonb, text[], text);
