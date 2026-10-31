-- Airbnb / OTA two-way calendar sync — Phase 1.
-- Plan: docs/workflow/done/airbnb-calendar-sync.md §5.3
--
-- Tag property_blocked_dates rows with their origin so:
--   1. imported ranges can be removed when the source reservation disappears from the feed
--   2. imported ranges are NEVER re-exported to the provider they came from (loop prevention)
--   3. partial "unblock" from the Pricing UI never shatters an imported range
--
-- source = 'manual'      -> owner-created via property-pricing (unchanged behavior)
-- source = 'ical_import'  -> written by calendar-sync-cron, keyed by (feed_id, external_uid)

ALTER TABLE public.property_blocked_dates
  ADD COLUMN IF NOT EXISTS source           text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ical_import')),
  ADD COLUMN IF NOT EXISTS feed_id          uuid REFERENCES public.property_calendar_feeds(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS external_uid     text,
  ADD COLUMN IF NOT EXISTS external_summary text,
  ADD COLUMN IF NOT EXISTS last_seen_at     timestamptz;

-- One row per reservation per feed. Partial so manual rows (feed_id IS NULL) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS property_blocked_dates_feed_uid_key
  ON public.property_blocked_dates (feed_id, external_uid)
  WHERE feed_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS property_blocked_dates_feed_idx
  ON public.property_blocked_dates (feed_id)
  WHERE feed_id IS NOT NULL;

COMMENT ON COLUMN public.property_blocked_dates.source IS
  'manual = owner block via property-pricing; ical_import = written by calendar-sync-cron.';

-- ── unblock RPC: add a source filter so partial unblocks only ever touch manual rows ──
-- Existing callers (propertyBlockedDates.ts#deleteBlockedRangesCovering) pass 2 args;
-- the new 3rd param defaults to 'manual' so those calls are unchanged.
DROP FUNCTION IF EXISTS public.unblock_property_blocked_dates(uuid, date[]);

CREATE OR REPLACE FUNCTION public.unblock_property_blocked_dates(
  p_property_id  uuid,
  p_date_keys    date[],
  p_source_filter text DEFAULT 'manual'
) RETURNS integer
LANGUAGE plpgsql
AS $func$
DECLARE
  v_range RECORD;
  v_night date;
  v_last_night date;
  v_segment_start date;
  v_prev date;
  v_affected integer := 0;
  v_ids_to_delete uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_date_keys IS NULL OR array_length(p_date_keys, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_range IN
    SELECT id, start_date, end_date, note, created_by, source
    FROM public.property_blocked_dates
    WHERE property_id = p_property_id
      AND (p_source_filter IS NULL OR source = p_source_filter)
    ORDER BY start_date
    FOR UPDATE
  LOOP
    v_last_night := v_range.end_date - 1;

    IF NOT EXISTS (
      SELECT 1 FROM unnest(p_date_keys) AS dk
      WHERE dk BETWEEN v_range.start_date AND v_last_night
    ) THEN
      CONTINUE;
    END IF;

    v_ids_to_delete := array_append(v_ids_to_delete, v_range.id);
    v_affected := v_affected + 1;

    v_segment_start := NULL;
    v_prev := NULL;
    v_night := v_range.start_date;
    WHILE v_night <= v_last_night LOOP
      IF v_night = ANY(p_date_keys) THEN
        IF v_segment_start IS NOT NULL THEN
          INSERT INTO public.property_blocked_dates
            (property_id, start_date, end_date, note, created_by, source)
          VALUES
            (p_property_id, v_segment_start, v_prev + 1, v_range.note, v_range.created_by, v_range.source);
          v_segment_start := NULL;
          v_prev := NULL;
        END IF;
      ELSE
        IF v_segment_start IS NULL THEN
          v_segment_start := v_night;
        END IF;
        v_prev := v_night;
      END IF;
      v_night := v_night + 1;
    END LOOP;

    IF v_segment_start IS NOT NULL THEN
      INSERT INTO public.property_blocked_dates
        (property_id, start_date, end_date, note, created_by, source)
      VALUES
        (p_property_id, v_segment_start, v_prev + 1, v_range.note, v_range.created_by, v_range.source);
    END IF;
  END LOOP;

  IF array_length(v_ids_to_delete, 1) IS NOT NULL THEN
    DELETE FROM public.property_blocked_dates WHERE id = ANY(v_ids_to_delete);
  END IF;

  RETURN v_affected;
END;
$func$;

REVOKE ALL ON FUNCTION public.unblock_property_blocked_dates(uuid, date[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unblock_property_blocked_dates(uuid, date[], text) TO service_role;
