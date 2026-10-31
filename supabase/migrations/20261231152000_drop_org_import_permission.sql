-- Drop vestigial org hub import permission.
-- Booking CSV/Excel import is property-scoped (`bookings.import:add`) only;
-- there is no org-level import UI or endpoint.

CREATE OR REPLACE FUNCTION public._strip_org_import_permission(perms JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(elem))
      FROM jsonb_array_elements_text(COALESCE(perms, '[]'::jsonb)) AS elem
      WHERE elem NOT IN ('org.import:manage', 'org:import:manage')
    ),
    '[]'::jsonb
  );
$$;

UPDATE public.organization_custom_roles
SET permissions = public._strip_org_import_permission(permissions)
WHERE permissions @> '["org.import:manage"]'::jsonb
   OR permissions @> '["org:import:manage"]'::jsonb;

UPDATE public.organization_members
SET permissions = public._strip_org_import_permission(permissions)
WHERE permissions @> '["org.import:manage"]'::jsonb
   OR permissions @> '["org:import:manage"]'::jsonb;

UPDATE public.organization_invitations
SET permissions = public._strip_org_import_permission(permissions)
WHERE permissions @> '["org.import:manage"]'::jsonb
   OR permissions @> '["org:import:manage"]'::jsonb;

DROP FUNCTION public._strip_org_import_permission(JSONB);
