-- Fixes a real gap found in 20261301140000_guest_submissions_scoped_rls_policies.sql
-- before it ever reached production, surfaced by a deeper auth-model investigation
-- (docs/workflow/in-progress/production-readiness-hardening.md Phase 4).
--
-- guest_submissions has THREE mutually-exclusive row shapes, enforced by
-- guest_submissions_property_or_parking_check
-- (20261017130000_parking_broadcast_terminal_check_fix.sql), not two:
--   1. property_id set, parking_id + parking_request_organization_id null
--      (a normal property stay)
--   2. parking_id set, property_id null (a claimed parking booking)
--   3. property_id + parking_id BOTH null, parking_request_organization_id
--      set, status IN ('PENDING_HOST_ACCEPTANCE','NO_HOST_AVAILABLE','CANCELLED')
--      (a parking marketplace broadcast request before any host claims it —
--      see submit-parking-booking-request/index.ts, which sets
--      parking_request_organization_id to the single org the request was
--      broadcast to).
--
-- user_can_access_guest_submission(property_id, parking_id) only covered
-- shapes 1 and 2. Once the legacy USING(true) policies are dropped
-- (20261301160000_...), shape-3 rows would have become invisible to EVERY
-- admin session, including the org/parking teams the broadcast was actually
-- sent to — ui/src/features/dashboard/bookings/hooks/useBooking.ts's
-- unclaimed-broadcast fallback query (`.eq('id', bookingId).is('parking_id',
-- null)`) has no other server-side scoping today, so this would have broken
-- the parking-broadcast admin UI (Accept/Decline screen) for every org.
--
-- Fix: extend the combined helper with a third, optional parameter for
-- parking_request_organization_id, and grant access to the org owner or any
-- active organization_members / parking_members (any parking under that
-- org — broadcasts fan out to every eligible parking in the target org, so
-- any of that org's parking teams may need to view/act on the request).

CREATE OR REPLACE FUNCTION public.user_can_access_guest_submission_broadcast_org(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org_id AND o.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.parking_members pkm
    JOIN public.parkings pk ON pk.id = pkm.parking_id
    WHERE pk.organization_id = p_org_id
      AND pkm.user_id = auth.uid()
      AND pkm.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_guest_submission(
  p_property_id UUID,
  p_parking_id UUID,
  p_broadcast_org_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (p_property_id IS NOT NULL AND public.user_can_access_guest_submission_property(p_property_id))
    OR
    (p_parking_id IS NOT NULL AND public.user_can_access_guest_submission_parking(p_parking_id))
    OR
    (p_broadcast_org_id IS NOT NULL AND public.user_can_access_guest_submission_broadcast_org(p_broadcast_org_id));
$$;

-- Postgres can't alter a policy's USING/WITH CHECK expression in place —
-- drop and recreate the 4 Stage-1 policies so they pass the new third arg.
-- (CREATE OR REPLACE FUNCTION above already made every existing policy call
-- resolve to this same 3-arg function via the DEFAULT NULL, so this step is
-- only needed to actually pass parking_request_organization_id through.)
DROP POLICY IF EXISTS "Scoped org/property members can select guest submissions" ON public.guest_submissions;
DROP POLICY IF EXISTS "Scoped org/property members can insert guest submissions" ON public.guest_submissions;
DROP POLICY IF EXISTS "Scoped org/property members can update guest submissions" ON public.guest_submissions;
DROP POLICY IF EXISTS "Scoped org/property members can delete guest submissions" ON public.guest_submissions;

CREATE POLICY "Scoped org/property members can select guest submissions"
ON public.guest_submissions FOR SELECT TO authenticated
USING (public.user_can_access_guest_submission(property_id, parking_id, parking_request_organization_id));

CREATE POLICY "Scoped org/property members can insert guest submissions"
ON public.guest_submissions FOR INSERT TO authenticated
WITH CHECK (public.user_can_access_guest_submission(property_id, parking_id, parking_request_organization_id));

CREATE POLICY "Scoped org/property members can update guest submissions"
ON public.guest_submissions FOR UPDATE TO authenticated
USING (public.user_can_access_guest_submission(property_id, parking_id, parking_request_organization_id))
WITH CHECK (public.user_can_access_guest_submission(property_id, parking_id, parking_request_organization_id));

CREATE POLICY "Scoped org/property members can delete guest submissions"
ON public.guest_submissions FOR DELETE TO authenticated
USING (public.user_can_access_guest_submission(property_id, parking_id, parking_request_organization_id));
