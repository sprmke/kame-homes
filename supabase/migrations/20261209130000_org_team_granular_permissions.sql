-- Org team granular permissions + listing assignment (org hub leaves + all_listings flag).
-- Access-preserving: existing org ADMIN rows → full Operations-style preset + all_listings=true.

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS saved_permissions JSONB,
  ADD COLUMN IF NOT EXISTS all_listings BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listing_assignments JSONB;

ALTER TABLE public.organization_invitations
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS all_listings BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listing_assignments JSONB;

ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_permissions_array;

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_permissions_array CHECK (jsonb_typeof(permissions) = 'array');

ALTER TABLE public.organization_invitations
  DROP CONSTRAINT IF EXISTS organization_invitations_permissions_array;

ALTER TABLE public.organization_invitations
  ADD CONSTRAINT organization_invitations_permissions_array CHECK (jsonb_typeof(permissions) = 'array');

COMMENT ON COLUMN public.organization_members.permissions IS
  'Org hub leaf permission ids (JSON array). Listing modules use property_members / parking_members.';

COMMENT ON COLUMN public.organization_members.all_listings IS
  'When true, implicit full access to every org property/parking (current & future). When false, listing_assignments + materialized member rows gate access.';

COMMENT ON COLUMN public.organization_members.listing_assignments IS
  'Snapshot of property/parking assignment plan: { properties: [{ propertyId, roleId, permissions }], parkings: [...] }';

CREATE TABLE IF NOT EXISTS public.organization_custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_custom_roles_name_nonempty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT organization_custom_roles_permissions_array CHECK (jsonb_typeof(permissions) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_custom_roles_org_name_lower_unique
  ON public.organization_custom_roles (organization_id, lower(trim(name)));

CREATE INDEX IF NOT EXISTS idx_organization_custom_roles_organization_id
  ON public.organization_custom_roles (organization_id);

COMMENT ON TABLE public.organization_custom_roles IS
  'Named org hub permission templates (Full Access, Operations, Read Only, or custom).';

ALTER TABLE public.property_members
  ADD COLUMN IF NOT EXISTS assigned_via_org BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.parking_members
  ADD COLUMN IF NOT EXISTS assigned_via_org BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.property_members.assigned_via_org IS
  'True when membership was created from org team listing assignment — excluded from property pooled seat counts.';

COMMENT ON COLUMN public.parking_members.assigned_via_org IS
  'True when membership was created from org team listing assignment.';

DROP TRIGGER IF EXISTS update_organization_custom_roles_updated_at ON public.organization_custom_roles;
CREATE TRIGGER update_organization_custom_roles_updated_at
  BEFORE UPDATE ON public.organization_custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.organization_custom_roles ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.organization_custom_roles TO service_role;

-- Legacy coarse org ADMIN preset → granular hub leaves (matches ORG_ROLE_PERMISSIONS.ADMIN expansion).
UPDATE public.organization_members
SET
  permissions = '[
    "org.dashboard:view",
    "org.bookings:view",
    "org.properties:view",
    "org.properties:manage",
    "org.parkings:view",
    "org.parkings:manage",
    "org.team:view",
    "org.team.invitations:add",
    "org.team.invitations:edit",
    "org.team.invitations:delete",
    "org.team.members:edit",
    "org.team.members:delete",
    "org.import:manage"
  ]'::jsonb,
  all_listings = true
WHERE role_id = 'ADMIN'
  AND status = 'active'
  AND (permissions = '[]'::jsonb OR permissions IS NULL);

UPDATE public.organization_members
SET
  permissions = '[
    "org.dashboard:view",
    "org.bookings:view",
    "org.properties:view",
    "org.properties:manage",
    "org.parkings:view",
    "org.parkings:manage",
    "org.team:view",
    "org.team.invitations:add",
    "org.team.invitations:edit",
    "org.team.invitations:delete",
    "org.team.members:edit",
    "org.team.members:delete",
    "org.import:manage"
  ]'::jsonb,
  all_listings = true
WHERE role_id = 'ADMIN'
  AND status = 'inactive'
  AND plan_limited = true
  AND (permissions = '[]'::jsonb OR permissions IS NULL);

UPDATE public.organization_invitations
SET
  permissions = '[
    "org.dashboard:view",
    "org.bookings:view",
    "org.properties:view",
    "org.properties:manage",
    "org.parkings:view",
    "org.parkings:manage",
    "org.team:view",
    "org.team.invitations:add",
    "org.team.invitations:edit",
    "org.team.invitations:delete",
    "org.team.members:edit",
    "org.team.members:delete",
    "org.import:manage"
  ]'::jsonb,
  all_listings = true
WHERE role_id = 'ADMIN'
  AND status = 'pending'
  AND (permissions = '[]'::jsonb OR permissions IS NULL);

-- Seed org hub templates on every organization (idempotent by name).
INSERT INTO public.organization_custom_roles (organization_id, name, permissions)
SELECT o.id, seed.name, seed.permissions
FROM public.organizations o
CROSS JOIN (
  VALUES
    (
      'Full Access',
      '[
        "org.dashboard:view",
        "org.bookings:view",
        "org.properties:view",
        "org.properties:create",
        "org.properties:manage",
        "org.parkings:view",
        "org.parkings:create",
        "org.parkings:manage",
        "org.settings:view",
        "org.settings.basic:edit",
        "org.settings.socials:edit",
        "org.settings.aiPlatform:edit",
        "org.settings.aiAssistant:edit",
        "org.plans:view",
        "org.team:view",
        "org.team.invitations:add",
        "org.team.invitations:edit",
        "org.team.invitations:delete",
        "org.team.members:edit",
        "org.team.members:delete",
        "org.team.roles:add",
        "org.team.roles:edit",
        "org.team.roles:delete",
        "org.import:manage"
      ]'::jsonb
    ),
    (
      'Operations',
      '[
        "org.dashboard:view",
        "org.bookings:view",
        "org.properties:view",
        "org.properties:manage",
        "org.parkings:view",
        "org.parkings:manage",
        "org.team:view",
        "org.team.invitations:add",
        "org.team.invitations:edit",
        "org.team.invitations:delete",
        "org.team.members:edit",
        "org.team.members:delete",
        "org.import:manage"
      ]'::jsonb
    ),
    (
      'Read Only',
      '[
        "org.dashboard:view",
        "org.bookings:view",
        "org.properties:view",
        "org.parkings:view",
        "org.team:view",
        "org.plans:view"
      ]'::jsonb
    )
) AS seed(name, permissions)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.organization_custom_roles existing
  WHERE existing.organization_id = o.id
    AND lower(trim(existing.name)) = lower(trim(seed.name))
);
