-- Gate create/edit/delete of custom team roles behind Starter+ (`customRoles`).
-- Viewing seeded roles and the permissions matrix stays free on every tier.

UPDATE public.pricing_plans
SET features = features || '{"customRoles": false}'::jsonb
WHERE code = 'free';

UPDATE public.pricing_plans
SET features = features || '{"customRoles": true}'::jsonb
WHERE code IN ('starter', 'growth', 'commission', 'pro', 'managed');
