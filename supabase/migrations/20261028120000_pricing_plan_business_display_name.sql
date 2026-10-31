-- Host-facing display name for the growth tier (internal code stays `growth`).
UPDATE public.pricing_plans
SET name = 'Business'
WHERE code = 'growth' AND name IN ('Growth', 'Level 3');
