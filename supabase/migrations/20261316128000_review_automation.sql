-- Two-way reviews Phase 7: auto-review rules (Pro+ `reviewAutomation`) + per-booking pause.

UPDATE public.pricing_plans
SET features = features || '{ "reviewAutomation": false }'::jsonb
WHERE code IN ('free', 'starter', 'commission');

UPDATE public.pricing_plans
SET features = features || '{ "reviewAutomation": true }'::jsonb
WHERE code IN ('growth', 'pro', 'managed', 'business_plus');

ALTER TABLE public.booking_review_windows
  ADD COLUMN IF NOT EXISTS auto_review_paused BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.booking_review_windows.auto_review_paused IS
  'Host paused auto-review for this booking. Cron skips until cleared.';

CREATE TABLE IF NOT EXISTS public.review_automation_rules (
  property_id UUID PRIMARY KEY REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  delay_days INTEGER NOT NULL DEFAULT 3
    CHECK (delay_days >= 1 AND delay_days <= 13),
  overall_rating INTEGER NOT NULL DEFAULT 5
    CHECK (overall_rating >= 1 AND overall_rating <= 5),
  cleanliness_rating INTEGER NOT NULL DEFAULT 5
    CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
  communication_rating INTEGER NOT NULL DEFAULT 5
    CHECK (communication_rating >= 1 AND communication_rating <= 5),
  house_rules_rating INTEGER NOT NULL DEFAULT 5
    CHECK (house_rules_rating >= 1 AND house_rules_rating <= 5),
  would_host_again BOOLEAN NOT NULL DEFAULT true,
  templates TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  skip_on_issue_tags BOOLEAN NOT NULL DEFAULT true,
  skip_on_open_maintenance BOOLEAN NOT NULL DEFAULT true,
  skip_on_sd_deduction BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT review_automation_templates_when_enabled CHECK (
    NOT enabled OR cardinality(templates) >= 3
  )
);

CREATE INDEX IF NOT EXISTS idx_review_automation_rules_org
  ON public.review_automation_rules (organization_id);

CREATE INDEX IF NOT EXISTS idx_review_automation_rules_enabled
  ON public.review_automation_rules (property_id)
  WHERE enabled;

COMMENT ON TABLE public.review_automation_rules IS
  'Per-property auto-review of guests after check-out. Plan-gated reviewAutomation (Pro+).';

ALTER TABLE public.review_automation_rules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.review_automation_rules FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.review_automation_rules TO service_role;
