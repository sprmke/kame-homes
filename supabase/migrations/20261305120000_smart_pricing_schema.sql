-- Smart Pricing — AI-assisted dynamic nightly rates.
-- Plan: docs/workflow/planned/smart-pricing-ai.md
-- Deterministic base x multiplier engine over first-party calendar history.
-- Gated on the `smartPricing` plan feature (Pro / `growth` and above) — see
-- 20261305120200_smart_pricing_plan_feature.sql.
--
-- Three tables, all edge-function-only (service_role); no client-facing RLS policy,
-- matching property_pricing_date_overrides and every other property-scoped table.

-- 1. Per-property configuration (1:1 with properties).
CREATE TABLE IF NOT EXISTS public.property_smart_pricing_settings (
  property_id UUID PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  -- review_only: never auto-applies; host applies from the Suggestions tab.
  -- autopilot: the nightly cron recomputes and applies automatically.
  mode TEXT NOT NULL DEFAULT 'review_only' CHECK (mode IN ('review_only', 'autopilot')),
  base_source TEXT NOT NULL DEFAULT 'property_rates'
    CHECK (base_source IN ('property_rates', 'custom')),
  base_weekday NUMERIC(12, 2) CHECK (base_weekday IS NULL OR base_weekday >= 0),
  base_weekend NUMERIC(12, 2) CHECK (base_weekend IS NULL OR base_weekend >= 0),
  min_price NUMERIC(12, 2) CHECK (min_price IS NULL OR min_price >= 0),
  max_price NUMERIC(12, 2) CHECK (max_price IS NULL OR max_price >= 0),
  aggressiveness TEXT NOT NULL DEFAULT 'balanced'
    CHECK (aggressiveness IN ('conservative', 'balanced', 'aggressive')),
  -- { "0".."6": pct } weekday->Sunday multiplier adjustments, learned + host overrides.
  dow_adjust JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- [ { id, name, startDate, endDate, percentage } ] — widened holiday rules.
  season_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- { lastMinute: [ { withinDays, pct } ], farOut: [ { beyondDays, pct } ] }
  lead_time JSONB NOT NULL DEFAULT '{}'::jsonb,
  orphan_gap_discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 15
    CHECK (orphan_gap_discount_pct >= 0 AND orphan_gap_discount_pct <= 90),
  occupancy_tilt_enabled BOOLEAN NOT NULL DEFAULT true,
  -- { weeklyPct, monthlyPct } — Phase 4, needs guest-quote LOS support.
  los_discounts JSONB NOT NULL DEFAULT '{}'::jsonb,
  rounding TEXT NOT NULL DEFAULT 'r50' CHECK (rounding IN ('r50', 'r99', 'r100', 'none')),
  window_days INTEGER NOT NULL DEFAULT 365 CHECK (window_days BETWEEN 30 AND 730),
  ai_rationale_enabled BOOLEAN NOT NULL DEFAULT false,
  last_run_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT property_smart_pricing_settings_price_bounds
    CHECK (min_price IS NULL OR max_price IS NULL OR max_price >= min_price)
);

COMMENT ON TABLE public.property_smart_pricing_settings IS
  'Per-property Smart Pricing configuration (Pricing page). Deterministic engine knobs; '
  'gated on the smartPricing plan feature.';

-- 2. Audit of each computation run.
CREATE TABLE IF NOT EXISTS public.property_smart_pricing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL CHECK (trigger IN ('cron', 'manual_preview', 'manual_apply')),
  window_start DATE,
  window_end DATE,
  nights_computed INTEGER NOT NULL DEFAULT 0,
  nights_changed INTEGER NOT NULL DEFAULT 0,
  avg_delta_pct NUMERIC(7, 2),
  ai_used BOOLEAN NOT NULL DEFAULT false,
  credits_consumed NUMERIC(12, 3) NOT NULL DEFAULT 0,
  error TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_smart_pricing_runs_property_created_idx
  ON public.property_smart_pricing_runs (property_id, created_at DESC);

COMMENT ON TABLE public.property_smart_pricing_runs IS
  'One row per Smart Pricing computation (cron sweep, manual preview, or manual apply).';

-- 3. Per-date recommendation set. `applied` rows are merged into the effective nightly
--    rate (guest quote + calendar) just above holiday rules, below host locks/bookings.
CREATE TABLE IF NOT EXISTS public.property_smart_pricing_recommendations (
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  pricing_date DATE NOT NULL,
  base_rate NUMERIC(12, 2) NOT NULL CHECK (base_rate >= 0),
  recommended_rate NUMERIC(12, 2) NOT NULL CHECK (recommended_rate >= 0),
  -- [ { key, label, multiplier } ] breakdown for the calendar tooltip.
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  applied BOOLEAN NOT NULL DEFAULT false,
  applied_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'engine' CHECK (source IN ('engine', 'engine_ai')),
  run_id UUID REFERENCES public.property_smart_pricing_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (property_id, pricing_date)
);

CREATE INDEX IF NOT EXISTS property_smart_pricing_recommendations_applied_idx
  ON public.property_smart_pricing_recommendations (property_id, applied, pricing_date);

COMMENT ON TABLE public.property_smart_pricing_recommendations IS
  'Per-date Smart Pricing recommendations. applied=true rows resolve above holiday rules '
  'and below host date overrides / bookings / blocks.';

ALTER TABLE public.property_smart_pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_smart_pricing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_smart_pricing_recommendations ENABLE ROW LEVEL SECURITY;
