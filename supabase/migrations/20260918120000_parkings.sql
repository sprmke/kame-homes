-- First-class parking slots (one row = one rentable slot) + per-parking settings.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS host_modes TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.organizations.host_modes IS
  'Host intent: property, parking. Updated on onboarding and when first asset of a type is added.';

CREATE TABLE IF NOT EXISTS public.parkings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  residence_name TEXT,
  tower TEXT,
  level TEXT,
  slot_label TEXT NOT NULL,
  parking_type TEXT NOT NULL DEFAULT 'inside_tower' CHECK (
    parking_type IN ('inside_tower', 'outside_tower', 'motorcycle')
  ),
  rate_per_night NUMERIC(12, 2) CHECK (rate_per_night IS NULL OR rate_per_night >= 0),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT parkings_slug_unique UNIQUE (slug),
  CONSTRAINT parkings_slot_location_unique UNIQUE (residence_name, tower, level, slot_label)
);

CREATE INDEX IF NOT EXISTS parkings_organization_id_idx ON public.parkings (organization_id);
CREATE INDEX IF NOT EXISTS parkings_slug_idx ON public.parkings (slug);
CREATE INDEX IF NOT EXISTS parkings_status_idx ON public.parkings (status);

COMMENT ON TABLE public.parkings IS
  'Rentable parking slots scoped to an organization (one row = one slot).';

CREATE TABLE IF NOT EXISTS public.parking_settings (
  parking_id UUID PRIMARY KEY REFERENCES public.parkings(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  payment_provider TEXT,
  gcash_name TEXT,
  gcash_number TEXT,
  gcash_qr_image_url TEXT,
  payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,

  gmail_connected BOOLEAN NOT NULL DEFAULT FALSE,
  calendar_connected BOOLEAN NOT NULL DEFAULT FALSE,
  sheets_connected BOOLEAN NOT NULL DEFAULT FALSE,

  parking_notification_templates JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.parking_settings IS
  'Per-parking operator config (payment, integrations, parking notification templates).';

ALTER TABLE public.parkings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parkings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_settings TO service_role;
