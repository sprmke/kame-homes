-- Parking date blocks (Pricing calendar) + email automation toggles on parking_settings.

CREATE TABLE IF NOT EXISTS public.parking_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parking_id uuid NOT NULL REFERENCES public.parkings(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT parking_blocked_dates_range_chk CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS parking_blocked_dates_parking_range_idx
  ON public.parking_blocked_dates (parking_id, start_date, end_date);

ALTER TABLE public.parking_blocked_dates ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.parking_blocked_dates TO service_role;

CREATE OR REPLACE FUNCTION public.unblock_parking_blocked_dates(
  p_parking_id uuid,
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
    FROM public.parking_blocked_dates
    WHERE parking_id = p_parking_id
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
          INSERT INTO public.parking_blocked_dates
            (parking_id, start_date, end_date, note, created_by)
          VALUES
            (p_parking_id, v_segment_start, v_prev + 1, v_range.note, v_range.created_by);
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
      INSERT INTO public.parking_blocked_dates
        (parking_id, start_date, end_date, note, created_by)
      VALUES
        (p_parking_id, v_segment_start, v_prev + 1, v_range.note, v_range.created_by);
    END IF;
  END LOOP;

  IF array_length(v_ids_to_delete, 1) IS NOT NULL THEN
    DELETE FROM public.parking_blocked_dates WHERE id = ANY(v_ids_to_delete);
  END IF;

  RETURN v_affected;
END;
$func$;

REVOKE ALL ON FUNCTION public.unblock_parking_blocked_dates(uuid, date[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unblock_parking_blocked_dates(uuid, date[]) TO service_role;

ALTER TABLE public.parking_settings
  ADD COLUMN IF NOT EXISTS automation_toggles JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.parking_settings.automation_toggles IS
  'Parking-scoped email automation master switches (reservation request, guest confirmed, no-host).';
