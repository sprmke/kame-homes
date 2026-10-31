-- Phase 7: grant Marketing Studio leaf ids on Full Access + Operations templates
-- and on members whose effective set matches those templates (former Manager/Staff).

CREATE OR REPLACE FUNCTION public._gfm_marketing_phase7_leaves()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'marketing:view',
    'marketing.content:add',
    'marketing.content:edit',
    'marketing.templates:add',
    'marketing.templates:edit',
    'marketing.templates:delete',
    'marketing.generate:add',
    'marketing.publish:add'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public._gfm_merge_marketing_leaves(raw jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  leaf text;
  result text[] := ARRAY[]::text[];
BEGIN
  IF raw IS NULL OR jsonb_typeof(raw) <> 'array' THEN
    raw := '[]'::jsonb;
  END IF;

  FOR leaf IN SELECT jsonb_array_elements_text(raw)
  LOOP
    leaf := btrim(leaf);
    IF leaf <> '' THEN
      result := result || ARRAY[leaf];
    END IF;
  END LOOP;

  FOREACH leaf IN ARRAY public._gfm_marketing_phase7_leaves()
  LOOP
    IF NOT leaf = ANY(result) THEN
      result := result || ARRAY[leaf];
    END IF;
  END LOOP;

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

-- Seeded templates: Full Access + Operations only (Read Only stays without Marketing).
UPDATE property_custom_roles
SET permissions = public._gfm_merge_marketing_leaves(permissions)
WHERE lower(btrim(name)) IN ('full access', 'operations')
  AND NOT permissions @> '"marketing:view"'::jsonb;

-- Members assigned to those templates.
UPDATE property_members pm
SET permissions = public._gfm_merge_marketing_leaves(pm.permissions)
FROM property_custom_roles pcr
WHERE pm.status = 'active'
  AND pm.role_id = pcr.id::text
  AND lower(btrim(pcr.name)) IN ('full access', 'operations')
  AND NOT pm.permissions @> '"marketing:view"'::jsonb;

-- Heuristic fallback: former Manager (finance/settings/team manage) or Staff (create booking, no finance).
UPDATE property_members
SET permissions = public._gfm_merge_marketing_leaves(permissions)
WHERE status = 'active'
  AND NOT permissions @> '"marketing:view"'::jsonb
  AND (
    permissions @> '"finance:view"'::jsonb
    OR permissions @> '"bookings.import:add"'::jsonb
    OR permissions @> '"team.members:edit"'::jsonb
    OR permissions @> '"settings.basicInfo:edit"'::jsonb
    OR (
      permissions @> '"bookings.create:add"'::jsonb
      AND NOT permissions @> '"team:view"'::jsonb
    )
  );

UPDATE property_invitations pi
SET permissions = public._gfm_merge_marketing_leaves(pi.permissions)
FROM property_custom_roles pcr
WHERE pi.role_id = pcr.id::text
  AND lower(btrim(pcr.name)) IN ('full access', 'operations')
  AND NOT pi.permissions @> '"marketing:view"'::jsonb;

DROP FUNCTION public._gfm_merge_marketing_leaves(jsonb);
DROP FUNCTION public._gfm_marketing_phase7_leaves();
