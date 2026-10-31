-- guest_profiles edge access: guest-profile + upload-guest-profile-asset use createServiceClient()
-- (service_role). The original migration granted authenticated only, which breaks server-side reads/writes.

BEGIN;

GRANT ALL ON TABLE public.guest_profiles TO service_role;

COMMIT;
