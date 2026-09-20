-- Production-readiness doc 19 Phase 19.6.
-- Run after a prod → local public-schema restore so guest PII does not sit
-- on developer machines. Shape (row counts, statuses, dates) is preserved.
-- Skip with SKIP_PII_SCRUB=1 on the sync script.

BEGIN;

UPDATE guest_submissions
SET
  guest_email = 'guest-' || id::text || '@example.invalid',
  guest_phone_number = '0000000000',
  guest_facebook_name = 'Scrubbed Guest',
  primary_guest_name = 'Scrubbed Guest';

UPDATE guest_submissions SET guest2_name = 'Scrubbed Guest' WHERE guest2_name IS NOT NULL AND guest2_name <> '';
UPDATE guest_submissions SET guest3_name = 'Scrubbed Guest' WHERE guest3_name IS NOT NULL AND guest3_name <> '';
UPDATE guest_submissions SET guest4_name = 'Scrubbed Guest' WHERE guest4_name IS NOT NULL AND guest4_name <> '';
UPDATE guest_submissions SET guest5_name = 'Scrubbed Guest' WHERE guest5_name IS NOT NULL AND guest5_name <> '';

COMMIT;
