-- Smart volume pricing: replace the placeholder 3+/6+ curve with breakpoints at
-- 10, 20, 50, 100+ properties (plus 200+/300+ for large portfolios). Targets
-- ~₱500/property effective at 10 enrolled properties on Pro/Business tiers while
-- scaling discounts so 100–300+ listings stay commercially reasonable.
-- See _shared/planPricing.ts#computeOrgSubscriptionTotalPhp.

-- Starter (399 effective/mo) — already below the ₱500/property anchor; lighter curve.
UPDATE public.pricing_plans
SET
  volume_discount_tiers = '[
    {"minProperties": 10, "discountPercent": 0},
    {"minProperties": 20, "discountPercent": 8},
    {"minProperties": 50, "discountPercent": 20},
    {"minProperties": 100, "discountPercent": 35},
    {"minProperties": 200, "discountPercent": 50},
    {"minProperties": 300, "discountPercent": 60}
  ]'::jsonb,
  updated_at = NOW()
WHERE code = 'starter' AND is_active = TRUE;

-- Pro / growth (799 effective/mo) — ~₱503/property at 10 properties.
UPDATE public.pricing_plans
SET
  volume_discount_tiers = '[
    {"minProperties": 10, "discountPercent": 37},
    {"minProperties": 20, "discountPercent": 45},
    {"minProperties": 50, "discountPercent": 62},
    {"minProperties": 100, "discountPercent": 78},
    {"minProperties": 200, "discountPercent": 85},
    {"minProperties": 300, "discountPercent": 88}
  ]'::jsonb,
  updated_at = NOW()
WHERE code = 'growth' AND is_active = TRUE;

-- Business / pro (1439 effective/mo) — ~₱503/property at 10 properties.
UPDATE public.pricing_plans
SET
  volume_discount_tiers = '[
    {"minProperties": 10, "discountPercent": 65},
    {"minProperties": 20, "discountPercent": 70},
    {"minProperties": 50, "discountPercent": 78},
    {"minProperties": 100, "discountPercent": 85},
    {"minProperties": 200, "discountPercent": 90},
    {"minProperties": 300, "discountPercent": 93}
  ]'::jsonb,
  updated_at = NOW()
WHERE code = 'pro' AND is_active = TRUE;

-- Managed (3999 effective/mo) — cosmetic curve; sales-assisted overrides are common.
UPDATE public.pricing_plans
SET
  volume_discount_tiers = '[
    {"minProperties": 10, "discountPercent": 87},
    {"minProperties": 20, "discountPercent": 89},
    {"minProperties": 50, "discountPercent": 92},
    {"minProperties": 100, "discountPercent": 94},
    {"minProperties": 200, "discountPercent": 96},
    {"minProperties": 300, "discountPercent": 97}
  ]'::jsonb,
  updated_at = NOW()
WHERE code = 'managed' AND is_active = TRUE;
