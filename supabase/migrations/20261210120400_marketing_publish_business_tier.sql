-- Meta publishing moves to the Business plan (internal code `pro`).
-- Pro (`growth`) keeps Content Studio download via `marketingStudio` but cannot publish (limit 0).
-- Business+ keeps unlimited publishes (`marketingPublishLimitPerGroup` null).
-- Matrix: docs/architecture/plans-feature-matrix.md

UPDATE public.pricing_plans
SET features = jsonb_set(features, '{marketingPublishLimitPerGroup}', '0'::jsonb, true)
WHERE code IN ('free', 'starter', 'growth', 'commission');

UPDATE public.pricing_plans
SET features = jsonb_set(features, '{marketingPublishLimitPerGroup}', 'null'::jsonb, true)
WHERE code IN ('pro', 'managed', 'business_plus');
