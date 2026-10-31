-- Phase 5: endorsement automation (auto-send on payment success, resend-on-failure,
-- in-app copy) + admin escalation contact.

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS endorsement_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS endorsement_send_error TEXT,
  ADD COLUMN IF NOT EXISTS endorsement_email_snapshot TEXT;

COMMENT ON COLUMN public.guest_submissions.endorsement_sent_at IS
  'Parking marketplace flow only (governed by parkingStatusMachine.ts, distinct from the '
  'legacy property parking_endorsement_url upload field). Set once sendParkingEndorsementEmail '
  'succeeds -- guarded update, never overwritten. NULL + a paid status means the guest sees a '
  '"Request Endorsement" retry CTA.';
COMMENT ON COLUMN public.guest_submissions.endorsement_send_error IS
  'Last send failure reason (e.g. no PMO email configured for the matching development). '
  'Cleared implicitly once endorsement_sent_at is set.';
COMMENT ON COLUMN public.guest_submissions.endorsement_email_snapshot IS
  'Exact rendered HTML of the sent endorsement email, so the guest-facing in-app copy view is '
  'literally what was emailed rather than a re-render that can drift from the original.';

ALTER TABLE public.platform_parking_settings
  ADD COLUMN IF NOT EXISTS support_escalation_phone TEXT;

COMMENT ON COLUMN public.platform_parking_settings.support_escalation_phone IS
  'Platform admin/support phone shown to guests on the parking status page regardless of chat '
  'or endorsement state, for when a host is unresponsive on-site (Phase 5 decision #7).';
