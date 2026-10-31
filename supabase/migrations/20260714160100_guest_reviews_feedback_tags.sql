-- Guest review feedback tags (Airbnb-style pills on SD refund review step).

BEGIN;

ALTER TABLE public.guest_reviews
  ADD COLUMN IF NOT EXISTS feedback_tags TEXT[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.guest_reviews.feedback_tags IS
  'Guest-selected feedback pill ids (positive when star_rating >= 4, constructive otherwise).';

COMMIT;
