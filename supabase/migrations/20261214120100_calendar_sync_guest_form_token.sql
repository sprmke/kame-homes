-- Airbnb / OTA two-way calendar sync — Phase 2 (guest-form completion link).
-- Plan: docs/workflow/done/airbnb-calendar-sync.md §5.6 / §6.5
--
-- An ingested booking has dates but no guest details. The host copies
-- <app-origin>/form?complete=<token> and forwards it to the Airbnb guest, who completes
-- the normal guest form against THAT existing row — dates locked to the reservation.
--
-- Mirrors stay_guide_token / document_share_token: nullable, one active token per booking,
-- re-issue rotates. No expiry column — the link 410s once check_out_date is in the past
-- (or the row is CANCELLED). guest_form_completed_at is stamped when the guest submits.

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS guest_form_token           text,
  ADD COLUMN IF NOT EXISTS guest_form_token_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS guest_form_completed_at    timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS guest_submissions_guest_form_token_key
  ON public.guest_submissions (guest_form_token)
  WHERE guest_form_token IS NOT NULL;

COMMENT ON COLUMN public.guest_submissions.guest_form_token IS
  'Opaque token in <origin>/form?complete=<token> for the host-forwarded guest-form completion flow (Airbnb bookings).';
