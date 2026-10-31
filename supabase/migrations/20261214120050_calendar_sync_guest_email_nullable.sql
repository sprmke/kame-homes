-- Airbnb / OTA two-way calendar sync — Phase 2.
-- Plan: docs/workflow/done/airbnb-calendar-sync.md §6.3
--
-- An OTA-ingested reservation (calendar-sync-cron, feed.create_bookings = true) has no
-- guest email until the guest completes the host-forwarded guest form. A NULL guest_email
-- is the single signal every guest-facing side effect keys off — see the suppression guard
-- in _shared/workflowOrchestrator.ts and sd-refund-cron.
--
-- The existing email-format CHECK on guest_submissions.guest_email still holds for non-NULL
-- values (a SQL CHECK is satisfied when it evaluates to NULL), so only NOT NULL is dropped.
-- guest_phone_number / guest_address / guest_facebook_name stay NOT NULL — calendarSyncRun
-- inserts '' / the placeholder name for those, which the columns already accept.

ALTER TABLE public.guest_submissions
  ALTER COLUMN guest_email DROP NOT NULL;

COMMENT ON COLUMN public.guest_submissions.guest_email IS
  'Guest email. NULL only for OTA-ingested rows awaiting guest-form completion — suppresses all guest-facing side effects while blank.';
