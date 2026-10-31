-- Replace internal "Level N" catalog labels with host-facing plan names.

UPDATE public.pricing_plans
SET name = 'Free'
WHERE code = 'free' AND name ~ '^Level [0-9]+$';

UPDATE public.pricing_plans
SET name = 'Starter'
WHERE code = 'starter' AND name ~ '^Level [0-9]+$';

UPDATE public.pricing_plans
SET name = 'Growth'
WHERE code = 'growth' AND name ~ '^Level [0-9]+$';

UPDATE public.pricing_plans
SET name = 'Pro'
WHERE code = 'pro' AND name ~ '^Level [0-9]+$';

UPDATE public.pricing_plans
SET name = 'Managed'
WHERE code = 'managed' AND name ~ '^Level [0-9]+$';
