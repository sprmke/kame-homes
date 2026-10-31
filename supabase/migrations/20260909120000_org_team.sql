-- Org team v1: organization_members + organization_invitations.
-- Org owner (organizations.owner_id) has implicit full access — not stored in organization_members.
-- Edge functions enforce access via orgAuth + orgTeamService.ts.

CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role_id TEXT NOT NULL DEFAULT 'ADMIN',
  status TEXT NOT NULL DEFAULT 'active',
  invited_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_members_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT organization_members_role_id_check CHECK (role_id = 'ADMIN')
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_members_org_user_unique
  ON public.organization_members (organization_id, user_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id
  ON public.organization_members (user_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_org_status
  ON public.organization_members (organization_id, status);

COMMENT ON TABLE public.organization_members IS
  'Org-scoped team access. Org owner is not stored here — full access is implicit.';

CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_id TEXT NOT NULL DEFAULT 'ADMIN',
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_invitations_status_check CHECK (
    status IN ('pending', 'accepted', 'expired', 'cancelled')
  ),
  CONSTRAINT organization_invitations_email_nonempty CHECK (char_length(trim(email)) > 0),
  CONSTRAINT organization_invitations_role_id_check CHECK (role_id = 'ADMIN'),
  CONSTRAINT organization_invitations_token_unique UNIQUE (token)
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_pending_org_email_unique
  ON public.organization_invitations (organization_id, lower(trim(email)))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_status
  ON public.organization_invitations (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_organization_invitations_token
  ON public.organization_invitations (token);

COMMENT ON TABLE public.organization_invitations IS
  'Pending org team invites. Accept via Google sign-in with matching email (edge function).';

DROP TRIGGER IF EXISTS update_organization_members_updated_at ON public.organization_members;
CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organization_invitations_updated_at ON public.organization_invitations;
CREATE TRIGGER update_organization_invitations_updated_at
  BEFORE UPDATE ON public.organization_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.organization_members TO service_role;
GRANT ALL ON public.organization_invitations TO service_role;
