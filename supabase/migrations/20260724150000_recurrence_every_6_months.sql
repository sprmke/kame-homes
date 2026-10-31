-- Allow every_6_months (twice a year) recurrence on finance + maintenance line items.

ALTER TABLE public.finance_line_items
  DROP CONSTRAINT IF EXISTS finance_line_items_recurrence_interval_check;

ALTER TABLE public.finance_line_items
  ADD CONSTRAINT finance_line_items_recurrence_interval_check
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

COMMENT ON COLUMN public.finance_line_items.recurrence_interval IS
  'daily | weekly | monthly | twice_monthly | every_2_months | quarterly | every_6_months | yearly; NULL for one-off lines.';

-- maintenance_items is created in 20260818120000_maintenance_module.sql; interval
-- updates for that table run in 20260819120000 + 20260821130000.
