-- Superhost Phase 2: idempotent quarterly assessment log per org.

BEGIN;

CREATE TABLE IF NOT EXISTS public.superhost_assessment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  assessment_key TEXT NOT NULL,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  earned BOOLEAN NOT NULL,
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_earned BOOLEAN,
  trigger TEXT NOT NULL DEFAULT 'cron',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT superhost_assessment_runs_org_key_unique UNIQUE (organization_id, assessment_key),
  CONSTRAINT superhost_assessment_runs_trigger_check CHECK (
    trigger IN ('cron', 'manual')
  )
);

CREATE INDEX IF NOT EXISTS idx_superhost_assessment_runs_org_assessed
  ON public.superhost_assessment_runs (organization_id, assessed_at DESC);

COMMENT ON TABLE public.superhost_assessment_runs IS
  'Quarterly Superhost assessment outcomes (e.g. assessment_key 2026-Q3). One row per org per quarter.';

ALTER TABLE public.superhost_assessment_runs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.superhost_assessment_runs TO service_role;

COMMIT;
