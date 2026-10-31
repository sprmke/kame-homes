-- Retire unfinished commission pricing from the live catalog.
-- Schema (`pricing_model = 'commission'`, `booking_commission_charges`) stays for a future
-- product; see docs/architecture/plans-feature-matrix.md and docs/workflow/intake/_to-plan.md.

UPDATE public.pricing_plans
SET
  is_active = false,
  updated_at = now()
WHERE code = 'commission'
  AND is_active = true;

-- Hosts must not remain on an unfinished pricing model — move live commission
-- subscriptions onto Free.
WITH free_plan AS (
  SELECT id
  FROM public.pricing_plans
  WHERE code = 'free'
  LIMIT 1
),
live_commission AS (
  SELECT ps.id AS subscription_id
  FROM public.property_subscriptions ps
  INNER JOIN public.pricing_plans pp ON pp.id = ps.plan_id
  WHERE pp.code = 'commission'
    AND ps.status IN ('active', 'trialing', 'past_due')
)
UPDATE public.property_subscriptions ps
SET
  plan_id = (SELECT id FROM free_plan),
  pricing_model = 'subscription',
  price_php_snapshot = 0,
  commission_rate_percent_snapshot = NULL,
  updated_at = now()
FROM live_commission lc
WHERE ps.id = lc.subscription_id
  AND EXISTS (SELECT 1 FROM free_plan);
