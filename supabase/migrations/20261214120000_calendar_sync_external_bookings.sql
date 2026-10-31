-- Airbnb / OTA two-way calendar sync — Phase 2 (reservation ingestion).
-- Plan: docs/workflow/done/airbnb-calendar-sync.md §5.5 / §6.3
--
-- Provenance columns on guest_submissions for rows created by calendar-sync-cron when a
-- feed opts in (property_calendar_feeds.create_bookings = true) and the VEVENT classifies
-- as a reservation (not a bare owner-block).
--
--   booking_source  -> stays the display/behavior switch ('Airbnb') — reuse existing branches
--   external_source -> sync provider identity ('airbnb' | 'booking_com' | 'vrbo' | 'other')
--   external_uid    -> the reservation UID from the .ics, stable across date edits
--   external_feed_id-> which feed produced the row (SET NULL on feed delete — keep history)
--   external_raw    -> the raw parsed VEVENT (reservation URL, phone last-4) for the admin
--
-- Rows are created in PENDING_REVIEW and NEVER auto-advanced by the sync engine.
-- All guest-facing side effects are suppressed while guest_email is blank / external_source
-- is set (guard in _shared/workflowOrchestrator.ts).

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS external_source  text
    CHECK (external_source IN ('airbnb', 'booking_com', 'vrbo', 'other')),
  ADD COLUMN IF NOT EXISTS external_uid     text,
  ADD COLUMN IF NOT EXISTS external_feed_id uuid REFERENCES public.property_calendar_feeds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_raw     jsonb;

-- One booking row per reservation per feed. Partial so ordinary submissions are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS guest_submissions_external_feed_uid_key
  ON public.guest_submissions (external_feed_id, external_uid)
  WHERE external_feed_id IS NOT NULL;

-- Look-ups by feed during the reconcile pass (load current external rows for a feed).
CREATE INDEX IF NOT EXISTS guest_submissions_external_feed_idx
  ON public.guest_submissions (external_feed_id)
  WHERE external_feed_id IS NOT NULL;

COMMENT ON COLUMN public.guest_submissions.external_source IS
  'Non-null => row was ingested from an OTA calendar feed; suppresses all guest-facing side effects.';
COMMENT ON COLUMN public.guest_submissions.external_uid IS
  'Reservation UID from the provider .ics feed; sync identity, stable across date edits.';
