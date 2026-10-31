-- Smart Pricing — freeze the full computed rate set on the run row so `smart-pricing-apply`
-- applies exactly what was previewed (re-checking availability per night), and so a preview
-- never has to touch the canonical `property_smart_pricing_recommendations` table (which only
-- ever holds applied rows + autopilot output). Also stashes the optional AI-pass output.

ALTER TABLE public.property_smart_pricing_runs
  ADD COLUMN IF NOT EXISTS payload JSONB,
  ADD COLUMN IF NOT EXISTS ai_warnings JSONB,
  ADD COLUMN IF NOT EXISTS ai_rationales JSONB,
  ADD COLUMN IF NOT EXISTS suggested_min_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS suggested_max_price NUMERIC(12, 2);

COMMENT ON COLUMN public.property_smart_pricing_runs.payload IS
  'Frozen SmartRateResult[] for a manual_preview run — read back by smart-pricing-apply.';
