-- Guest AI receptionist write tools — host notification when a guest submits a request.
-- Plan: docs/workflow/in-progress/agentic-ai-assistants.md (Phase 5, guest write tools)
--
-- guest_request_submitted : request_booking_inquiry / request_early_checkin_late_checkout tools
--                            (guestReceptionistTools.ts) created a guest_requests row
--                            (dedupe <guest_request_id>:guest_request_submitted)
--
-- Carries every type from 20261316128980 + the addition.

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
    'booking_guest_form_completed',
    'smart_pricing_updated',
    'property_settings_copied',
    'analytics_review_updated',
    'review_received',
    'review_due',
    'review_response_received',
    'maintenance_guest_reported',
    'guest_request_submitted'
  )
);
