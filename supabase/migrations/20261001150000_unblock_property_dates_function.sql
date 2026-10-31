-- Transactional unblock/split for property_blocked_dates.
--
-- deleteBlockedRangesCovering() previously deleted intersecting ranges and
-- then inserted the still-blocked remnant sub-ranges as two separate
-- round-trips from the edge function. If the insert failed after the delete
-- succeeded, the remaining blocked nights were silently lost.
--
-- This function performs the same split algorithm inside a single Postgres
-- function call (one transaction from the caller's perspective), locking the
-- property's rows first so concurrent unblock calls cannot race.

CREATE OR REPLACE FUNCTION public.unblock_property_blocked_dates(
  p_property_id uuid,
  p_date_keys date[]
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
    SELECT id, start_date, end_date, note, created_by
    FROM public.property_blocked_dates
    WHERE property_id = p_property_id
    ORDER BY start_date
    FOR UPDATE
  LOOP
    v_last_night := v_range.end_date - 1;

    -- Skip ranges that don't intersect any requested night at all.
    IF NOT EXISTS (
      SELECT 1 FROM unnest(p_date_keys) AS dk
      WHERE dk BETWEEN v_range.start_date AND v_last_night
    ) THEN
      CONTINUE;
    END IF;

    v_ids_to_delete := array_append(v_ids_to_delete, v_range.id);
    v_affected := v_affected + 1;

    -- Re-split remaining (still-blocked) nights into contiguous sub-ranges.
    v_segment_start := NULL;
    v_prev := NULL;
    v_night := v_range.start_date;
    WHILE v_night <= v_last_night LOOP
      IF v_night = ANY(p_date_keys) THEN
        IF v_segment_start IS NOT NULL THEN
          INSERT INTO public.property_blocked_dates
            (property_id, start_date, end_date, note, created_by)
          VALUES
            (p_property_id, v_segment_start, v_prev + 1, v_range.note, v_range.created_by);
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
        (property_id, start_date, end_date, note, created_by)
      VALUES
        (p_property_id, v_segment_start, v_prev + 1, v_range.note, v_range.created_by);
    END IF;
  END LOOP;

  IF array_length(v_ids_to_delete, 1) IS NOT NULL THEN
    DELETE FROM public.property_blocked_dates WHERE id = ANY(v_ids_to_delete);
  END IF;

  RETURN v_affected;
END;
$func$;

REVOKE ALL ON FUNCTION public.unblock_property_blocked_dates(uuid, date[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unblock_property_blocked_dates(uuid, date[]) TO service_role;
