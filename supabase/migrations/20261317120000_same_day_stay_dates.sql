-- Same-day stays (day use) + restore the missing stay-date guard.
--
-- 1. Production never had `valid_dates`. The table was created outside the migration chain
--    (the original migration uses CREATE TABLE IF NOT EXISTS, which was a no-op there), so
--    the constraint set drifted: `pg_constraint` on production has `valid_times` but no
--    `valid_dates`. Evidence: docs/workflow/in-progress/production-readiness/evidence/
--    restore-drill-2026-11-03.md.
-- 2. The product allows same-day stays: a guest may check in and out on the same date
--    (day use). They occupy the check-in night, so `check_out_date = check_in_date` is valid
--    and `number_of_nights` is 1 (see occupiedStayNights in _shared/utils.ts).
--
-- 41 rows created 2025-03..05 carry `check_out_date < check_in_date` from a legacy form bug
-- with no reliable source of truth to repair (they were edited, but arrival, departure and
-- nights disagree, so any rewrite would invent history). Rows created before 2025-06-01 are
-- therefore grandfathered; every newer row is validated. Both stored formats are accepted
-- because the table genuinely holds both (MM-DD-YYYY canonical, a few legacy YYYY-MM-DD);
-- application validators enforce ordering on every write path.

ALTER TABLE public.guest_submissions DROP CONSTRAINT IF EXISTS valid_dates;

ALTER TABLE public.guest_submissions
  ADD CONSTRAINT valid_dates CHECK (
    -- Legacy rows (grandfathered): see the note above.
    (created_at IS NOT NULL AND created_at < TIMESTAMPTZ '2025-06-01 00:00:00+00')
    OR (
      check_in_date ~ '^\d{2}-\d{2}-\d{4}$'
      AND check_out_date ~ '^\d{2}-\d{2}-\d{4}$'
      AND to_date(check_out_date, 'MM-DD-YYYY') >= to_date(check_in_date, 'MM-DD-YYYY')
    )
    OR (
      check_in_date ~ '^\d{4}-\d{2}-\d{2}$'
      AND check_out_date ~ '^\d{4}-\d{2}-\d{2}$'
      AND to_date(check_out_date, 'YYYY-MM-DD') >= to_date(check_in_date, 'YYYY-MM-DD')
    )
  ) NOT VALID;

-- Existing data conforms (0 rows created on/after the cutoff violate the rule), so validate
-- now instead of leaving an unvalidated constraint behind.
ALTER TABLE public.guest_submissions VALIDATE CONSTRAINT valid_dates;

COMMENT ON CONSTRAINT valid_dates ON public.guest_submissions IS
  'Check-out may equal check-in (same-day stay) but never come before it. Pre-2025-06-01 rows are grandfathered legacy data.';
