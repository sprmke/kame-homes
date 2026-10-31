-- In-app guest reviews (SD refund flow + future Airbnb path).

BEGIN;

CREATE TABLE IF NOT EXISTS public.guest_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.guest_submissions (id) ON DELETE CASCADE,
  star_rating SMALLINT NOT NULL CHECK (star_rating >= 1 AND star_rating <= 5),
  review_text TEXT,
  media_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  guest_display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT guest_reviews_booking_unique UNIQUE (booking_id),
  CONSTRAINT guest_reviews_media_array CHECK (jsonb_typeof(media_urls) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_guest_reviews_property_created
  ON public.guest_reviews (property_id, created_at DESC);

COMMENT ON TABLE public.guest_reviews IS
  'Immutable guest-submitted reviews. One per booking. Media: up to 3 images or 2 images + 1 video.';

ALTER TABLE public.guest_reviews ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.guest_reviews TO service_role;

COMMIT;
