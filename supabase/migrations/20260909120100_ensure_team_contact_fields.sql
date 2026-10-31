-- Catch-up for 20260714140000 / 20260714170000 (tables created in Sept RBAC).

ALTER TABLE public.property_members
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;

COMMENT ON COLUMN public.property_members.display_name IS
  'Public-facing name override; falls back to auth profile name when null.';
COMMENT ON COLUMN public.property_members.contact_phone IS
  'Public-facing contact phone for host display on property pages and emails.';

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;

COMMENT ON COLUMN public.organization_members.display_name IS
  'Public-facing name override for org-level contact.';
COMMENT ON COLUMN public.organization_members.contact_phone IS
  'Public-facing contact phone for org-level host display.';

ALTER TABLE public.property_invitations
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;

COMMENT ON COLUMN public.property_invitations.display_name IS
  'Guest-facing display name pre-filled on accept into property_members.display_name';
COMMENT ON COLUMN public.property_invitations.contact_phone IS
  'Guest-facing phone pre-filled on accept into property_members.contact_phone';

ALTER TABLE public.organization_invitations
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;

COMMENT ON COLUMN public.organization_invitations.display_name IS
  'Guest-facing display name pre-filled on accept into organization_members.display_name';
COMMENT ON COLUMN public.organization_invitations.contact_phone IS
  'Guest-facing phone pre-filled on accept into organization_members.contact_phone';
