-- Parking team RBAC v1: members + invitations (STAFF / VIEWER only).
-- Org owner and org ADMIN have implicit full access (no parking_members row).
-- Edge functions enforce permissions via orgAuth + parkingTeamPermissions.ts.

-- ─── Parking members ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.parking_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parking_id UUID NOT NULL REFERENCES public.parkings (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role_id TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  saved_permissions JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  invited_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  display_name TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT parking_members_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT parking_members_permissions_array CHECK (jsonb_typeof(permissions) = 'array'),
  CONSTRAINT parking_members_saved_permissions_array CHECK (
    saved_permissions IS NULL OR jsonb_typeof(saved_permissions) = 'array'
  ),
  CONSTRAINT parking_members_role_id_format CHECK (role_id IN ('STAFF', 'VIEWER'))
);

CREATE UNIQUE INDEX IF NOT EXISTS parking_members_parking_user_unique
  ON public.parking_members (parking_id, user_id);

CREATE INDEX IF NOT EXISTS idx_parking_members_user_id
  ON public.parking_members (user_id);

CREATE INDEX IF NOT EXISTS idx_parking_members_parking_status
  ON public.parking_members (parking_id, status);

COMMENT ON TABLE public.parking_members IS
  'Parking-scoped team access. Org owner / org ADMIN are not stored here — full access is implicit.';
COMMENT ON COLUMN public.parking_members.saved_permissions IS
  'Snapshot taken on deactivate; restored to permissions on activate.';
COMMENT ON COLUMN public.parking_members.display_name IS
  'Operator-facing display name for this parking team member.';
COMMENT ON COLUMN public.parking_members.contact_phone IS
  'Operator contact phone for this parking team member.';

-- ─── Invitations ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.parking_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parking_id UUID NOT NULL REFERENCES public.parkings (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_id TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_name TEXT,
  contact_phone TEXT,
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT parking_invitations_status_check CHECK (
    status IN ('pending', 'accepted', 'expired', 'cancelled')
  ),
  CONSTRAINT parking_invitations_email_nonempty CHECK (char_length(trim(email)) > 0),
  CONSTRAINT parking_invitations_permissions_array CHECK (jsonb_typeof(permissions) = 'array'),
  CONSTRAINT parking_invitations_role_id_format CHECK (role_id IN ('STAFF', 'VIEWER')),
  CONSTRAINT parking_invitations_token_unique UNIQUE (token)
);

CREATE UNIQUE INDEX IF NOT EXISTS parking_invitations_pending_parking_email_unique
  ON public.parking_invitations (parking_id, lower(trim(email)))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_parking_invitations_parking_status
  ON public.parking_invitations (parking_id, status);

CREATE INDEX IF NOT EXISTS idx_parking_invitations_token
  ON public.parking_invitations (token);

COMMENT ON TABLE public.parking_invitations IS
  'Pending parking team invites. Accept via Google sign-in with matching email (edge function).';
COMMENT ON COLUMN public.parking_invitations.display_name IS
  'Display name pre-filled on accept into parking_members.display_name';
COMMENT ON COLUMN public.parking_invitations.contact_phone IS
  'Phone pre-filled on accept into parking_members.contact_phone';

-- ─── updated_at triggers ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_parking_members_updated_at ON public.parking_members;
CREATE TRIGGER update_parking_members_updated_at
  BEFORE UPDATE ON public.parking_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_parking_invitations_updated_at ON public.parking_invitations;
CREATE TRIGGER update_parking_invitations_updated_at
  BEFORE UPDATE ON public.parking_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS: service role via edge functions only ───────────────────────────────

ALTER TABLE public.parking_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_invitations ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.parking_members TO service_role;
GRANT ALL ON public.parking_invitations TO service_role;
