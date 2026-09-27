-- Team permissions: backfill the leaves split out of existing ones so nobody loses access.
--
-- New property leaves:  marketing.generate.image:add, pricing.smartPricing:edit,
--                       analytics.aiReview:add, assistant:view, activity:view
-- New parking leaf:     activity:view
-- New org leaf:         org.activity:view
--
-- Rule: a stored permission array that holds the "source" leaf also gets the new leaf.
-- Roles that never had the source leaf are untouched. Read-time expansion is NOT used here
-- (unlike the Phase 3-6 umbrella ids) because the new leaves must stay individually revocable.

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
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['marketing.generate:add'], 'marketing.generate.image:add'),
    saved_permissions = public._gfm_grant_leaf_if_has(saved_permissions, ARRAY['marketing.generate:add'], 'marketing.generate.image:add');
UPDATE public.property_custom_roles
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['marketing.generate:add'], 'marketing.generate.image:add');
UPDATE public.property_invitations
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['marketing.generate:add'], 'marketing.generate.image:add');

UPDATE public.property_members
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['pricing.rates:edit'], 'pricing.smartPricing:edit'),
    saved_permissions = public._gfm_grant_leaf_if_has(saved_permissions, ARRAY['pricing.rates:edit'], 'pricing.smartPricing:edit');
UPDATE public.property_custom_roles
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['pricing.rates:edit'], 'pricing.smartPricing:edit');
UPDATE public.property_invitations
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['pricing.rates:edit'], 'pricing.smartPricing:edit');

-- AI review spends credits: only roles that already export analytics (Full Access style) keep it.
UPDATE public.property_members
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['analytics:export'], 'analytics.aiReview:add'),
    saved_permissions = public._gfm_grant_leaf_if_has(saved_permissions, ARRAY['analytics:export'], 'analytics.aiReview:add');
UPDATE public.property_custom_roles
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['analytics:export'], 'analytics.aiReview:add');
UPDATE public.property_invitations
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['analytics:export'], 'analytics.aiReview:add');

-- Assistant + Activity were open to every member who could see bookings.
UPDATE public.property_members
SET permissions = public._gfm_grant_leaf_if_has(
      public._gfm_grant_leaf_if_has(permissions, ARRAY['bookings:view'], 'assistant:view'),
      ARRAY['bookings:view'], 'activity:view'),
    saved_permissions = public._gfm_grant_leaf_if_has(
      public._gfm_grant_leaf_if_has(saved_permissions, ARRAY['bookings:view'], 'assistant:view'),
      ARRAY['bookings:view'], 'activity:view');
UPDATE public.property_custom_roles
SET permissions = public._gfm_grant_leaf_if_has(
      public._gfm_grant_leaf_if_has(permissions, ARRAY['bookings:view'], 'assistant:view'),
      ARRAY['bookings:view'], 'activity:view');
UPDATE public.property_invitations
SET permissions = public._gfm_grant_leaf_if_has(
      public._gfm_grant_leaf_if_has(permissions, ARRAY['bookings:view'], 'assistant:view'),
      ARRAY['bookings:view'], 'activity:view');

-- Parking scope -----------------------------------------------------------------------------

UPDATE public.parking_members
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['bookings:view'], 'activity:view'),
    saved_permissions = public._gfm_grant_leaf_if_has(saved_permissions, ARRAY['bookings:view'], 'activity:view');
UPDATE public.parking_custom_roles
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['bookings:view'], 'activity:view');
UPDATE public.parking_invitations
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['bookings:view'], 'activity:view');

-- Org scope (accepts the legacy colon id too) ------------------------------------------------

UPDATE public.organization_members
SET permissions = public._gfm_grant_leaf_if_has(
      permissions, ARRAY['org.dashboard:view', 'org:dashboard:view'], 'org.activity:view');
UPDATE public.organization_custom_roles
SET permissions = public._gfm_grant_leaf_if_has(
      permissions, ARRAY['org.dashboard:view', 'org:dashboard:view'], 'org.activity:view');
UPDATE public.organization_invitations
SET permissions = public._gfm_grant_leaf_if_has(
      permissions, ARRAY['org.dashboard:view', 'org:dashboard:view'], 'org.activity:view');

DROP FUNCTION public._gfm_grant_leaf_if_has(jsonb, text[], text);
