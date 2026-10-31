-- Property team RBAC v1: custom roles, members, invitations.
-- Org owner has implicit full access (no property_members row).
-- Edge functions enforce permissions via orgAuth + propertyTeamPermissions.ts.

-- ─── Custom roles (per property) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.property_custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT property_custom_roles_name_nonempty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT property_custom_roles_permissions_array CHECK (jsonb_typeof(permissions) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS property_custom_roles_property_name_lower_unique
  ON public.property_custom_roles (property_id, lower(trim(name)));

CREATE INDEX IF NOT EXISTS idx_property_custom_roles_property_id
  ON public.property_custom_roles (property_id);

COMMENT ON TABLE public.property_custom_roles IS
  'Named permission presets assignable like MANAGER/STAFF/VIEWER on one property.';

-- ─── Property members ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.property_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role_id TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  saved_permissions JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  invited_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT property_members_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT property_members_permissions_array CHECK (jsonb_typeof(permissions) = 'array'),
  CONSTRAINT property_members_saved_permissions_array CHECK (
    saved_permissions IS NULL OR jsonb_typeof(saved_permissions) = 'array'
  ),
  CONSTRAINT property_members_role_id_format CHECK (
    role_id IN ('MANAGER', 'STAFF', 'VIEWER')
    OR role_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS property_members_property_user_unique
  ON public.property_members (property_id, user_id);

CREATE INDEX IF NOT EXISTS idx_property_members_user_id
  ON public.property_members (user_id);

CREATE INDEX IF NOT EXISTS idx_property_members_property_status
  ON public.property_members (property_id, status);

COMMENT ON TABLE public.property_members IS
  'Property-scoped team access. Org owner is not stored here — full access is implicit.';
COMMENT ON COLUMN public.property_members.saved_permissions IS
  'Snapshot taken on deactivate; restored to permissions on activate.';

-- ─── Invitations ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.property_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_id TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT property_invitations_status_check CHECK (
    status IN ('pending', 'accepted', 'expired', 'cancelled')
  ),
  CONSTRAINT property_invitations_email_nonempty CHECK (char_length(trim(email)) > 0),
  CONSTRAINT property_invitations_permissions_array CHECK (jsonb_typeof(permissions) = 'array'),
  CONSTRAINT property_invitations_role_id_format CHECK (
    role_id IN ('MANAGER', 'STAFF', 'VIEWER')
    OR role_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  CONSTRAINT property_invitations_token_unique UNIQUE (token)
);

CREATE UNIQUE INDEX IF NOT EXISTS property_invitations_pending_property_email_unique
  ON public.property_invitations (property_id, lower(trim(email)))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_property_invitations_property_status
  ON public.property_invitations (property_id, status);

CREATE INDEX IF NOT EXISTS idx_property_invitations_token
  ON public.property_invitations (token);

COMMENT ON TABLE public.property_invitations IS
  'Pending property team invites. Accept via Google sign-in with matching email (edge function).';

-- ─── updated_at triggers ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_property_custom_roles_updated_at ON public.property_custom_roles;
CREATE TRIGGER update_property_custom_roles_updated_at
  BEFORE UPDATE ON public.property_custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_property_members_updated_at ON public.property_members;
CREATE TRIGGER update_property_members_updated_at
  BEFORE UPDATE ON public.property_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_property_invitations_updated_at ON public.property_invitations;
CREATE TRIGGER update_property_invitations_updated_at
  BEFORE UPDATE ON public.property_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS: service role via edge functions only ───────────────────────────────

ALTER TABLE public.property_custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_invitations ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.property_custom_roles TO service_role;
GRANT ALL ON public.property_members TO service_role;
GRANT ALL ON public.property_invitations TO service_role;
