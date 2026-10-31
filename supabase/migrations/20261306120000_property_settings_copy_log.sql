-- Property settings copy audit log — one row per confirmed copy-property-settings run.
-- Written by copy-property-settings (service role). No client RLS read path in v1;
-- Phase 4 may add a list endpoint for org owners.

CREATE TABLE IF NOT EXISTS public.property_settings_copy_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  source_property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  groups TEXT[] NOT NULL DEFAULT '{}'::text[],
  target_property_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_settings_copy_log_org_created
  ON public.property_settings_copy_log (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_settings_copy_log_source_created
  ON public.property_settings_copy_log (source_property_id, created_at DESC);

COMMENT ON TABLE public.property_settings_copy_log IS
  'Append-only log of copy-property-settings runs. results JSONB is per-target applied/skipped/failed.';

ALTER TABLE public.property_settings_copy_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.property_settings_copy_log TO service_role;
