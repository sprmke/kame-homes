-- Two-way reviews: persist the auto-review skip decision per booking.
-- Plan: docs/workflow/for-testing/two-way-reviews.md (Phase 7, review pass)
--
-- Auto-review skips a booking with issue tags, open maintenance, an SD
-- deduction or an unusable template. Without a stored decision the hourly
-- review-lifecycle-cron re-evaluated and re-counted the same booking every run
-- until its window closed. Additive and nullable.

BEGIN;

ALTER TABLE public.booking_review_windows
  ADD COLUMN IF NOT EXISTS auto_review_skipped_reason TEXT;

COMMENT ON COLUMN public.booking_review_windows.auto_review_skipped_reason IS
  'Set by review-lifecycle-cron when auto-review decides not to review this booking; the host reviews manually.';

COMMIT;
