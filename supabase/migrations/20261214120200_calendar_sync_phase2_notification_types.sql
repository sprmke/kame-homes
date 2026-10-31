-- Airbnb / OTA two-way calendar sync — Phase 2.
-- Plan: docs/workflow/done/airbnb-calendar-sync.md §13
--
-- booking_external_imported     : calendar-sync-cron created a real guest_submissions row
--                                 from an OTA reservation (dedupe booking:<id>:external_imported)
-- booking_guest_form_completed  : the Airbnb guest finished the forwarded completion form
--                                 (dedupe booking:<id>:guest_form_completed)
--
-- Carries every type from 20261213120400 (Phase 1) + the two Phase 2 additions.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'booking_pending_review',
    'booking_ready_for_checkin',
    'booking_ready_for_checkout',
    'booking_sd_refund_due',
    'booking_gaf_auto_approved',
    'booking_pet_auto_approved',
    'booking_parking_matched',
    'inbox_new_message',
    'calendar_sync_failing',
    'calendar_conflict',
    'booking_external_imported',
    'booking_guest_form_completed'
  )
);
