-- propertyShowcase entitlement — Growth+ (and pro/managed). Free/Starter/commission off.
-- Plan: docs/workflow/in-progress/property-showcase-landing-pages.md

UPDATE public.pricing_plans
SET features = features || '{"propertyShowcase": false}'::jsonb
WHERE code IN ('free', 'starter', 'commission');

UPDATE public.pricing_plans
SET features = features || '{"propertyShowcase": true}'::jsonb
WHERE code IN ('growth', 'pro', 'managed');
