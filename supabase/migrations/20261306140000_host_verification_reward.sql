-- Host verification reward: platform_settings knobs, org_subscriptions.source,
-- reward event types, expiry sweep index.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS host_reward_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS host_reward_plan_code TEXT DEFAULT 'growth',
  ADD COLUMN IF NOT EXISTS host_reward_duration_days INTEGER NOT NULL DEFAULT 30
    CHECK (host_reward_duration_days > 0),
  ADD COLUMN IF NOT EXISTS host_reward_trigger TEXT NOT NULL DEFAULT 'recommended_verification_approved'
    CHECK (host_reward_trigger IN (
      'recommended_verification_submitted',
      'recommended_verification_approved'
    )),
  ADD COLUMN IF NOT EXISTS host_reward_campaign_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS host_reward_campaign_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS host_reward_max_per_org INTEGER NOT NULL DEFAULT 1
    CHECK (host_reward_max_per_org >= 1),
  ADD COLUMN IF NOT EXISTS host_reward_apply_to_paid_org TEXT NOT NULL DEFAULT 'skip'
    CHECK (host_reward_apply_to_paid_org IN ('skip', 'extend'));

COMMENT ON COLUMN public.platform_settings.host_reward_enabled IS
  'When true, Free hosts may submit Recommended verification and earn a time-limited Pro grant.';
COMMENT ON COLUMN public.platform_settings.host_reward_plan_code IS
  'pricing_plans.code granted by the Recommended verification reward.';
COMMENT ON COLUMN public.platform_settings.host_reward_trigger IS
  'When to grant: on Recommended submit or only after super-admin approval.';

ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'purchase';

ALTER TABLE public.org_subscriptions
  DROP CONSTRAINT IF EXISTS org_subscriptions_source_check;

ALTER TABLE public.org_subscriptions
  ADD CONSTRAINT org_subscriptions_source_check
  CHECK (source IN ('purchase', 'admin', 'reward'));

COMMENT ON COLUMN public.org_subscriptions.source IS
  'How the subscription was created: purchase, admin assign, or host verification reward.';

-- Existing zero-price live rows are likely admin grants.
UPDATE public.org_subscriptions
SET source = 'admin'
WHERE source = 'purchase'
  AND COALESCE(price_php_snapshot, 0) = 0
  AND status IN ('active', 'trialing');

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_reward_expiry
  ON public.org_subscriptions (current_period_end)
  WHERE status = 'trialing' AND source = 'reward';

ALTER TABLE public.org_subscription_events
  DROP CONSTRAINT IF EXISTS org_subscription_events_event_type_check;

ALTER TABLE public.org_subscription_events
  ADD CONSTRAINT org_subscription_events_event_type_check
  CHECK (
    event_type IN (
      'assigned',
      'plan_changed',
      'status_changed',
      'property_added',
      'property_removed',
      'reward_granted',
      'reward_expired',
      'reward_revoked'
    )
  );
