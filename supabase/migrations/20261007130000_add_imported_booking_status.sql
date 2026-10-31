-- Widen guest_submissions.status CHECK to include IMPORTED (CSV import direct insert).

BEGIN;

ALTER TABLE guest_submissions
  DROP CONSTRAINT IF EXISTS guest_submissions_status_check;

ALTER TABLE guest_submissions
  ADD CONSTRAINT guest_submissions_status_check
  CHECK (status IN (
    'PENDING_REVIEW',
    'PENDING_DOCUMENTS',
    'PENDING_GAF',
    'PENDING_PARKING_REQUEST',
    'PENDING_PET_REQUEST',
    'READY_FOR_CHECKIN',
    'READY_FOR_CHECKOUT',
    'PENDING_SD_REFUND',
    'COMPLETED',
    'CANCELLED',
    'IMPORTED'
  ));

COMMENT ON COLUMN guest_submissions.status IS
  'Workflow status. Values: PENDING_REVIEW | PENDING_DOCUMENTS | PENDING_GAF | '
  'PENDING_PARKING_REQUEST | PENDING_PET_REQUEST | READY_FOR_CHECKIN | '
  'READY_FOR_CHECKOUT | PENDING_SD_REFUND | COMPLETED | CANCELLED | IMPORTED. '
  'IMPORTED is set only by import-commit direct insert; other transitions use workflowOrchestrator.';

COMMIT;
