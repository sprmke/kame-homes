-- Host plan monthly prices (per listing): Free ₱0, Starter ₱399, Pro ₱699, Business ₱1,399.

UPDATE public.pricing_plans
SET price_php = 0
WHERE code = 'free';

UPDATE public.pricing_plans
SET price_php = 399
WHERE code = 'starter';

UPDATE public.pricing_plans
SET price_php = 699
WHERE code = 'growth';

UPDATE public.pricing_plans
SET price_php = 1399
WHERE code = 'pro';
