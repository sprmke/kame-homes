-- Airbnb / OTA two-way calendar sync — Phase 1.
-- Plan: docs/workflow/done/airbnb-calendar-sync.md §13
--
-- calendar_sync_failing  : a feed has failed >= 4 consecutive polls (dedupe feed:<id>:failing)
-- calendar_conflict      : an imported reservation overlaps a direct booking / manual block / another feed
--
-- Phase 2 will add booking_external_imported + booking_guest_form_completed in its own migration.

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
    'calendar_conflict'
  )
);
