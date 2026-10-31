-- Marketing Content Studio (edit without watermark, download, publish) moves to the Pro plan.
-- AI content generation (`aiMarketingGeneration`) stays Business+ — unchanged.
-- Matrix: docs/architecture/plans-feature-matrix.md
--
-- "Pro" = plan card labelled Pro = internal code `growth` (see 20261029120000).
-- `marketingStudio` was Starter+ (20261029120000); now Pro+ only.
-- `commission` tracked with the Starter-equivalent tier, so it loses access too.

UPDATE public.pricing_plans
SET features = jsonb_set(features, '{marketingStudio}', 'false'::jsonb, true)
WHERE code IN ('free', 'starter', 'commission');

UPDATE public.pricing_plans
SET features = jsonb_set(features, '{marketingStudio}', 'true'::jsonb, true)
WHERE code IN ('growth', 'pro', 'managed', 'business_plus');
