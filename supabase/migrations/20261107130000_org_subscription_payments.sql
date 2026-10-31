-- Org portfolio subscription checkout — parallel to property_payment_transactions.
-- Plan: docs/workflow/in-progress/pricing-portfolio-bundling.md (Phase 3)
-- Phase 8 of docs/workflow/in-progress/tier-feature-alignment-audit.md

CREATE TABLE IF NOT EXISTS public.org_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  org_subscription_id UUID REFERENCES public.org_subscriptions (id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES public.pricing_plans (id),
  -- Property ids selected at checkout time, slotted in once payment is fulfilled
  -- (org_subscription_properties rows don't exist yet until then).
  property_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
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
  CONSTRAINT org_payment_transactions_status_check CHECK (
    status IN ('pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded')
  )
);

CREATE INDEX IF NOT EXISTS idx_org_payment_transactions_org
  ON public.org_payment_transactions (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_payment_transactions_provider_ref
  ON public.org_payment_transactions (provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS org_payment_transactions_one_pending_per_org_plan_idx
  ON public.org_payment_transactions (organization_id, plan_id)
  WHERE status = 'pending';

COMMENT ON TABLE public.org_payment_transactions IS
  'PayMongo checkout transactions for org portfolio subscriptions (Pro/Business/Business Plus bundles). Mirrors property_payment_transactions.';

ALTER TABLE public.org_payment_transactions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.org_payment_transactions TO service_role;
