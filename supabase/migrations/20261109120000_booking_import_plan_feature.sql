-- Gate AI-assisted booking CSV/Excel import behind Starter+ (`bookingImport`).
-- Free can open the wizard and upload; Continue / match / preview / commit require the plan.

UPDATE public.pricing_plans
SET features = features || '{"bookingImport": false}'::jsonb
WHERE code = 'free';

UPDATE public.pricing_plans
SET features = features || '{"bookingImport": true}'::jsonb
WHERE code IN ('starter', 'growth', 'commission', 'pro', 'managed');
