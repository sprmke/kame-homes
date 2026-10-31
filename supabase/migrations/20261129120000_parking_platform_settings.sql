-- Phase 4 match engine: super-admin-configurable commission % + guest rate (replaces the
-- Phase 2/3 interim flat stubs), plus manual-disbursement/clawback ledger columns.

CREATE TABLE IF NOT EXISTS public.platform_parking_settings (
  id INT PRIMARY KEY DEFAULT 1,
  commission_pct NUMERIC(5, 4) NOT NULL DEFAULT 0.10,
  guest_rate_weekday NUMERIC(12, 2) NOT NULL DEFAULT 400,
  guest_rate_weekend NUMERIC(12, 2) NOT NULL DEFAULT 400,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT platform_parking_settings_singleton CHECK (id = 1),
  CONSTRAINT platform_parking_settings_commission_range CHECK (
    commission_pct >= 0 AND commission_pct <= 1
  ),
  CONSTRAINT platform_parking_settings_rates_nonnegative CHECK (
    guest_rate_weekday >= 0 AND guest_rate_weekend >= 0
  )
);

COMMENT ON TABLE public.platform_parking_settings IS
  'Singleton commission % + guest rate config for the parkings vertical. Replaces the Phase '
  '2/3 interim flat stubs (STUB_GUEST_PARKING_RATE_*/STUB_COMMISSION_PCT in parkingPricing.ts, '
  'kept only as a fallback if this row is ever missing) -- resolveParkingPlatformSettings() is '
  'the single source of truth. Values are snapshotted onto parking_payment_transactions at '
  'checkout-creation time, never recomputed retroactively for an existing transaction.';

INSERT INTO public.platform_parking_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS update_platform_parking_settings_updated_at ON public.platform_parking_settings;
CREATE TRIGGER update_platform_parking_settings_updated_at
  BEFORE UPDATE ON public.platform_parking_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.platform_parking_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.platform_parking_settings TO service_role;

-- Manual disbursement + clawback tracking on the Phase 3 transaction ledger.
ALTER TABLE public.parking_payment_transactions
  ADD COLUMN IF NOT EXISTS disbursed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disbursed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disbursement_reference TEXT,
  ADD COLUMN IF NOT EXISTS disbursement_method TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS clawback_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS clawback_reason TEXT,
  ADD COLUMN IF NOT EXISTS clawback_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clawback_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parking_payment_transactions_disbursement_method_check'
  ) THEN
    ALTER TABLE public.parking_payment_transactions
      ADD CONSTRAINT parking_payment_transactions_disbursement_method_check
      CHECK (disbursement_method IN ('manual', 'paymongo_platforms'));
  END IF;
END $$;

COMMENT ON COLUMN public.parking_payment_transactions.disbursed_at IS
  'Super-admin manually marked this booking''s host payout as disbursed (Phase 4 day-one path '
  '-- disbursement_method stays ''manual'' until real PayMongo Platforms split-payout ships).';
COMMENT ON COLUMN public.parking_payment_transactions.clawback_amount IS
  'Manual admin-recorded clawback (e.g. chargeback after disbursement) -- audit trail only, '
  'no automated collection.';
