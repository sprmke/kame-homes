-- Next-stay voucher redemption: mark awards redeemed + stamp applied discount on the new booking.

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS next_stay_voucher_redeemed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_stay_voucher_redeemed_booking_id UUID
    REFERENCES public.guest_submissions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_voucher_source_booking_id UUID
    REFERENCES public.guest_submissions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_voucher_code TEXT,
  ADD COLUMN IF NOT EXISTS applied_voucher_percent NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS applied_voucher_discount_php NUMERIC(12, 2);

COMMENT ON COLUMN public.guest_submissions.next_stay_voucher_redeemed_at IS
  'When this booking''s awarded next-stay voucher was redeemed on a later booking.';
COMMENT ON COLUMN public.guest_submissions.next_stay_voucher_redeemed_booking_id IS
  'Booking id that consumed this award (applied_voucher_source_booking_id on the redeeming row).';
COMMENT ON COLUMN public.guest_submissions.applied_voucher_source_booking_id IS
  'Prior booking that awarded the voucher applied to this stay.';
COMMENT ON COLUMN public.guest_submissions.applied_voucher_code IS
  'Snapshot of redeemed voucher code (e.g. OFF-10, FREE-STAY).';
COMMENT ON COLUMN public.guest_submissions.applied_voucher_percent IS
  'Percent off applied to stay rate (1–100). Legacy peso awards may store 0 and use discount_php only.';
COMMENT ON COLUMN public.guest_submissions.applied_voucher_discount_php IS
  'Peso discount locked when host sets booking_rate on review; null until then.';

CREATE INDEX IF NOT EXISTS guest_submissions_voucher_wallet_idx
  ON public.guest_submissions (guest_user_id, next_stay_voucher_awarded_at DESC)
  WHERE next_stay_voucher_code IS NOT NULL
    AND next_stay_voucher_redeemed_at IS NULL;

CREATE INDEX IF NOT EXISTS guest_submissions_applied_voucher_source_idx
  ON public.guest_submissions (applied_voucher_source_booking_id)
  WHERE applied_voucher_source_booking_id IS NOT NULL;
