-- Phase 6 of docs/workflow/in-progress/production-readiness-hardening.md.
--
-- 1) Non-negative CHECK constraints on guest_submissions money/pricing columns.
--    Added NOT VALID so existing rows are never re-validated (zero risk to any
--    legacy/import data that might already have an unexpected value) — only
--    NEW inserts/updates are checked from this point forward. Safe because the
--    client already enforces the same rule today (ReviewPricingForm.tsx uses
--    requiredNonNegativeMoney/optionalNonNegativeMoney for booking_rate,
--    down_payment, security_deposit, pet_fee, parking_rate_guest,
--    guest_additional_fee), and no server code path writes a negative literal
--    to any of these columns.
ALTER TABLE public.guest_submissions
  ADD CONSTRAINT guest_submissions_booking_rate_nonneg
    CHECK (booking_rate IS NULL OR booking_rate >= 0) NOT VALID,
  ADD CONSTRAINT guest_submissions_down_payment_nonneg
    CHECK (down_payment IS NULL OR down_payment >= 0) NOT VALID,
  ADD CONSTRAINT guest_submissions_balance_nonneg
    CHECK (balance IS NULL OR balance >= 0) NOT VALID,
  ADD CONSTRAINT guest_submissions_security_deposit_nonneg
    CHECK (security_deposit IS NULL OR security_deposit >= 0) NOT VALID,
  ADD CONSTRAINT guest_submissions_pet_fee_nonneg
    CHECK (pet_fee IS NULL OR pet_fee >= 0) NOT VALID,
  ADD CONSTRAINT guest_submissions_parking_rate_guest_nonneg
    CHECK (parking_rate_guest IS NULL OR parking_rate_guest >= 0) NOT VALID,
  ADD CONSTRAINT guest_submissions_guest_additional_fee_nonneg
    CHECK (guest_additional_fee IS NULL OR guest_additional_fee >= 0) NOT VALID,
  ADD CONSTRAINT guest_submissions_guest_balance_paid_amount_nonneg
    CHECK (guest_balance_paid_amount IS NULL OR guest_balance_paid_amount >= 0) NOT VALID;

-- 2) Missing composite/partial indexes flagged in the review. Purely additive —
--    CREATE INDEX never changes query results, only planner behavior.
CREATE INDEX IF NOT EXISTS idx_guest_submissions_property_id_created_at
  ON public.guest_submissions (property_id, created_at DESC)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guest_submissions_parking_id_created_at
  ON public.guest_submissions (parking_id, created_at DESC)
  WHERE parking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guest_submissions_ready_for_checkin
  ON public.guest_submissions (property_id, id)
  WHERE status = 'READY_FOR_CHECKIN';

CREATE INDEX IF NOT EXISTS idx_finance_line_items_property_id_occurred_on
  ON public.finance_line_items (property_id, occurred_on DESC)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_items_property_id_scheduled_on
  ON public.maintenance_items (property_id, scheduled_on DESC);

-- Deliberately NOT done in this migration (see plan doc Phase 6):
--   - booking_source CHECK constraint: real, currently-written values go beyond
--     the 3 UI options ('Direct'/'Facebook'/'Airbnb') — 'Parking' bookings, plus
--     booking-import pass-through of arbitrary OTA channel names (e.g.
--     'Booking.com', 'Agoda') that are NOT re-normalized at commit time
--     (importNormalization.ts only normalizes known aliases during preview).
--     A strict enum CHECK here would risk rejecting a legitimate future import.
--   - valid_dates CHECK widening (MM-DD-YYYY-only today): every current write
--     path to guest_submissions.check_in_date/check_out_date already converts
--     to MM-DD-YYYY before the INSERT/UPDATE (e.g. calendarSyncRun.ts's
--     ymdToMmDdYyyy() call before writing startMdy/endMdy) — no confirmed
--     production path is actually blocked by the current constraint, so
--     loosening this load-bearing constraint without concrete evidence (or
--     live testing, unavailable this session — see Phase 4 notes) isn't a
--     safe trade today.
