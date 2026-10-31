-- Parking custom roles + widen role_id to match property team (MANAGER + custom UUID).

CREATE TABLE IF NOT EXISTS public.parking_custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parking_id UUID NOT NULL REFERENCES public.parkings (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT parking_custom_roles_name_nonempty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT parking_custom_roles_permissions_array CHECK (jsonb_typeof(permissions) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS parking_custom_roles_parking_name_lower_unique
  ON public.parking_custom_roles (parking_id, lower(trim(name)));

CREATE INDEX IF NOT EXISTS idx_parking_custom_roles_parking_id
  ON public.parking_custom_roles (parking_id);

COMMENT ON TABLE public.parking_custom_roles IS
  'Named permission presets assignable like MANAGER/STAFF/VIEWER on one parking slot.';

ALTER TABLE public.parking_members
  DROP CONSTRAINT IF EXISTS parking_members_role_id_format;

ALTER TABLE public.parking_members
  ADD CONSTRAINT parking_members_role_id_format CHECK (
    role_id IN ('MANAGER', 'STAFF', 'VIEWER')
    OR role_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

ALTER TABLE public.parking_invitations
  DROP CONSTRAINT IF EXISTS parking_invitations_role_id_format;

ALTER TABLE public.parking_invitations
  ADD CONSTRAINT parking_invitations_role_id_format CHECK (
    role_id IN ('MANAGER', 'STAFF', 'VIEWER')
    OR role_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

DROP TRIGGER IF EXISTS update_parking_custom_roles_updated_at ON public.parking_custom_roles;
CREATE TRIGGER update_parking_custom_roles_updated_at
  BEFORE UPDATE ON public.parking_custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.parking_custom_roles ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.parking_custom_roles TO service_role;
