-- Phase 7 — new notification type fired when a linked marketplace parking payment auto-clears
-- the property booking's PENDING_PARKING_REQUEST gate
-- (parkingPaymentOrchestrator.ts#fulfillParkingPayment).

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
    'inbox_new_message'
  )
);
