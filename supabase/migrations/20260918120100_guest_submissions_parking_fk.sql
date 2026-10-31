-- Catch-up FK for guest_submissions.parking_id after parkings table exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guest_submissions_parking_id_fkey'
  ) THEN
    ALTER TABLE public.guest_submissions
      ADD CONSTRAINT guest_submissions_parking_id_fkey
      FOREIGN KEY (parking_id) REFERENCES public.parkings (id) ON DELETE RESTRICT;
  END IF;
END $$;
