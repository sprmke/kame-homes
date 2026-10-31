-- Two-way reviews (guest <-> host). Plan: docs/workflow/in-progress/two-way-reviews.md
--
-- 1. Extend guest_reviews: org scope, categories, status/publish lifecycle, host response.
-- 2. New host_guest_reviews: host -> guest, mirrors the same lifecycle.
-- 3. New booking_review_windows: one row per eligible booking, anchors the 14-day double-blind window.
-- 4. New review_reports: report-to-super-admin moderation queue.
--
-- All four tables: RLS on, service-role only (edge functions are the access layer).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. guest_reviews — extend
-- ---------------------------------------------------------------------------

ALTER TABLE public.guest_reviews
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS guest_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_ratings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS private_note TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_text TEXT,
  ADD COLUMN IF NOT EXISTS response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_reason TEXT;

ALTER TABLE public.guest_reviews
  DROP CONSTRAINT IF EXISTS guest_reviews_category_ratings_object;
ALTER TABLE public.guest_reviews
  ADD CONSTRAINT guest_reviews_category_ratings_object
  CHECK (jsonb_typeof(category_ratings) = 'object');

ALTER TABLE public.guest_reviews
  DROP CONSTRAINT IF EXISTS guest_reviews_source_check;
ALTER TABLE public.guest_reviews
  ADD CONSTRAINT guest_reviews_source_check
  CHECK (source IN ('legacy', 'sd_form', 'guest_review', 'trip', 'account', 'email_link'));

ALTER TABLE public.guest_reviews
  DROP CONSTRAINT IF EXISTS guest_reviews_status_check;
ALTER TABLE public.guest_reviews
  ADD CONSTRAINT guest_reviews_status_check
  CHECK (status IN ('submitted', 'published', 'removed'));

ALTER TABLE public.guest_reviews
  DROP CONSTRAINT IF EXISTS guest_reviews_private_note_len;
ALTER TABLE public.guest_reviews
  ADD CONSTRAINT guest_reviews_private_note_len CHECK (
    private_note IS NULL OR char_length(private_note) <= 1000
  );

-- Backfill: every pre-existing row is a legacy, already-visible review.
UPDATE public.guest_reviews g
SET organization_id = p.organization_id
FROM public.properties p
WHERE g.property_id = p.id AND g.organization_id IS NULL;

UPDATE public.guest_reviews
SET
  source = 'legacy',
  status = 'published',
  submitted_at = COALESCE(submitted_at, created_at),
  published_at = COALESCE(published_at, created_at)
WHERE submitted_at IS NULL;

ALTER TABLE public.guest_reviews ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guest_reviews_property_published
  ON public.guest_reviews (property_id, published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_guest_reviews_org_published
  ON public.guest_reviews (organization_id, published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_guest_reviews_guest_user
  ON public.guest_reviews (guest_user_id) WHERE guest_user_id IS NOT NULL;

COMMENT ON TABLE public.guest_reviews IS
  'Guest-submitted reviews of a stay. One per booking. Editable until published (double-blind with host_guest_reviews, see booking_review_windows); immutable after.';
COMMENT ON COLUMN public.guest_reviews.category_ratings IS
  'Keys: cleanliness, accuracy, check_in, communication, location, value — each 1-5.';

-- ---------------------------------------------------------------------------
-- 2. host_guest_reviews — new
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.host_guest_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.guest_submissions (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  guest_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  guest_identity_key TEXT NOT NULL,
  overall_rating SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  cleanliness_rating SMALLINT NOT NULL CHECK (cleanliness_rating BETWEEN 1 AND 5),
  communication_rating SMALLINT NOT NULL CHECK (communication_rating BETWEEN 1 AND 5),
  house_rules_rating SMALLINT NOT NULL CHECK (house_rules_rating BETWEEN 1 AND 5),
  would_host_again BOOLEAN NOT NULL,
  strength_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  issue_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  review_text TEXT,
  private_note TEXT,
  internal_note TEXT,
  author_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'published', 'removed')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  response_text TEXT,
  response_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  removed_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  removed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT host_guest_reviews_booking_unique UNIQUE (booking_id),
  CONSTRAINT host_guest_reviews_review_text_len CHECK (
    review_text IS NULL OR char_length(review_text) <= 2000
  ),
  CONSTRAINT host_guest_reviews_private_note_len CHECK (
    private_note IS NULL OR char_length(private_note) <= 1000
  ),
  CONSTRAINT host_guest_reviews_internal_note_len CHECK (
    internal_note IS NULL OR char_length(internal_note) <= 1000
  ),
  CONSTRAINT host_guest_reviews_response_text_len CHECK (
    response_text IS NULL OR char_length(response_text) <= 1000
  )
);

CREATE INDEX IF NOT EXISTS idx_host_guest_reviews_identity_published
  ON public.host_guest_reviews (guest_identity_key, published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_host_guest_reviews_guest_user_published
  ON public.host_guest_reviews (guest_user_id, published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_host_guest_reviews_property_submitted
  ON public.host_guest_reviews (property_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_host_guest_reviews_org_submitted
  ON public.host_guest_reviews (organization_id, submitted_at DESC);

COMMENT ON TABLE public.host_guest_reviews IS
  'Host-submitted review of a guest after a stay. One per booking. Double-blind with guest_reviews until both publish or the window closes (booking_review_windows).';
COMMENT ON COLUMN public.host_guest_reviews.guest_identity_key IS
  'sha256(lower(trim(guest_email)) + REVIEW_IDENTITY_PEPPER), or booking:<id> placeholder when no email exists. Used for cross-org guest reputation lookups.';
COMMENT ON COLUMN public.host_guest_reviews.internal_note IS
  'Visible only to the authoring organization''s team — never returned to other orgs or the guest.';

ALTER TABLE public.host_guest_reviews ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.host_guest_reviews TO service_role;

DROP TRIGGER IF EXISTS update_host_guest_reviews_updated_at ON public.host_guest_reviews;
CREATE TRIGGER update_host_guest_reviews_updated_at
  BEFORE UPDATE ON public.host_guest_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. booking_review_windows — new
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.booking_review_windows (
  booking_id UUID PRIMARY KEY REFERENCES public.guest_submissions (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  guest_request_sent_at TIMESTAMPTZ,
  guest_reminder_sent_at TIMESTAMPTZ,
  host_reminder_notified_at TIMESTAMPTZ,
  closed_reason TEXT CHECK (closed_reason IN ('published', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_review_windows_open_closes
  ON public.booking_review_windows (closes_at) WHERE published_at IS NULL;

COMMENT ON TABLE public.booking_review_windows IS
  'One row per booking eligible for two-way reviews — anchors the 14-day double-blind window (opens_at/closes_at) and tracks idempotent email/notification sends.';

ALTER TABLE public.booking_review_windows ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.booking_review_windows TO service_role;

DROP TRIGGER IF EXISTS update_booking_review_windows_updated_at ON public.booking_review_windows;
CREATE TRIGGER update_booking_review_windows_updated_at
  BEFORE UPDATE ON public.booking_review_windows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 4. review_reports — new
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_kind TEXT NOT NULL CHECK (review_kind IN ('guest_review', 'host_guest_review')),
  review_id UUID NOT NULL,
  reporter_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  reporter_side TEXT NOT NULL CHECK (reporter_side IN ('host', 'guest')),
  reason TEXT NOT NULL CHECK (reason IN (
    'not_a_real_stay',
    'incentive_or_extortion',
    'retaliation',
    'discriminatory',
    'harassment_or_threat',
    'private_information',
    'irrelevant',
    'other'
  )),
  details TEXT NOT NULL CHECK (char_length(details) >= 30 AND char_length(details) <= 2000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'upheld', 'rejected')),
  decided_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_reports_status_created
  ON public.review_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_reports_review
  ON public.review_reports (review_kind, review_id);

COMMENT ON TABLE public.review_reports IS
  'Report-to-super-admin moderation queue for individual guest_reviews / host_guest_reviews rows. Max 2 open reports per (review, reporter_side) enforced in the edge function.';

ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.review_reports TO service_role;

COMMIT;
