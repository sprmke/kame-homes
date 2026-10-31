-- Per-tier volume ramp config (super-admin editable; defaults match shipped product policy).
ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS volume_ramp_floor_php INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS volume_ramp_at_count INTEGER NOT NULL DEFAULT 10;

ALTER TABLE public.pricing_plans
  ADD CONSTRAINT pricing_plans_volume_ramp_floor_nonneg
    CHECK (volume_ramp_floor_php >= 0);

ALTER TABLE public.pricing_plans
  ADD CONSTRAINT pricing_plans_volume_ramp_at_min
    CHECK (volume_ramp_at_count >= 1);

COMMENT ON COLUMN public.pricing_plans.volume_ramp_floor_php IS
  'Per-property floor (PHP) at volume_ramp_at_count enrolled properties during the 1…N linear ramp — see planPricing.ts#resolveRampEffectivePerPropertyPhp.';

COMMENT ON COLUMN public.pricing_plans.volume_ramp_at_count IS
  'Property count at which the linear ramp reaches volume_ramp_floor_php; counts above this use volume_discount_tiers.';
