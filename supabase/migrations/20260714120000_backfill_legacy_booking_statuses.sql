-- One-shot backfill for any guest_submissions rows still using legacy status literals.
-- Idempotent — safe to re-run. Application code no longer reads `booked` / `canceled`.

BEGIN;

UPDATE guest_submissions
SET
  status = 'CANCELLED',
  status_updated_at = COALESCE(status_updated_at, updated_at, created_at, NOW())
WHERE status = 'canceled';

UPDATE guest_submissions
SET
  status = 'COMPLETED',
  status_updated_at = COALESCE(status_updated_at, updated_at, created_at, NOW()),
  settled_at = COALESCE(settled_at, updated_at, created_at, NOW())
WHERE status = 'booked'
  AND (
    (
      check_in_date ~ '^\d{4}-\d{2}-\d{2}$'
      AND check_in_date::DATE < (NOW() AT TIME ZONE 'Asia/Manila')::DATE
    )
    OR (
      check_in_date ~ '^\d{2}-\d{2}-\d{4}$'
      AND TO_DATE(check_in_date, 'MM-DD-YYYY') < (NOW() AT TIME ZONE 'Asia/Manila')::DATE
    )
  );

UPDATE guest_submissions
SET
  status = 'PENDING_REVIEW',
  status_updated_at = COALESCE(status_updated_at, updated_at, created_at, NOW())
WHERE status = 'booked';

COMMIT;
