-- Multi-tenancy foundation: organizations (single owner), properties, property_id scoping.
-- Backfills default org (Kame Home) + property (Monaco 2604) for existing data.

-- ─── Core tables ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT organizations_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner_id
  ON public.organizations (owner_id);

COMMENT ON TABLE public.organizations IS
  'Tenant org — exactly one owner (auth.users). A user may own multiple orgs.';

CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'CONDO',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  address TEXT,
  tower_and_unit TEXT,
  residence_name TEXT,
  max_guests INTEGER CHECK (max_guests IS NULL OR max_guests > 0),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT properties_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT properties_status_check CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT properties_org_slug_unique UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_properties_organization_id
  ON public.properties (organization_id);

COMMENT ON TABLE public.properties IS
  'Bookable property within an organization. Azure condo units in Phase 1.';

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_properties_updated_at ON public.properties;
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── property_id on operational tables ─────────────────────────────────────

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE RESTRICT;

ALTER TABLE public.finance_line_items
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE RESTRICT;

-- app_settings, telegram_admin/finance/maintenance, maintenance_items are created in
-- later migrations (202607* / 202608*). property_id for those tables is added in
-- 20260821120000_multi_tenancy_late_tables_property_id.sql.

ALTER TABLE public.telegram_marketing_settings
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE;

ALTER TABLE public.telegram_staff_settings
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE;

ALTER TABLE public.gmail_mail_integration
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_guest_submissions_property_id
  ON public.guest_submissions (property_id);

CREATE INDEX IF NOT EXISTS idx_finance_line_items_property_id
  ON public.finance_line_items (property_id);

-- ─── Default org + property backfill ─────────────────────────────────────────

DO $$
DECLARE
  v_owner_id UUID;
  v_org_id UUID := gen_random_uuid();
  v_prop_id UUID := gen_random_uuid();
BEGIN
  SELECT u.id INTO v_owner_id
  FROM auth.users u
  WHERE lower(u.email) = lower('kamehome.azurenorth@gmail.com')
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT u.id INTO v_owner_id
    FROM auth.users u
    ORDER BY u.created_at ASC
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE
      'multi_tenancy backfill: no auth.users yet — skip default org/property (sign in + /onboarding)';
    RETURN;
  END IF;

  INSERT INTO public.organizations (id, owner_id, name, slug, description)
  VALUES (
    v_org_id,
    v_owner_id,
    'Kame Home',
    'kame-home',
    'Default organization for migrated single-tenant data'
  )
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description
  RETURNING id INTO v_org_id;

  IF v_org_id IS NULL THEN
    SELECT o.id INTO v_org_id FROM public.organizations o WHERE o.slug = 'kame-home';
  END IF;

  INSERT INTO public.properties (
    id,
    organization_id,
    name,
    slug,
    tower_and_unit,
    residence_name,
    max_guests
  )
  VALUES (
    v_prop_id,
    v_org_id,
    'Monaco 2604',
    'monaco-2604',
    'Monaco 2604',
    'Azure North',
    6
  )
  ON CONFLICT (organization_id, slug) DO UPDATE
    SET name = EXCLUDED.name,
        tower_and_unit = EXCLUDED.tower_and_unit,
        residence_name = EXCLUDED.residence_name
  RETURNING id INTO v_prop_id;

  IF v_prop_id IS NULL THEN
    SELECT p.id INTO v_prop_id
    FROM public.properties p
    WHERE p.organization_id = v_org_id AND p.slug = 'monaco-2604';
  END IF;

  UPDATE public.guest_submissions SET property_id = v_prop_id WHERE property_id IS NULL;
  UPDATE public.finance_line_items SET property_id = v_prop_id WHERE property_id IS NULL;
  UPDATE public.telegram_marketing_settings SET property_id = v_prop_id WHERE property_id IS NULL;
  UPDATE public.telegram_staff_settings SET property_id = v_prop_id WHERE property_id IS NULL;
  UPDATE public.gmail_mail_integration SET property_id = v_prop_id WHERE property_id IS NULL;
END $$;

-- Enforce NOT NULL on high-volume tables after backfill
ALTER TABLE public.guest_submissions
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE public.finance_line_items
  ALTER COLUMN property_id SET NOT NULL;

-- Per-property uniqueness on singleton-style settings rows (early tables only)
CREATE UNIQUE INDEX IF NOT EXISTS telegram_marketing_settings_property_id_unique
  ON public.telegram_marketing_settings (property_id)
  WHERE property_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_staff_settings_property_id_unique
  ON public.telegram_staff_settings (property_id)
  WHERE property_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gmail_mail_integration_property_id_unique
  ON public.gmail_mail_integration (property_id)
  WHERE property_id IS NOT NULL;

-- ─── RLS: organizations + properties ─────────────────────────────────────────

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner can read own organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Org owner can insert own organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Org owner can update own organizations"
  ON public.organizations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Org owner can delete own organizations"
  ON public.organizations FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Org owner can read properties in own orgs"
  ON public.properties FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = properties.organization_id AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Org owner can insert properties in own orgs"
  ON public.properties FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = properties.organization_id AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Org owner can update properties in own orgs"
  ON public.properties FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = properties.organization_id AND o.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = properties.organization_id AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Org owner can delete properties in own orgs"
  ON public.properties FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = properties.organization_id AND o.owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.properties TO service_role;
