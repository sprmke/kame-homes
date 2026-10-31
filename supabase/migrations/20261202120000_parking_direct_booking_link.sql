-- Phase 8: shareable host-initiated direct parking booking link, half-commission channel.
-- Reuses the existing pinned-listing submit path (parkingId already skips ranking/matching for
-- a pinned request since Phase 2) — this migration only adds what's actually new: an unguessable
-- per-listing token to disambiguate "came via the shared link" from "matched via search", a
-- separate admin-configurable commission rate for that channel, and a snapshot of which channel
-- applied on both the booking and its resulting payment transaction.

-- 1) Per-listing direct-booking token, generated lazily on first dashboard "copy link" (see
-- parkingDirectLink.ts#ensureParkingDirectBookingToken) rather than backfilled for every row.
ALTER TABLE public.parkings
  ADD COLUMN IF NOT EXISTS direct_booking_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_parkings_direct_booking_token
  ON public.parkings (direct_booking_token)
  WHERE direct_booking_token IS NOT NULL;

COMMENT ON COLUMN public.parkings.direct_booking_token IS
  'Opaque per-listing token for the Phase 8 direct-booking link (/parkings/:slug/form?dl=<token>). '
  'Generated on demand (ensureParkingDirectBookingToken), never guessable/sequential — matching '
  'it at submit time is what tags a booking as the reduced-commission direct_link channel instead '
  'of standard. Not itself a secret requiring rotation (losing it only loses the discount, never '
  'grants access to anything), but kept unguessable so a guest/host can''t game the discount by '
  'guessing another host''s token.';

-- 2) Admin-configurable direct-link commission, independent of the standard rate (decision #1 —
-- half the standard rate by default, but tunable separately since the two are meant to diverge).
ALTER TABLE public.platform_parking_settings
  ADD COLUMN IF NOT EXISTS direct_commission_pct NUMERIC(5, 4) NOT NULL DEFAULT 0.05;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_parking_settings_direct_commission_range'
  ) THEN
    ALTER TABLE public.platform_parking_settings
      ADD CONSTRAINT platform_parking_settings_direct_commission_range
      CHECK (direct_commission_pct >= 0 AND direct_commission_pct <= 1);
  END IF;
END $$;

COMMENT ON COLUMN public.platform_parking_settings.direct_commission_pct IS
  'Commission % applied to bookings made through a host''s Phase 8 direct-booking link, instead '
  'of commission_pct. Independently configurable (decision #1) — defaults to half of the '
  'standard rate but the two are not kept in sync automatically.';

-- 3) Booking channel, set once at submit time (submit-parking-booking-request), read at payment
-- time to pick the right commission rate — never recomputed retroactively, same snapshot
-- discipline as commission_pct itself (Phase 4 decision #4).
ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS parking_booking_channel TEXT NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guest_submissions_parking_booking_channel_check'
  ) THEN
    ALTER TABLE public.guest_submissions
      ADD CONSTRAINT guest_submissions_parking_booking_channel_check
      CHECK (parking_booking_channel IN ('standard', 'direct_link'));
  END IF;
END $$;

COMMENT ON COLUMN public.guest_submissions.parking_booking_channel IS
  'How this parking request was sourced: standard (search/match engine) or direct_link (Phase 8 '
  'shareable host link, verified against parkings.direct_booking_token at submit time). Read once '
  'at payment-link creation to pick commission_pct vs direct_commission_pct, then that resolved '
  'rate is snapshotted onto parking_payment_transactions same as before — this column is not '
  're-read after that point.';

-- 4) Same channel tag snapshotted onto the transaction row for permanent audit — mirrors how
-- commission_pct itself is snapshotted rather than joined back to guest_submissions later.
ALTER TABLE public.parking_payment_transactions
  ADD COLUMN IF NOT EXISTS booking_channel TEXT NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'parking_payment_transactions_booking_channel_check'
  ) THEN
    ALTER TABLE public.parking_payment_transactions
      ADD CONSTRAINT parking_payment_transactions_booking_channel_check
      CHECK (booking_channel IN ('standard', 'direct_link'));
  END IF;
END $$;

COMMENT ON COLUMN public.parking_payment_transactions.booking_channel IS
  'Snapshot of guest_submissions.parking_booking_channel at payment-link creation time — which '
  'commission rate (commission_pct here) actually applied. Kept alongside the transaction, not '
  're-derived by joining back to the booking, for the same reason commission_pct is a snapshot.';
