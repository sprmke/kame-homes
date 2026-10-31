-- Phase 7: property-booking migration. Lets a marketplace parking booking (`parking_id` row)
-- point back at the property stay (`property_id` row) it was self-served from, so payment
-- success can auto-complete that property booking's PENDING_PARKING_REQUEST gate and the
-- property booking detail page can show live match/host-contact status instead of legacy
-- manual fields.

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS linked_property_booking_id UUID
    REFERENCES public.guest_submissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parking_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.guest_submissions.linked_property_booking_id IS
  'Set only on a parking_id row, pointing at the property_id row (this table also holds '
  'property bookings, mutually exclusive with parking_id via a CHECK constraint) it was '
  'self-served from via the marketplace flow. Ownership + linkability are verified in '
  'submit-parking-booking-request, not enforced here -- this table''s RLS is USING (true) by '
  'convention, real authorization lives in edge functions.';
COMMENT ON COLUMN public.guest_submissions.parking_reminder_sent_at IS
  'Property booking only (need_parking = true, not yet linked to a marketplace booking). Set '
  'once the pre-arrival reminder cron sends its one-time self-serve link email -- guarded '
  'update dedupe guard, never overwritten.';

CREATE INDEX IF NOT EXISTS guest_submissions_linked_property_booking_id_idx
  ON public.guest_submissions (linked_property_booking_id)
  WHERE linked_property_booking_id IS NOT NULL;
