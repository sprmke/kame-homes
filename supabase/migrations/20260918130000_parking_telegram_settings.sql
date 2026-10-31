-- Per-parking Telegram settings rows (same tables as property-scoped channels).
-- Exactly one of property_id or parking_id must be set on each row.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'telegram_marketing_settings',
    'telegram_staff_settings',
    'telegram_admin_settings',
    'telegram_finance_settings',
    'telegram_maintenance_settings'
  ]) LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS parking_id UUID REFERENCES public.parkings (id) ON DELETE CASCADE',
      t
    );
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN property_id DROP NOT NULL',
      t
    );
    -- Legacy singleton rows (property_id IS NULL) predate per-asset scoping.
    EXECUTE format(
      'DELETE FROM public.%I WHERE property_id IS NULL AND parking_id IS NULL',
      t
    );
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      t,
      t || '_asset_scope_check'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (
        ((property_id IS NOT NULL)::int + (parking_id IS NOT NULL)::int) = 1
      )',
      t,
      t || '_asset_scope_check'
    );
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (parking_id) WHERE parking_id IS NOT NULL',
      t || '_parking_id_unique',
      t
    );
  END LOOP;
END $$;

COMMENT ON COLUMN public.telegram_marketing_settings.parking_id IS
  'Parking-scoped Telegram marketing settings. Mutually exclusive with property_id.';
