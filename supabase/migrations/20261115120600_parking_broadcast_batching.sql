-- Phase 2 match engine: ranked batched dispatch for parking broadcasts (batches of N=3
-- instead of notifying every eligible candidate at once).

ALTER TABLE public.parking_booking_broadcasts
  ADD COLUMN IF NOT EXISTS batch_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS host_gross_at_broadcast NUMERIC(12, 2);

COMMENT ON COLUMN public.parking_booking_broadcasts.batch_number IS
  'Which ranked dispatch round this candidate was offered in (1 = first/cheapest batch).';
COMMENT ON COLUMN public.parking_booking_broadcasts.host_gross_at_broadcast IS
  'host_gross used to rank this candidate at broadcast time (audit trail only, never guest-facing).';

CREATE INDEX IF NOT EXISTS parking_booking_broadcasts_booking_batch_idx
  ON public.parking_booking_broadcasts (booking_id, batch_number, response);

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS parking_broadcast_batch_number INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.guest_submissions.parking_broadcast_batch_number IS
  'Active ranked-dispatch round for a PENDING_HOST_ACCEPTANCE parking request; advanced by '
  'advanceOrTerminateParkingBatch() when a batch fully declines/expires with more candidates left.';
