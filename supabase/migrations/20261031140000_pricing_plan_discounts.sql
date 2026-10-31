-- Per-tier list prices + configurable discount percent (hosts pay floor(list * (100 - discount) / 100)).

ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.pricing_plans
  DROP CONSTRAINT IF EXISTS pricing_plans_discount_percent_range;

ALTER TABLE public.pricing_plans
  ADD CONSTRAINT pricing_plans_discount_percent_range
  CHECK (discount_percent >= 0 AND discount_percent <= 100);

COMMENT ON COLUMN public.pricing_plans.discount_percent IS
  'Percent off list price_php for subscription tiers. Checkout and host Plans UI use floor(list * (100 - discount) / 100).';

UPDATE public.pricing_plans
SET price_php = 0, discount_percent = 0
WHERE code = 'free';

UPDATE public.pricing_plans
SET price_php = 499, discount_percent = 20
WHERE code = 'starter';

UPDATE public.pricing_plans
SET price_php = 999, discount_percent = 20
WHERE code = 'growth';

UPDATE public.pricing_plans
SET price_php = 1799, discount_percent = 20
WHERE code = 'pro';

UPDATE public.pricing_plans
SET price_php = 4999, discount_percent = 20
WHERE code = 'managed';

UPDATE public.pricing_plans
SET discount_percent = 0
WHERE pricing_model = 'commission';
