-- Org-level portfolio bundling for Pro/Business/Business Plus.
-- Plan: docs/workflow/in-progress/pricing-portfolio-bundling.md
-- Phase 8 of docs/workflow/in-progress/tier-feature-alignment-audit.md

-- ─── pricing_plans: property cap for org-bundle-eligible tiers ────────────────
-- NULL = per-property/unbounded model (today's default for every existing plan).

ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS max_properties INT;

COMMENT ON COLUMN public.pricing_plans.max_properties IS
  'NULL = per-property billing (unchanged). Set on org-bundle-eligible tiers (growth/pro/business_plus) — the cap on properties one org subscription to this plan may cover.';

UPDATE public.pricing_plans SET max_properties = 3 WHERE code = 'growth';
UPDATE public.pricing_plans SET max_properties = 5 WHERE code = 'pro';

-- ─── Seed new Business Plus tier (org bundle, ≤10 properties) ─────────────────
-- sort_order is an int ladder — shift managed/commission up one slot to make room
-- for business_plus between pro (4) and managed (5).

UPDATE public.pricing_plans SET sort_order = 6 WHERE code = 'managed';
UPDATE public.pricing_plans SET sort_order = 7 WHERE code = 'commission';

INSERT INTO public.pricing_plans (
  code,
  name,
  tagline,
  sort_order,
  pricing_model,
  price_php,
  discount_percent,
  max_properties,
  is_active,
  is_default,
  features
)
SELECT
  'business_plus',
  'Business Plus',
  'Up to 10 properties',
  5,
  'subscription',
  2999,
  20,
  10,
  TRUE,
  FALSE,
  '{
    "automatedBookingFlow": true,
    "verifiedBadgeEligible": true,
    "recommendedBadgeEligible": true,
    "telegramNotifications": true,
    "teamManagement": { "enabled": true, "maxMembers": 15 },
    "searchVisibilityTier": "top10",
    "marketingPublishLimitPerGroup": null,
    "aiValidations": true,
    "aiMonthlyCreditAllowance": 20000,
    "marketingStudio": true,
    "customPages": true,
    "aiDashboardAssistant": true,
    "aiReceptionist": true,
    "aiMarketingGeneration": true,
    "aiChatAutoReply": true,
    "fullyManagedByPlatform": false,
    "financeReporting": true,
    "maintenanceReporting": true,
    "metaChatChannel": true,
    "quickReplies": true,
    "customTemplates": true,
    "publicPagesAutosave": true
  }'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.pricing_plans WHERE code = 'business_plus');

-- ─── org_subscriptions — one live portfolio subscription per org ─────────────

CREATE TABLE IF NOT EXISTS public.org_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.pricing_plans (id),
  pricing_model TEXT NOT NULL,
  price_php_snapshot NUMERIC,
  max_properties_snapshot INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_subscriptions_pricing_model_check CHECK (
    pricing_model IN ('subscription')
  ),
  CONSTRAINT org_subscriptions_status_check CHECK (
    status IN ('active', 'trialing', 'past_due', 'suspended', 'canceled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS org_subscriptions_one_live_per_org_idx
  ON public.org_subscriptions (organization_id)
  WHERE status IN ('active', 'trialing', 'past_due');

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_plan
  ON public.org_subscriptions (plan_id);

COMMENT ON TABLE public.org_subscriptions IS
  'Org-level portfolio subscription (Pro/Business/Business Plus bundles). One live row per org (partial unique on active/trialing/past_due), mirrors property_subscriptions.';

-- ─── org_subscription_properties — which properties are slotted in ───────────

CREATE TABLE IF NOT EXISTS public.org_subscription_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_subscription_id UUID NOT NULL REFERENCES public.org_subscriptions (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users (id) ON DELETE SET NULL
);

-- A property can only sit in one org subscription's slots at a time.
CREATE UNIQUE INDEX IF NOT EXISTS org_subscription_properties_property_unique
  ON public.org_subscription_properties (property_id);

CREATE INDEX IF NOT EXISTS idx_org_subscription_properties_subscription
  ON public.org_subscription_properties (org_subscription_id);

COMMENT ON TABLE public.org_subscription_properties IS
  'Join table: which properties are covered by an org portfolio subscription''s slots.';

-- ─── org_subscription_events — append-only audit trail ────────────────────────

CREATE TABLE IF NOT EXISTS public.org_subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_subscription_id UUID NOT NULL REFERENCES public.org_subscriptions (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_plan_id UUID REFERENCES public.pricing_plans (id) ON DELETE SET NULL,
  new_plan_id UUID REFERENCES public.pricing_plans (id) ON DELETE SET NULL,
  previous_status TEXT,
  new_status TEXT,
  property_id UUID REFERENCES public.properties (id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_subscription_events_event_type_check CHECK (
    event_type IN (
      'assigned', 'plan_changed', 'status_changed',
      'property_added', 'property_removed'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_org_subscription_events_subscription
  ON public.org_subscription_events (org_subscription_id, created_at DESC);

COMMENT ON TABLE public.org_subscription_events IS
  'Append-only audit trail for org portfolio subscription assignments, plan changes, and property slot changes.';

-- ─── Triggers, RLS, grants (mirrors pricing_plans_foundation.sql conventions) ──

DROP TRIGGER IF EXISTS update_org_subscriptions_updated_at ON public.org_subscriptions;
CREATE TRIGGER update_org_subscriptions_updated_at
  BEFORE UPDATE ON public.org_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_subscription_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_subscription_events ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.org_subscriptions TO service_role;
GRANT ALL ON public.org_subscription_properties TO service_role;
GRANT ALL ON public.org_subscription_events TO service_role;
