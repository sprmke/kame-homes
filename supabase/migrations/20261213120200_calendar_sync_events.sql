-- Airbnb / OTA two-way calendar sync — Phase 1.
-- Plan: docs/workflow/done/airbnb-calendar-sync.md §5.4
--
-- Per-event audit trail for each sync run. One run_id groups one sweep of one feed.
-- Retention: a follow-on cron prunes rows older than 90 days (not scheduled yet).

CREATE TABLE public.calendar_sync_events (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feed_id         uuid NOT NULL REFERENCES public.property_calendar_feeds(id) ON DELETE CASCADE,
  run_id          uuid NOT NULL,
  external_uid    text,
  action          text NOT NULL CHECK (action IN (
                    'block_created', 'block_updated', 'block_removed',
                    'booking_created', 'booking_cancelled', 'booking_rescheduled',
                    'conflict_detected', 'skipped', 'error'
                  )),
  start_date      date,
  end_date        date,
  summary         text,
  blocked_date_id uuid REFERENCES public.property_blocked_dates(id) ON DELETE SET NULL,
  booking_id      uuid REFERENCES public.guest_submissions(id) ON DELETE SET NULL,
  detail          jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX calendar_sync_events_feed_created_idx
  ON public.calendar_sync_events (feed_id, created_at DESC);

CREATE INDEX calendar_sync_events_run_idx
  ON public.calendar_sync_events (run_id);

ALTER TABLE public.calendar_sync_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.calendar_sync_events TO service_role;
