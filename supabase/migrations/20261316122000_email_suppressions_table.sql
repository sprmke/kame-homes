-- Doc 25 Phase 25.4/25.5 — email_suppressions: Resend bounce/complaint suppression list.
-- approval-email-webhook previously received Resend email.bounced/email.complained events,
-- signature-verified them, then silently discarded them (only email.received was handled).
-- A spike of sends to invalid addresses harms domain reputation for every subsequent send,
-- including booking confirmations. This table lets every send path check-before-send.

CREATE TABLE IF NOT EXISTS email_suppressions (
  email        TEXT PRIMARY KEY,
  reason       TEXT NOT NULL CHECK (reason IN ('bounced', 'complained')),
  event_type   TEXT NOT NULL,
  message_id   TEXT,
  detail       TEXT,
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  email_suppressions              IS 'Resend bounce/complaint suppression list. Checked by every guest-facing send path before calling the Resend API. Edge-only, no direct browser access.';
COMMENT ON COLUMN email_suppressions.email        IS 'Lowercased recipient address (primary key — one row per address, most recent event wins via upsert).';
COMMENT ON COLUMN email_suppressions.reason        IS 'bounced = hard/soft bounce; complained = spam complaint. Both stop future sends.';
COMMENT ON COLUMN email_suppressions.event_type    IS 'Raw Resend event type (email.bounced, email.complained) for debugging.';
COMMENT ON COLUMN email_suppressions.message_id    IS 'Resend message id from the triggering event, for cross-referencing the Resend dashboard.';
COMMENT ON COLUMN email_suppressions.detail        IS 'Bounce/complaint subtype or reason text from the webhook payload, if present.';
COMMENT ON COLUMN email_suppressions.suppressed_at IS 'When this address was last (re-)suppressed. Upserted on repeat events.';

CREATE INDEX IF NOT EXISTS idx_email_suppressions_suppressed_at ON email_suppressions(suppressed_at DESC);

-- Same posture as processed_emails / query_cache (20261316121900): RLS enabled, no
-- permissive policy. Every read/write goes through an edge function on the service-role
-- client, which bypasses RLS — this is defense-in-depth per doc 22, not the primary control.
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.email_suppressions FROM anon, authenticated;

COMMENT ON TABLE public.email_suppressions IS
  'RLS enabled with no policy (doc 22 Phase 22.1) — edge-function/service-role access only, no direct browser reads.';
