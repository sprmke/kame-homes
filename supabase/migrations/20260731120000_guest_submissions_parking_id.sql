-- Standalone parking-slot reservations on guest_submissions (mutually exclusive with property_id).
-- Fresh-reset: public.parkings is created in 20260918120000 — add FK in 20260918120100.

ALTER TABLE public.guest_submissions
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS parking_id UUID;

DO $$
BEGIN
  IF to_regclass('public.parkings') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'guest_submissions_parking_id_fkey'
     ) THEN
    ALTER TABLE public.guest_submissions
      ADD CONSTRAINT guest_submissions_parking_id_fkey
      FOREIGN KEY (parking_id) REFERENCES public.parkings (id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE public.guest_submissions
  DROP CONSTRAINT IF EXISTS guest_submissions_property_or_parking_check;

ALTER TABLE public.guest_submissions
  ADD CONSTRAINT guest_submissions_property_or_parking_check
  CHECK (
    ((property_id IS NOT NULL)::int + (parking_id IS NOT NULL)::int) = 1
  );

CREATE INDEX IF NOT EXISTS idx_guest_submissions_parking_id
  ON public.guest_submissions (parking_id)
  WHERE parking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guest_submissions_parking_status
  ON public.guest_submissions (parking_id, status)
  WHERE parking_id IS NOT NULL;

COMMENT ON COLUMN public.guest_submissions.parking_id IS
  'Standalone parking-slot reservation; mutually exclusive with property_id.';
