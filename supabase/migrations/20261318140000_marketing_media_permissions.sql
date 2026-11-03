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
-- Reuses `_gfm_grant_leaf_if_has` from 20261316125000_team_permissions_plan_coverage_leaves.sql.

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
