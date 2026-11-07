-- Live identity verification.
-- Plan: docs/workflow/in-progress/live-identity-verification.md
-- Architecture: docs/architecture/identity-verification.md
--
-- Two tables and one private bucket. Every read/write goes through an edge
-- function under the service role, matching booking_ai_reviews: RLS is on with
-- no client policy, so a leaked anon key cannot read a verdict or a capture.
--
-- Privacy notes that matter to a reviewer:
--   * `subject_email_hash` is sha256(lower(trim(email)) || pepper). The raw
--     address never lands here; the booking row keeps it where it already lives.
--   * `document_number_hash` is sha256(normalize(number) || pepper). It exists
--     only so a duplicate can be detected without storing a PhilSys PCN.
--   * Capture images live in a private bucket with a 7-day default retention and
--     a purge cron. `valid-ids` keeps its current behaviour untouched.

CREATE TABLE IF NOT EXISTS public.identity_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  subject_kind text NOT NULL CHECK (subject_kind IN ('guest', 'org_owner')),
  guest_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.guest_submissions (id) ON DELETE SET NULL,
  guest_slot smallint CHECK (guest_slot IS NULL OR guest_slot BETWEEN 1 AND 5),
  subject_email_hash text,

  verdict text NOT NULL CHECK (
    verdict IN ('verified', 'partially_verified', 'unverified', 'rejected', 'expired')
  ),
  method text NOT NULL CHECK (method IN ('philsys_qr', 'mrz', 'document_ai', 'provider')),
  provider text,
  provider_ref text,

  document_type text,
  document_number_hash text,
  document_expiry date,
  full_name text,
  date_of_birth date,
  sex text,
  nationality text,

  signature_valid boolean NOT NULL DEFAULT false,
  liveness_passed boolean,
  liveness_grade text CHECK (liveness_grade IN ('clientside', 'certified')),
  face_match_verdict text CHECK (
    face_match_verdict IN ('match', 'likely_match', 'unclear', 'mismatch', 'skipped')
  ),
  face_match_source text,
  quality_score numeric(3, 2) CHECK (
    quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1)
  ),
  flags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(flags) = 'array'),

  document_front_path text,
  selfie_path text,

  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,

  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT identity_verifications_subject_shape CHECK (
    CASE subject_kind
      -- A guest verdict may exist before the booking row does (the capture happens inside
      -- the booking form), so the email hash is the only mandatory linkage. `booking_id`
      -- and `guest_user_id` are attached as soon as they are known.
      WHEN 'guest' THEN
        organization_id IS NULL
        AND subject_email_hash IS NOT NULL
      WHEN 'org_owner' THEN
        organization_id IS NOT NULL
        AND guest_user_id IS NULL
        AND booking_id IS NULL
      ELSE FALSE
    END
  )
);

COMMENT ON TABLE public.identity_verifications IS
  'Identity verdicts from the live capture flow. Service-role only; no client RLS policy.';
COMMENT ON COLUMN public.identity_verifications.subject_email_hash IS
  'sha256(lower(trim(email)) || pepper). Raw email is never stored here.';
COMMENT ON COLUMN public.identity_verifications.document_number_hash IS
  'sha256(normalized document number || pepper). Enables duplicate detection without storing the number.';
COMMENT ON COLUMN public.identity_verifications.liveness_grade IS
  'clientside = on-device challenge only. certified = PAD-certified provider. Never overclaim in UI.';

-- One live verdict per signed-in guest account.
CREATE UNIQUE INDEX IF NOT EXISTS identity_verifications_guest_active
  ON public.identity_verifications (guest_user_id)
  WHERE guest_user_id IS NOT NULL
    AND verdict IN ('verified', 'partially_verified');

-- One live verdict per organization.
CREATE UNIQUE INDEX IF NOT EXISTS identity_verifications_org_active
  ON public.identity_verifications (organization_id)
  WHERE organization_id IS NOT NULL
    AND verdict IN ('verified', 'partially_verified');

-- One live verdict per booking slot. A retry supersedes the old row by flipping it
-- to 'expired' first, so this never blocks a legitimate second attempt.
CREATE UNIQUE INDEX IF NOT EXISTS identity_verifications_booking_slot_active
  ON public.identity_verifications (booking_id, coalesce(guest_slot, 1))
  WHERE booking_id IS NOT NULL
    AND verdict IN ('verified', 'partially_verified');

CREATE INDEX IF NOT EXISTS identity_verifications_email_lookup
  ON public.identity_verifications (subject_email_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS identity_verifications_document_hash
  ON public.identity_verifications (document_number_hash)
  WHERE document_number_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS identity_verifications_expiry
  ON public.identity_verifications (expires_at)
  WHERE verdict IN ('verified', 'partially_verified');

CREATE TABLE IF NOT EXISTS public.identity_verification_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,

  subject_kind text NOT NULL CHECK (subject_kind IN ('guest', 'org_owner')),
  guest_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.guest_submissions (id) ON DELETE SET NULL,
  guest_slot smallint CHECK (guest_slot IS NULL OR guest_slot BETWEEN 1 AND 5),
  subject_email_hash text,
  property_id uuid REFERENCES public.properties (id) ON DELETE SET NULL,

  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'in_progress',
      'captured',
      'submitted',
      'completed',
      'failed',
      'expired'
    )
  ),
  step text,
  origin_device text CHECK (origin_device IN ('desktop', 'mobile')),
  failure_reason text,
  attempt_count smallint NOT NULL DEFAULT 0,
  claimed_at timestamptz,
  result_id uuid REFERENCES public.identity_verifications (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.identity_verification_sessions IS
  'Ephemeral handoff sessions. token_hash only; the raw token is never persisted or logged.';

CREATE INDEX IF NOT EXISTS identity_verification_sessions_expiry
  ON public.identity_verification_sessions (expires_at);

CREATE INDEX IF NOT EXISTS identity_verification_sessions_booking
  ON public.identity_verification_sessions (booking_id, created_at DESC)
  WHERE booking_id IS NOT NULL;

DROP TRIGGER IF EXISTS identity_verifications_touch_updated_at
  ON public.identity_verifications;
CREATE TRIGGER identity_verifications_touch_updated_at
  BEFORE UPDATE ON public.identity_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS identity_verification_sessions_touch_updated_at
  ON public.identity_verification_sessions;
CREATE TRIGGER identity_verification_sessions_touch_updated_at
  BEFORE UPDATE ON public.identity_verification_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verification_sessions ENABLE ROW LEVEL SECURITY;

-- No client policy on purpose. The edge functions are the access-control layer.
REVOKE ALL ON public.identity_verifications FROM anon, authenticated;
REVOKE ALL ON public.identity_verification_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.identity_verifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.identity_verification_sessions TO service_role;

-- Booking slot -> verdict reference. Additive: the legacy `valid_id_url` columns stay
-- the source of truth for GAF attachments and admin previews.
ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS primary_identity_verification_id uuid
    REFERENCES public.identity_verifications (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest2_identity_verification_id uuid
    REFERENCES public.identity_verifications (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest3_identity_verification_id uuid
    REFERENCES public.identity_verifications (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest4_identity_verification_id uuid
    REFERENCES public.identity_verifications (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest5_identity_verification_id uuid
    REFERENCES public.identity_verifications (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS identity_capture_mode text
    CHECK (identity_capture_mode IS NULL OR identity_capture_mode IN ('live', 'upload', 'legacy'));

COMMENT ON COLUMN public.guest_submissions.primary_identity_verification_id IS
  'Live identity verdict for the primary guest. Null for legacy uploaded IDs.';

-- Denormalized badge read for the guest portal profile list.
ALTER TABLE public.guest_profiles
  ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz;

-- Private capture bucket. Service-role only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identity-captures',
  'identity-captures',
  FALSE,
  12582912,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Service role full access to identity-captures" ON storage.objects;
CREATE POLICY "Service role full access to identity-captures"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'identity-captures')
  WITH CHECK (bucket_id = 'identity-captures');
