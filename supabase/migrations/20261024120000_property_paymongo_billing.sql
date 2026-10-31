-- Property-scoped PayMongo subscription billing (payment ledger + platform settings).
-- Plan: docs/workflow/in-progress/paymongo-subscription-billing.md
-- Catalog + assignments: pricing_plans / property_subscriptions (20261023120000).

ALTER TABLE public.property_subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.property_subscriptions.grace_period_ends_at IS
  'When past_due grace ends; NULL when not in grace.';
COMMENT ON COLUMN public.property_subscriptions.cancel_at_period_end IS
  'When true, subscription ends at current_period_end instead of renewing.';

CREATE TABLE IF NOT EXISTS public.platform_payment_settings (
  id INT PRIMARY KEY DEFAULT 1,
  enabled_payment_methods JSONB NOT NULL DEFAULT '["qrph","paymaya","dob"]'::jsonb,
  enabled_banks JSONB NOT NULL DEFAULT '[]'::jsonb,
  renewal_link_lead_days INT NOT NULL DEFAULT 5,
  grace_period_days INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT platform_payment_settings_singleton CHECK (id = 1)
);

COMMENT ON TABLE public.platform_payment_settings IS
  'Singleton PayMongo rails + renewal/dunning config for property subscription billing.';

INSERT INTO public.platform_payment_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.property_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  property_subscription_id UUID REFERENCES public.property_subscriptions (id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES public.pricing_plans (id),
  provider TEXT NOT NULL DEFAULT 'paymongo',
  provider_reference TEXT,
  checkout_url TEXT,
  payment_method_type TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  raw_webhook_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  CONSTRAINT property_payment_transactions_status_check CHECK (
    status IN ('pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded')
  )
);

CREATE INDEX IF NOT EXISTS idx_property_payment_transactions_property
  ON public.property_payment_transactions (property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_payment_transactions_provider_ref
  ON public.property_payment_transactions (provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS property_payment_transactions_one_pending_per_property_plan_idx
  ON public.property_payment_transactions (property_id, plan_id)
  WHERE status = 'pending';

COMMENT ON TABLE public.property_payment_transactions IS
  'Audit ledger for PayMongo checkout links per property plan purchase/renewal. Never deleted.';

CREATE TABLE IF NOT EXISTS public.processed_paymongo_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.processed_paymongo_events IS
  'Webhook dedupe — PayMongo may redeliver events.';

DROP TRIGGER IF EXISTS update_platform_payment_settings_updated_at ON public.platform_payment_settings;
CREATE TRIGGER update_platform_payment_settings_updated_at
  BEFORE UPDATE ON public.platform_payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.platform_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_paymongo_events ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.platform_payment_settings TO service_role;
GRANT ALL ON public.property_payment_transactions TO service_role;
GRANT ALL ON public.processed_paymongo_events TO service_role;
