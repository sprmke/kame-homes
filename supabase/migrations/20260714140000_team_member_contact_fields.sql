-- Team member contact fields — source of truth for public host/contact display.
-- Fresh-reset: property_members / organization_members are created in Sept RBAC migrations.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.property_members') IS NOT NULL THEN
    ALTER TABLE public.property_members
      ADD COLUMN IF NOT EXISTS display_name TEXT,
      ADD COLUMN IF NOT EXISTS contact_phone TEXT;
    COMMENT ON COLUMN public.property_members.display_name IS
      'Public-facing name override; falls back to auth profile name when null.';
    COMMENT ON COLUMN public.property_members.contact_phone IS
      'Public-facing contact phone for host display on property pages and emails.';
  END IF;

  IF to_regclass('public.organization_members') IS NOT NULL THEN
    ALTER TABLE public.organization_members
      ADD COLUMN IF NOT EXISTS display_name TEXT,
      ADD COLUMN IF NOT EXISTS contact_phone TEXT;
    COMMENT ON COLUMN public.organization_members.display_name IS
      'Public-facing name override for org-level contact.';
    COMMENT ON COLUMN public.organization_members.contact_phone IS
      'Public-facing contact phone for org-level host display.';
  END IF;
END $$;

COMMIT;
