-- Business tier: ₱1,399 → ₱1,299 (adjustment after initial repricing migration).

UPDATE public.pricing_plans
SET price_php = 1299
WHERE code = 'pro';
