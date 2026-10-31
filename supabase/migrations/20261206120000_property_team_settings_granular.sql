-- Phase 5: expand settings:*/templates:* umbrellas → leaf ids
-- on property_members, property_invitations, property_custom_roles (incl. saved_permissions).
-- Also refreshes seeded Operations / Read Only rows to include publicPages:view.

CREATE OR REPLACE FUNCTION public._gfm_expand_settings_phase5_permissions(raw jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  item text;
  result text[] := ARRAY[]::text[];
BEGIN
  IF raw IS NULL OR jsonb_typeof(raw) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR item IN SELECT jsonb_array_elements_text(raw)
  LOOP
    item := btrim(item);
    IF item = '' THEN
      CONTINUE;
    ELSIF item = 'settings:view' THEN
      result := result || ARRAY[
        'settings:view',
        'settings.integrations:view'
      ];
    ELSIF item = 'settings:edit' THEN
      result := result || ARRAY[
        'settings.basicInfo:edit',
        'settings.media:edit',
        'settings.propertyDetails:edit',
        'settings.amenities:edit',
        'settings.houseRules:edit',
        'settings.guestForm:edit',
        'settings.cancellationPolicy:edit',
        'settings.location:edit',
        'settings.socials:edit',
        'settings.payment:edit',
        'settings.buildingForms:edit',
        'settings.emailAutomations:edit',
        'settings.voiceReceptionist:edit',
        'settings.aiOverrides:edit',
        'settings.dangerZone:edit'
      ];
    ELSIF item = 'templates:view' THEN
      result := result || ARRAY[
        'templates:view',
        'publicPages:view'
      ];
    ELSIF item = 'templates:edit' THEN
      result := result || ARRAY[
        'templates.standard:edit',
        'templates.email:edit',
        'templates.custom:add',
        'templates.custom:edit',
        'templates.custom:delete',
        'publicPages.property:edit',
        'publicPages.stayGuide:edit'
      ];
    ELSE
      result := result || ARRAY[item];
    END IF;
  END LOOP;

  -- de-dupe preserving order
  SELECT COALESCE(array_agg(x ORDER BY ord), ARRAY[]::text[])
  INTO result
  FROM (
    SELECT x, min(ord) AS ord
    FROM unnest(result) WITH ORDINALITY AS t(x, ord)
    GROUP BY x
  ) d;

  RETURN to_jsonb(result);
END;
$$;

UPDATE property_members
SET permissions = public._gfm_expand_settings_phase5_permissions(permissions)
WHERE permissions IS NOT NULL
  AND (
    permissions @> '"settings:view"'::jsonb
    OR permissions @> '"settings:edit"'::jsonb
    OR permissions @> '"templates:view"'::jsonb
    OR permissions @> '"templates:edit"'::jsonb
  );

UPDATE property_members
SET saved_permissions = public._gfm_expand_settings_phase5_permissions(saved_permissions)
WHERE saved_permissions IS NOT NULL
  AND (
    saved_permissions @> '"settings:view"'::jsonb
    OR saved_permissions @> '"settings:edit"'::jsonb
    OR saved_permissions @> '"templates:view"'::jsonb
    OR saved_permissions @> '"templates:edit"'::jsonb
  );

UPDATE property_invitations
SET permissions = public._gfm_expand_settings_phase5_permissions(permissions)
WHERE permissions IS NOT NULL
  AND (
    permissions @> '"settings:view"'::jsonb
    OR permissions @> '"settings:edit"'::jsonb
    OR permissions @> '"templates:view"'::jsonb
    OR permissions @> '"templates:edit"'::jsonb
  );

UPDATE property_custom_roles
SET permissions = public._gfm_expand_settings_phase5_permissions(permissions)
WHERE permissions IS NOT NULL
  AND (
    permissions @> '"settings:view"'::jsonb
    OR permissions @> '"settings:edit"'::jsonb
    OR permissions @> '"templates:view"'::jsonb
    OR permissions @> '"templates:edit"'::jsonb
  );

DROP FUNCTION public._gfm_expand_settings_phase5_permissions(jsonb);
