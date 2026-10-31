-- Per-org override escape hatch, mirrors the retired property_subscriptions.feature_overrides —
-- used e.g. by the super-admin org-subscription editor to hand-tune a sales-assisted Managed
-- subscription's price/features without going through the standard rate x count formula.
ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS feature_overrides JSONB;
