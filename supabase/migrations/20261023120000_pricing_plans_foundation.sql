-- Host pricing tiers — catalog, per-property subscriptions, commission charges.
-- Plan: docs/workflow/in-progress/host-plans-and-pricing-tiers.md

CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  pricing_model TEXT NOT NULL,
  price_php NUMERIC,
  billing_interval TEXT NOT NULL DEFAULT 'month',
  commission_rate_percent NUMERIC,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pricing_plans_pricing_model_check CHECK (
    pricing_model IN ('subscription', 'commission')
  ),
  CONSTRAINT pricing_plans_billing_interval_check CHECK (
    billing_interval IN ('month')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS pricing_plans_one_default_idx
  ON public.pricing_plans (is_default)
  WHERE is_default = TRUE;

COMMENT ON TABLE public.pricing_plans IS
  'Host-facing tier catalog (subscription ladder + optional commission plan). Super-admin CRUD; seeded defaults.';

CREATE TABLE IF NOT EXISTS public.property_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.pricing_plans (id),
  pricing_model TEXT NOT NULL,
  price_php_snapshot NUMERIC,
  commission_rate_percent_snapshot NUMERIC,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  feature_overrides JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT property_subscriptions_pricing_model_check CHECK (
    pricing_model IN ('subscription', 'commission')
  ),
  CONSTRAINT property_subscriptions_status_check CHECK (
    status IN ('active', 'trialing', 'past_due', 'suspended', 'canceled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS property_subscriptions_one_live_per_property_idx
  ON public.property_subscriptions (property_id)
  WHERE status IN ('active', 'trialing', 'past_due');

CREATE INDEX IF NOT EXISTS idx_property_subscriptions_org
  ON public.property_subscriptions (organization_id);

CREATE INDEX IF NOT EXISTS idx_property_subscriptions_plan
  ON public.property_subscriptions (plan_id);

COMMENT ON TABLE public.property_subscriptions IS
  'Active plan assignment per property listing. One live row per property (partial unique on active/trialing/past_due).';

CREATE TABLE IF NOT EXISTS public.property_subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_subscription_id UUID NOT NULL REFERENCES public.property_subscriptions (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_plan_id UUID REFERENCES public.pricing_plans (id) ON DELETE SET NULL,
  new_plan_id UUID REFERENCES public.pricing_plans (id) ON DELETE SET NULL,
  previous_status TEXT,
  new_status TEXT,
  note TEXT,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT property_subscription_events_event_type_check CHECK (
    event_type IN ('assigned', 'plan_changed', 'status_changed', 'override_set')
  )
);

CREATE INDEX IF NOT EXISTS idx_property_subscription_events_subscription
  ON public.property_subscription_events (property_subscription_id, created_at DESC);

COMMENT ON TABLE public.property_subscription_events IS
  'Append-only audit trail for plan assignments and super-admin overrides.';

CREATE TABLE IF NOT EXISTS public.booking_commission_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.guest_submissions (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  property_subscription_id UUID NOT NULL REFERENCES public.property_subscriptions (id) ON DELETE CASCADE,
  booking_revenue_php NUMERIC NOT NULL,
  commission_rate_percent NUMERIC NOT NULL,
  commission_amount_php NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_commission_charges_status_check CHECK (
    status IN ('pending', 'invoiced', 'paid', 'waived')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_commission_charges_booking_unique
  ON public.booking_commission_charges (booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_commission_charges_property
  ON public.booking_commission_charges (property_id, created_at DESC);

COMMENT ON TABLE public.booking_commission_charges IS
  'Commission owed on COMPLETED bookings for properties on a commission pricing plan. Collection is deferred to PayMongo billing.';

DROP TRIGGER IF EXISTS update_pricing_plans_updated_at ON public.pricing_plans;
CREATE TRIGGER update_pricing_plans_updated_at
  BEFORE UPDATE ON public.pricing_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_property_subscriptions_updated_at ON public.property_subscriptions;
CREATE TRIGGER update_property_subscriptions_updated_at
  BEFORE UPDATE ON public.property_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_commission_charges ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.pricing_plans TO service_role;
GRANT ALL ON public.property_subscriptions TO service_role;
GRANT ALL ON public.property_subscription_events TO service_role;
GRANT ALL ON public.booking_commission_charges TO service_role;

-- ─── Seed tier catalog (working defaults — confirm prices/allowances with product) ───

INSERT INTO public.pricing_plans (
  code,
  name,
  tagline,
  sort_order,
  pricing_model,
  price_php,
  commission_rate_percent,
  is_default,
  features
)
VALUES
  (
    'free',
    'Level 1',
    'Free',
    1,
    'subscription',
    0,
    NULL,
    TRUE,
    '{
      "automatedBookingFlow": false,
      "verifiedBadgeEligible": false,
      "recommendedBadgeEligible": false,
      "telegramNotifications": false,
      "teamManagement": { "enabled": false, "maxMembers": null },
      "searchVisibilityTier": "none",
      "marketingPublishLimitPerGroup": 0,
      "aiValidations": false,
      "aiMonthlyCreditAllowance": 0,
      "marketingStudio": false,
      "customPages": false,
      "aiDashboardAssistant": false,
      "aiReceptionist": false,
      "aiMarketingGeneration": false,
      "aiChatAutoReply": false,
      "fullyManagedByPlatform": false
    }'::jsonb
  ),
  (
    'starter',
    'Level 2',
    'Starter',
    2,
    'subscription',
    349,
    NULL,
    FALSE,
    '{
      "automatedBookingFlow": true,
      "verifiedBadgeEligible": true,
      "recommendedBadgeEligible": false,
      "telegramNotifications": true,
      "teamManagement": { "enabled": true, "maxMembers": 5 },
      "searchVisibilityTier": "none",
      "marketingPublishLimitPerGroup": 0,
      "aiValidations": false,
      "aiMonthlyCreditAllowance": 0,
      "marketingStudio": false,
      "customPages": false,
      "aiDashboardAssistant": false,
      "aiReceptionist": false,
      "aiMarketingGeneration": false,
      "aiChatAutoReply": false,
      "fullyManagedByPlatform": false
    }'::jsonb
  ),
  (
    'growth',
    'Level 3',
    'Growth',
    3,
    'subscription',
    499,
    NULL,
    FALSE,
    '{
      "automatedBookingFlow": true,
      "verifiedBadgeEligible": true,
      "recommendedBadgeEligible": true,
      "telegramNotifications": true,
      "teamManagement": { "enabled": true, "maxMembers": 10 },
      "searchVisibilityTier": "top20",
      "marketingPublishLimitPerGroup": null,
      "aiValidations": true,
      "aiMonthlyCreditAllowance": 1000,
      "marketingStudio": true,
      "customPages": true,
      "aiDashboardAssistant": false,
      "aiReceptionist": false,
      "aiMarketingGeneration": false,
      "aiChatAutoReply": false,
      "fullyManagedByPlatform": false
    }'::jsonb
  ),
  (
    'pro',
    'Level 4',
    'Pro',
    4,
    'subscription',
    1499,
    NULL,
    FALSE,
    '{
      "automatedBookingFlow": true,
      "verifiedBadgeEligible": true,
      "recommendedBadgeEligible": true,
      "telegramNotifications": true,
      "teamManagement": { "enabled": true, "maxMembers": null },
      "searchVisibilityTier": "top10",
      "marketingPublishLimitPerGroup": null,
      "aiValidations": true,
      "aiMonthlyCreditAllowance": 10000,
      "marketingStudio": true,
      "customPages": true,
      "aiDashboardAssistant": true,
      "aiReceptionist": true,
      "aiMarketingGeneration": true,
      "aiChatAutoReply": true,
      "fullyManagedByPlatform": false
    }'::jsonb
  ),
  (
    'managed',
    'Level 5',
    'Managed',
    5,
    'subscription',
    3499,
    NULL,
    FALSE,
    '{
      "automatedBookingFlow": true,
      "verifiedBadgeEligible": true,
      "recommendedBadgeEligible": true,
      "telegramNotifications": true,
      "teamManagement": { "enabled": true, "maxMembers": null },
      "searchVisibilityTier": "top10",
      "marketingPublishLimitPerGroup": null,
      "aiValidations": true,
      "aiMonthlyCreditAllowance": 100000,
      "marketingStudio": true,
      "customPages": true,
      "aiDashboardAssistant": true,
      "aiReceptionist": true,
      "aiMarketingGeneration": true,
      "aiChatAutoReply": true,
      "fullyManagedByPlatform": true
    }'::jsonb
  ),
  (
    'commission',
    'Commission',
    'Pay per completed booking',
    6,
    'commission',
    NULL,
    8.00,
    FALSE,
    '{
      "automatedBookingFlow": true,
      "verifiedBadgeEligible": true,
      "recommendedBadgeEligible": true,
      "telegramNotifications": true,
      "teamManagement": { "enabled": true, "maxMembers": 10 },
      "searchVisibilityTier": "top20",
      "marketingPublishLimitPerGroup": null,
      "aiValidations": true,
      "aiMonthlyCreditAllowance": 1000,
      "marketingStudio": true,
      "customPages": true,
      "aiDashboardAssistant": false,
      "aiReceptionist": false,
      "aiMarketingGeneration": false,
      "aiChatAutoReply": false,
      "fullyManagedByPlatform": false
    }'::jsonb
  )
ON CONFLICT (code) DO NOTHING;

-- Backfill Free tier for existing properties without a live subscription.
INSERT INTO public.property_subscriptions (
  property_id,
  organization_id,
  plan_id,
  pricing_model,
  price_php_snapshot,
  commission_rate_percent_snapshot,
  status
)
SELECT
  p.id,
  p.organization_id,
  dp.id,
  dp.pricing_model,
  dp.price_php,
  dp.commission_rate_percent,
  'active'
FROM public.properties p
CROSS JOIN public.pricing_plans dp
WHERE dp.is_default = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM public.property_subscriptions ps
    WHERE ps.property_id = p.id
      AND ps.status IN ('active', 'trialing', 'past_due')
  );
