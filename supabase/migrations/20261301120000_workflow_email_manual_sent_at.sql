-- Manual workflow-email send timestamps (Free-tier resend cooldown).
-- Keys are booking workflow email kinds (gaf_request, pet_request, …).

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS workflow_email_manual_sent_at JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.guest_submissions.workflow_email_manual_sent_at IS
  'Map of booking workflow email kind → last successful manual send (ISO timestamptz string). Used for Free-tier resend cooldown.';
