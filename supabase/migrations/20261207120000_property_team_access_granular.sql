-- Phase 6: expand notifications:*/inbox:*/team:* umbrellas → leaf ids
-- on property_members, property_invitations, property_custom_roles (incl. saved_permissions).

CREATE OR REPLACE FUNCTION public._gfm_expand_access_phase6_permissions(raw jsonb)
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
    ELSIF item = 'notifications:edit' THEN
      result := result || ARRAY[
        'notifications.chat:edit',
        'notifications.marketing:edit',
        'notifications.staff:edit',
        'notifications.operations:edit',
        'notifications.finance:edit',
        'notifications.maintenance:edit'
      ];
    ELSIF item = 'inbox:reply' THEN
      result := result || ARRAY['inbox.messages:edit'];
    ELSIF item = 'inbox:manage' THEN
      result := result || ARRAY[
        'inbox.channels:add',
        'inbox.channels:delete',
        'inbox.quickReplies:add',
        'inbox.quickReplies:edit',
        'inbox.quickReplies:delete',
        'inbox.automation:edit'
      ];
    ELSIF item = 'team:invite' THEN
      result := result || ARRAY[
        'team.invitations:add',
        'team.invitations:edit',
        'team.invitations:delete'
      ];
    ELSIF item = 'team:manage' THEN
      result := result || ARRAY[
        'team.members:edit',
        'team.members:delete',
        'team.customRoles:add',
        'team.customRoles:edit',
        'team.customRoles:delete'
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
SET permissions = public._gfm_expand_access_phase6_permissions(permissions)
WHERE permissions IS NOT NULL
  AND (
    permissions @> '"notifications:edit"'::jsonb
    OR permissions @> '"inbox:reply"'::jsonb
    OR permissions @> '"inbox:manage"'::jsonb
    OR permissions @> '"team:invite"'::jsonb
    OR permissions @> '"team:manage"'::jsonb
  );

UPDATE property_members
SET saved_permissions = public._gfm_expand_access_phase6_permissions(saved_permissions)
WHERE saved_permissions IS NOT NULL
  AND (
    saved_permissions @> '"notifications:edit"'::jsonb
    OR saved_permissions @> '"inbox:reply"'::jsonb
    OR saved_permissions @> '"inbox:manage"'::jsonb
    OR saved_permissions @> '"team:invite"'::jsonb
    OR saved_permissions @> '"team:manage"'::jsonb
  );

UPDATE property_invitations
SET permissions = public._gfm_expand_access_phase6_permissions(permissions)
WHERE permissions IS NOT NULL
  AND (
    permissions @> '"notifications:edit"'::jsonb
    OR permissions @> '"inbox:reply"'::jsonb
    OR permissions @> '"inbox:manage"'::jsonb
    OR permissions @> '"team:invite"'::jsonb
    OR permissions @> '"team:manage"'::jsonb
  );

UPDATE property_custom_roles
SET permissions = public._gfm_expand_access_phase6_permissions(permissions)
WHERE permissions IS NOT NULL
  AND (
    permissions @> '"notifications:edit"'::jsonb
    OR permissions @> '"inbox:reply"'::jsonb
    OR permissions @> '"inbox:manage"'::jsonb
    OR permissions @> '"team:invite"'::jsonb
    OR permissions @> '"team:manage"'::jsonb
  );

DROP FUNCTION public._gfm_expand_access_phase6_permissions(jsonb);
