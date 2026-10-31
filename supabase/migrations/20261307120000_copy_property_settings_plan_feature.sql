-- Copy property settings (org Properties → Copy settings) — Pro (`growth`) and above.
-- Matrix: docs/architecture/plans-feature-matrix.md
-- Plan: docs/workflow/for-testing/property-settings-copy-to-properties.md

UPDATE public.pricing_plans
SET features = features || '{ "copyPropertySettings": false }'::jsonb
WHERE code IN ('free', 'starter', 'commission');

UPDATE public.pricing_plans
SET features = features || '{ "copyPropertySettings": true }'::jsonb
WHERE code IN ('growth', 'pro', 'managed', 'business_plus');
