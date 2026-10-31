-- Phase 4: expand finance:edit / maintenance:edit / pricing:edit → leaf ids
-- on property_members, property_invitations, property_custom_roles (incl. saved_permissions).

CREATE OR REPLACE FUNCTION public._gfm_expand_ops_phase4_permissions(raw jsonb)
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
    ELSIF item = 'finance:edit' THEN
      result := result || ARRAY[
        'finance.transactions:add',
        'finance.transactions:edit',
        'finance.transactions:delete',
        'finance.export:view'
      ];
    ELSIF item = 'maintenance:edit' THEN
      result := result || ARRAY[
        'maintenance.reminders:add',
        'maintenance.reminders:edit',
        'maintenance.reminders:delete',
        'maintenance.export:view'
      ];
    ELSIF item = 'pricing:edit' THEN
      result := result || ARRAY[
        'pricing.rates:edit',
        'pricing.blocks:add',
        'pricing.blocks:delete'
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
SET permissions = public._gfm_expand_ops_phase4_permissions(permissions)
WHERE permissions IS NOT NULL
  AND (
    permissions @> '"finance:edit"'::jsonb
    OR permissions @> '"maintenance:edit"'::jsonb
    OR permissions @> '"pricing:edit"'::jsonb
  );

UPDATE property_members
SET saved_permissions = public._gfm_expand_ops_phase4_permissions(saved_permissions)
WHERE saved_permissions IS NOT NULL
  AND (
    saved_permissions @> '"finance:edit"'::jsonb
    OR saved_permissions @> '"maintenance:edit"'::jsonb
    OR saved_permissions @> '"pricing:edit"'::jsonb
  );

UPDATE property_invitations
SET permissions = public._gfm_expand_ops_phase4_permissions(permissions)
WHERE permissions IS NOT NULL
  AND (
    permissions @> '"finance:edit"'::jsonb
    OR permissions @> '"maintenance:edit"'::jsonb
    OR permissions @> '"pricing:edit"'::jsonb
  );

UPDATE property_custom_roles
SET permissions = public._gfm_expand_ops_phase4_permissions(permissions)
WHERE permissions IS NOT NULL
  AND (
    permissions @> '"finance:edit"'::jsonb
    OR permissions @> '"maintenance:edit"'::jsonb
    OR permissions @> '"pricing:edit"'::jsonb
  );

DROP FUNCTION public._gfm_expand_ops_phase4_permissions(jsonb);
