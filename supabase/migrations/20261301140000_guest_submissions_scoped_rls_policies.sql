-- Stage 1 of the guest_submissions RLS lockdown (see
-- docs/workflow/in-progress/production-readiness-hardening.md Phase 4).
--
-- guest_submissions currently only has fully-open policies from
-- 20250213044809_add_rls_policies.sql (USING (true) / WITH CHECK (true) for
-- role `public` on SELECT/INSERT/UPDATE/DELETE). Postgres combines multiple
-- PERMISSIVE policies for the same command with OR, so adding new, narrower
-- policies here does NOT change behavior yet — the old `true` policies still
-- pass every row. This migration is intentionally a no-op for real traffic;
-- it exists so the scoped-access logic can be reviewed and verified against
-- production data before a follow-up migration drops the legacy open
-- policies (tracked, not yet written — see plan doc).
--
-- Mirrors the same org/property-membership check the edge functions already
-- enforce server-side (verifyPropertyAccess / verifyParkingTeamAccess in
-- _shared/orgAuth.ts) and the same SECURITY DEFINER pattern already shipped
-- for other tables (user_can_access_ai_dashboard_assistant_org in
-- 20261018120000_ai_dashboard_assistant.sql, user_can_access_org_support_tickets
-- in 20261022120000_support_tickets.sql): org owner, OR active
-- organization_members row, OR active property_members / parking_members row.
--
-- Known gap (matches existing precedent, not introduced here): this does not
-- special-case the ADMIN_ALLOWED_EMAILS platform-admin allow-list, because
-- that list is a Deno edge-function env var with no equivalent in Postgres
-- today, and the two other SECURITY DEFINER helpers above have the same gap.
-- Edge functions still enforce platform-admin access themselves via the
-- service-role client, which bypasses RLS entirely — this only affects the
-- admin dashboard's direct browser Supabase calls. Before the follow-up
-- migration drops the legacy open policies, manually confirm every email in
-- ADMIN_ALLOWED_EMAILS also owns or actively belongs to every org/property
-- it needs to browse directly (or extend these helpers first).
--
-- guest_submissions.property_id / parking_id are mutually exclusive
-- (guest_submissions_property_or_parking_check), so the combined helper
-- checks whichever one is set.

CREATE OR REPLACE FUNCTION public.user_can_access_guest_submission_property(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = p_property_id AND o.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.properties p
    JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = p_property_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.property_members pm
    WHERE pm.property_id = p_property_id
      AND pm.user_id = auth.uid()
      AND pm.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_guest_submission_parking(p_parking_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parkings pk
    JOIN public.organizations o ON o.id = pk.organization_id
    WHERE pk.id = p_parking_id AND o.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.parkings pk
    JOIN public.organization_members om ON om.organization_id = pk.organization_id
    WHERE pk.id = p_parking_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.parking_members pkm
    WHERE pkm.parking_id = p_parking_id
      AND pkm.user_id = auth.uid()
      AND pkm.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_guest_submission(
  p_property_id UUID,
  p_parking_id UUID
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
    (p_parking_id IS NOT NULL AND public.user_can_access_guest_submission_parking(p_parking_id));
$$;

-- Additive, scoped policies for the `authenticated` role only (the admin
-- dashboard). Guest-facing anon writes keep going through edge functions
-- using the service-role client, which bypasses RLS — these policies don't
-- touch the `public`-role policies guests/anon currently rely on.
CREATE POLICY "Scoped org/property members can select guest submissions"
ON public.guest_submissions FOR SELECT TO authenticated
USING (public.user_can_access_guest_submission(property_id, parking_id));

CREATE POLICY "Scoped org/property members can insert guest submissions"
ON public.guest_submissions FOR INSERT TO authenticated
WITH CHECK (public.user_can_access_guest_submission(property_id, parking_id));

CREATE POLICY "Scoped org/property members can update guest submissions"
ON public.guest_submissions FOR UPDATE TO authenticated
USING (public.user_can_access_guest_submission(property_id, parking_id))
WITH CHECK (public.user_can_access_guest_submission(property_id, parking_id));

CREATE POLICY "Scoped org/property members can delete guest submissions"
ON public.guest_submissions FOR DELETE TO authenticated
USING (public.user_can_access_guest_submission(property_id, parking_id));
