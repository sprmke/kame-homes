-- Host identity verification before the organization exists.
--
-- A host registers (Google sign-in) and only then creates an organization. Requiring an
-- `organization_id` for an `org_owner` verdict meant the whole registration step had to fall
-- back to a plain gallery upload. This migration keys the verdict to the auth user instead and
-- lets `create-organization` attach it to the organization the moment that row exists.
--
-- No backfill: the tables are new in 20261320120000 and carry no rows yet.

ALTER TABLE public.identity_verifications
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.identity_verification_sessions
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;

COMMENT ON COLUMN public.identity_verifications.owner_user_id IS
  'The host whose identity this is. Set at registration, before an organization exists; '
  'organization_id is attached by create-organization.';

ALTER TABLE public.identity_verifications
  DROP CONSTRAINT IF EXISTS identity_verifications_subject_shape;

ALTER TABLE public.identity_verifications
  ADD CONSTRAINT identity_verifications_subject_shape CHECK (
    CASE subject_kind
      -- A guest verdict may exist before the booking row does (the capture happens inside
      -- the booking form), so the email hash is the only mandatory linkage.
      WHEN 'guest' THEN
        organization_id IS NULL
        AND owner_user_id IS NULL
        AND subject_email_hash IS NOT NULL
      -- An org verdict may exist before the organization does. It must always name the host.
      WHEN 'org_owner' THEN
        owner_user_id IS NOT NULL
        AND guest_user_id IS NULL
        AND booking_id IS NULL
      ELSE FALSE
    END
  );

-- One live verdict per host account, regardless of whether the organization is attached yet.
CREATE UNIQUE INDEX IF NOT EXISTS identity_verifications_owner_active
  ON public.identity_verifications (owner_user_id)
  WHERE owner_user_id IS NOT NULL
    AND verdict IN ('verified', 'partially_verified');

CREATE INDEX IF NOT EXISTS identity_verifications_owner_pending
  ON public.identity_verifications (owner_user_id, created_at DESC)
  WHERE owner_user_id IS NOT NULL
    AND organization_id IS NULL;
