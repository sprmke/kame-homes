-- Tighten `valid_dates` now that the legacy stay dates are repaired.
--
-- 20261317120000_same_day_stay_dates.sql added the constraint production never had and
-- grandfathered rows created before 2025-06-01, because 41 bookings carried a check-out date
-- before their check-in. Those 41 turned out to be the negative-span subset of 65 bookings
-- from the same 2025 edit bug; all 65 are repaired from the upload filenames the guest form
-- writes (see docs/workflow/in-progress/production-readiness/evidence/
-- legacy-stay-date-reconstruction.md). With the data consistent, the cutoff can go and every
-- row is checked again.
--
-- Same-day stays stay valid (check-out may equal check-in); only an inverted range is
-- rejected. Both stored formats remain accepted.

ALTER TABLE public.guest_submissions DROP CONSTRAINT IF EXISTS valid_dates;

ALTER TABLE public.guest_submissions
  ADD CONSTRAINT valid_dates CHECK (
    (
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

ALTER TABLE public.guest_submissions VALIDATE CONSTRAINT valid_dates;

COMMENT ON CONSTRAINT valid_dates ON public.guest_submissions IS
  'Check-out may equal check-in (same-day stay) but never come before it. No grandfather clause: the 65 legacy rows were repaired on 2026-11-03.';
