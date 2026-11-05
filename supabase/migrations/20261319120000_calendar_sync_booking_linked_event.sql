-- Calendar sync Phase 2 — allow the per-event audit trail to record an existing
-- booking that gained feed provenance (manual adoption, or a feed removed and
-- reconnected) instead of inserting a duplicate row.

DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.calendar_sync_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%block_created%'
  LOOP
    EXECUTE format('ALTER TABLE public.calendar_sync_events DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.calendar_sync_events
  ADD CONSTRAINT calendar_sync_events_action_check CHECK (action IN (
    'block_created', 'block_updated', 'block_removed',
    'booking_created', 'booking_cancelled', 'booking_rescheduled', 'booking_linked',
    'conflict_detected', 'skipped', 'error'
  ));
