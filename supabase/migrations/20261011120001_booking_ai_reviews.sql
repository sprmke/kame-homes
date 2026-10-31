-- Admin-triggered booking AI summary & validation job storage.
-- Section-level narrative summaries and flags are stored here; per-document verdicts
-- (guest valid IDs, receipts) remain on guest_submissions.

CREATE TABLE IF NOT EXISTS public.booking_ai_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.guest_submissions (id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties (id) ON DELETE SET NULL,

  job_status TEXT NOT NULL DEFAULT 'pending',
  CONSTRAINT booking_ai_reviews_job_status_check
    CHECK (job_status IN ('pending', 'processing', 'completed', 'failed')),

  stay_details_status TEXT NOT NULL DEFAULT 'pending',
  guests_status TEXT NOT NULL DEFAULT 'pending',
  parking_status TEXT NOT NULL DEFAULT 'pending',
  pets_status TEXT NOT NULL DEFAULT 'pending',
  pricing_status TEXT NOT NULL DEFAULT 'pending',
  CONSTRAINT booking_ai_reviews_section_status_check
    CHECK (stay_details_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  CONSTRAINT booking_ai_reviews_guests_status_check
    CHECK (guests_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  CONSTRAINT booking_ai_reviews_parking_status_check
    CHECK (parking_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  CONSTRAINT booking_ai_reviews_pets_status_check
    CHECK (pets_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  CONSTRAINT booking_ai_reviews_pricing_status_check
    CHECK (pricing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),

  stay_details_result JSONB DEFAULT NULL,
  guests_result JSONB DEFAULT NULL,
  parking_result JSONB DEFAULT NULL,
  pets_result JSONB DEFAULT NULL,
  pricing_result JSONB DEFAULT NULL,

  flag_count INT NOT NULL DEFAULT 0,
  has_blocking_flag BOOLEAN NOT NULL DEFAULT FALSE,

  triggered_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.booking_ai_reviews IS
  'Per-booking AI summary & validation job results, section by section.';
COMMENT ON COLUMN public.booking_ai_reviews.job_status IS
  'Overall job status: pending, processing, completed, failed.';
COMMENT ON COLUMN public.booking_ai_reviews.stay_details_result IS
  'JSONB {summary, flags[], fingerprint, reused, updated_at}.';
COMMENT ON COLUMN public.booking_ai_reviews.guests_result IS
  'JSONB {summary, flags[], fingerprint, reused, updated_at}.';
COMMENT ON COLUMN public.booking_ai_reviews.parking_result IS
  'JSONB {summary, flags[], fingerprint, reused, updated_at}.';
COMMENT ON COLUMN public.booking_ai_reviews.pets_result IS
  'JSONB {summary, flags[], fingerprint, reused, updated_at}.';
COMMENT ON COLUMN public.booking_ai_reviews.pricing_result IS
  'JSONB {summary, flags[], fingerprint, reused, updated_at}.';
COMMENT ON COLUMN public.booking_ai_reviews.flag_count IS
  'Total number of flags across all sections.';
COMMENT ON COLUMN public.booking_ai_reviews.has_blocking_flag IS
  'True when at least one section has a blocking flag.';

CREATE INDEX IF NOT EXISTS idx_booking_ai_reviews_booking_id
  ON public.booking_ai_reviews (booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_ai_reviews_property_id
  ON public.booking_ai_reviews (property_id);

DROP TRIGGER IF EXISTS update_booking_ai_reviews_updated_at ON public.booking_ai_reviews;
CREATE TRIGGER update_booking_ai_reviews_updated_at
  BEFORE UPDATE ON public.booking_ai_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.booking_ai_reviews ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.booking_ai_reviews TO service_role;

-- Extend per-guest valid ID AI verdicts to slots 2–5 (primary guest already has these columns).
ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS guest2_valid_id_ai_verdict TEXT,
  ADD COLUMN IF NOT EXISTS guest2_valid_id_ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS guest3_valid_id_ai_verdict TEXT,
  ADD COLUMN IF NOT EXISTS guest3_valid_id_ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS guest4_valid_id_ai_verdict TEXT,
  ADD COLUMN IF NOT EXISTS guest4_valid_id_ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS guest5_valid_id_ai_verdict TEXT,
  ADD COLUMN IF NOT EXISTS guest5_valid_id_ai_summary TEXT;

COMMENT ON COLUMN public.guest_submissions.guest2_valid_id_ai_verdict IS
  'AI verdict for guest 2 valid ID.';
COMMENT ON COLUMN public.guest_submissions.guest2_valid_id_ai_summary IS
  'AI explanation for guest 2 valid ID.';
COMMENT ON COLUMN public.guest_submissions.guest3_valid_id_ai_verdict IS
  'AI verdict for guest 3 valid ID.';
COMMENT ON COLUMN public.guest_submissions.guest3_valid_id_ai_summary IS
  'AI explanation for guest 3 valid ID.';
COMMENT ON COLUMN public.guest_submissions.guest4_valid_id_ai_verdict IS
  'AI verdict for guest 4 valid ID.';
COMMENT ON COLUMN public.guest_submissions.guest4_valid_id_ai_summary IS
  'AI explanation for guest 4 valid ID.';
COMMENT ON COLUMN public.guest_submissions.guest5_valid_id_ai_verdict IS
  'AI verdict for guest 5 valid ID.';
COMMENT ON COLUMN public.guest_submissions.guest5_valid_id_ai_summary IS
  'AI explanation for guest 5 valid ID.';
