-- Smart Pricing — autopilot cron notification.
-- Plan: docs/workflow/in-progress/smart-pricing-ai.md
--
-- smart_pricing_updated : smart-pricing-cron re-applied Smart Pricing rates for a property
--                         and the change was material (dedupe smart_pricing:<propertyId>:<yyyy-mm-dd>)
--
-- Carries every type from 20261214120200 + the addition.

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
    'smart_pricing_updated'
  )
);
