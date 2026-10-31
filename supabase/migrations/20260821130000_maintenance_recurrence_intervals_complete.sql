-- Recurrence intervals for maintenance_items (table created in 20260818120000).
-- twice_monthly + every_6_months were skipped in 20260724* migrations (table did not exist yet).

ALTER TABLE public.maintenance_items
  DROP CONSTRAINT IF EXISTS maintenance_items_recurrence_interval_check;

ALTER TABLE public.maintenance_items
  ADD CONSTRAINT maintenance_items_recurrence_interval_check
  CHECK (
    recurrence_interval IS NULL
    OR recurrence_interval IN (
      'daily',
      'weekly',
      'monthly',
      'twice_monthly',
      'every_2_months',
      'quarterly',
      'every_6_months',
      'yearly'
    )
  );
