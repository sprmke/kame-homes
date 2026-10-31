-- Org-level billing migration: replaces per-property subscriptions and the flat
-- org-bundle-cap model with a single org-level subscription priced per enrolled
-- property, discounted by a volume curve. Plan: docs/workflow/planned/org-level-billing-migration.md
-- No live paying customers today (confirmed with host) — this is a clean cutover,
-- no data migration/backfill needed.

-- ─── pricing_plans: per-property rate + volume discount curve, drop the hard cap ──

ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS volume_discount_tiers JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.pricing_plans
  ADD CONSTRAINT pricing_plans_volume_discount_tiers_array
    CHECK (jsonb_typeof(volume_discount_tiers) = 'array');

COMMENT ON COLUMN public.pricing_plans.volume_discount_tiers IS
  'Array of {minProperties, discountPercent}, ascending by minProperties. Applied to the
   extended total (per-property rate x enrolled property count) on top of discount_percent''s
   flat promo markdown — see _shared/planPricing.ts#computeOrgSubscriptionTotalPhp.';

-- price_php is repurposed in meaning only (no column change): it's now the per-property
-- monthly rate for every tier, including growth/pro which previously only meant this for
-- the standalone per-property checkout path. Seed a starting volume curve on paid tiers.
UPDATE public.pricing_plans
SET volume_discount_tiers = '[{"minProperties": 3, "discountPercent": 10}, {"minProperties": 6, "discountPercent": 20}]'::jsonb
WHERE code IN ('starter', 'growth', 'pro', 'managed') AND is_active = TRUE;

-- Business Plus retired (confirmed with host) — its flat 10-property bundle price is
-- superseded by Pro's own volume curve now doing the same job natively. Deactivate rather
-- than delete, matching how the already-retired `commission` plan was handled.
UPDATE public.pricing_plans
SET is_active = FALSE, updated_at = NOW()
WHERE code = 'business_plus' AND is_active = TRUE;

-- No more hard cap — every active subscription plan is now org-bundle-eligible by
-- construction, priced by the volume curve instead of a per-tier ceiling.
ALTER TABLE public.pricing_plans DROP COLUMN IF EXISTS max_properties;

-- ─── org_subscriptions: drop the cap snapshot, add billing-cron grace tracking ───

ALTER TABLE public.org_subscriptions DROP COLUMN IF EXISTS max_properties_snapshot;

ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN public.org_subscriptions.price_php_snapshot IS
  'Computed total at last checkout/change: per-property rate x enrolled property count,
   discounted (promo then volume curve) — not a flat tier price. Manually overridden for
   sales-assisted tiers (e.g. Managed) via the super-admin org-subscription editor.';

-- ─── Drop the per-property billing system outright (no data to preserve) ─────────

DROP TABLE IF EXISTS public.booking_commission_charges;
DROP TABLE IF EXISTS public.property_subscription_events;

-- CASCADE drops property_payment_transactions.property_subscription_id's now-dangling FK
-- constraint (the table itself is untouched — it's dropped later, once
-- propertySubscriptionCheckout.ts/create-subscription-checkout are removed, so nothing
-- references a gone table mid-migration).
DROP TABLE IF EXISTS public.property_subscriptions CASCADE;
