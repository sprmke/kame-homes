-- Smart Pricing — AI-assisted dynamic nightly rates.
-- Plan: docs/workflow/planned/smart-pricing-ai.md
-- Matrix: docs/architecture/plans-feature-matrix.md
--
-- `smartPricing` — deterministic base x multiplier engine over the property's own calendar
-- history + forward occupancy, surfaced on the Pricing page (Autopilot cron or Review-and-
-- apply diff) with an optional AI rationale pass. Pro (`growth`) and above — same gate shape
-- as `calendarSync` (both are Pricing-page power tools).

UPDATE public.pricing_plans
SET features = features || '{ "smartPricing": false }'::jsonb
WHERE code IN ('free', 'starter', 'commission');

UPDATE public.pricing_plans
SET features = features || '{ "smartPricing": true }'::jsonb
WHERE code IN ('growth', 'pro', 'managed', 'business_plus');
