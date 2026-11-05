-- Guest AI receptionist maintenance reports — host notification.
-- Plan: docs/workflow/in-progress/agentic-ai-assistants.md (Phase 5, guest write tools)
--
-- maintenance_guest_reported : report_maintenance_issue tool (guestReceptionistTools.ts) filed a
--                               maintenance_items row from the guest's own active stay
--                               (dedupe <maintenance_item_id>:maintenance_guest_reported)
--
-- Carries every type from 20261316127600 + the addition.

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
    'maintenance_guest_reported'
  )
);
