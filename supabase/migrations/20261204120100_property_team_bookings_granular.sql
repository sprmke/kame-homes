-- Phase 3: expand bookings:edit / bookings:workflow / import:manage → leaf ids
-- on property_members, property_invitations, property_custom_roles (incl. saved_permissions).

CREATE OR REPLACE FUNCTION public._gfm_expand_bookings_phase3_permissions(raw jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  item text;
  result text[] := ARRAY[]::text[];
  seen text[] := ARRAY[]::text[];
BEGIN
  IF raw IS NULL OR jsonb_typeof(raw) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR item IN SELECT jsonb_array_elements_text(raw)
  LOOP
    item := btrim(item);
    IF item = '' THEN
      CONTINUE;
    ELSIF item = 'bookings:edit' THEN
      result := result || ARRAY[
        'bookings.create:add',
        'bookings.detail.stay:edit',
        'bookings.detail.guests:edit',
        'bookings.detail.parking:edit',
        'bookings.detail.pets:edit',
        'bookings.detail.pricing:edit'
      ];
    ELSIF item = 'bookings:workflow' THEN
      result := result || ARRAY['bookings.detail.workflow:edit'];
    ELSIF item = 'import:manage' THEN
      result := result || ARRAY['bookings.import:add'];
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
SET permissions = public._gfm_expand_bookings_phase3_permissions(permissions)
WHERE permissions IS NOT NULL
  AND (
    permissions @> '"bookings:edit"'::jsonb
    OR permissions @> '"bookings:workflow"'::jsonb
    OR permissions @> '"import:manage"'::jsonb
  );

UPDATE property_members
SET saved_permissions = public._gfm_expand_bookings_phase3_permissions(saved_permissions)
WHERE saved_permissions IS NOT NULL
  AND (
    saved_permissions @> '"bookings:edit"'::jsonb
    OR saved_permissions @> '"bookings:workflow"'::jsonb
    OR saved_permissions @> '"import:manage"'::jsonb
  );

UPDATE property_invitations
SET permissions = public._gfm_expand_bookings_phase3_permissions(permissions)
WHERE permissions IS NOT NULL
  AND (
    permissions @> '"bookings:edit"'::jsonb
    OR permissions @> '"bookings:workflow"'::jsonb
    OR permissions @> '"import:manage"'::jsonb
  );

UPDATE property_custom_roles
SET permissions = public._gfm_expand_bookings_phase3_permissions(permissions)
WHERE permissions IS NOT NULL
  AND (
    permissions @> '"bookings:edit"'::jsonb
    OR permissions @> '"bookings:workflow"'::jsonb
    OR permissions @> '"import:manage"'::jsonb
  );

DROP FUNCTION public._gfm_expand_bookings_phase3_permissions(jsonb);
