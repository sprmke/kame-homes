-- Stage 2 of the guest_submissions RLS lockdown (see docs/workflow/in-progress/
-- production-readiness-hardening.md Phase 4). Stage 1
-- (20261301140000_guest_submissions_scoped_rls_policies.sql) added scoped
-- org/property/parking-membership policies for the `authenticated` role
-- alongside the original wide-open `USING (true)` policies from
-- 20250213044809_add_rls_policies.sql, so nothing changed in production yet
-- (Postgres OR-combines multiple PERMISSIVE policies for the same command).
--
-- This migration removes the legacy permissive policies and the matching
-- overly-broad `GRANT ... TO public` — the scoped policies from Stage 1 are
-- now the only gate for `authenticated`.
--
-- Verified safe via a local rolled-back transaction (see production-readiness
-- plan doc) simulating this exact drop: real org owners and active
-- organization/property/parking members retained SELECT/INSERT/UPDATE/DELETE
-- on their own org's rows; non-members and inactive members were correctly
-- denied on every command. All guest-facing edge functions
-- (submit-form, get-form, submit-sd-form, upload-booking-asset, etc.) write
-- via the Supabase **service role** key, which bypasses RLS entirely and is
-- unaffected by this change either way.
--
-- Known accepted gap (same as the two precedent helpers this pattern is
-- copied from — user_can_access_ai_dashboard_assistant_org,
-- user_can_access_org_support_tickets): the scoped helpers do not special-
-- case the `ADMIN_ALLOWED_EMAILS` platform-admin escape hatch
-- (`isPlatformAdmin` in `_shared/orgAuth.ts`), because that's a Deno edge-
-- function env var with no Postgres-visible equivalent. This only matters for
-- a platform admin who is *not* an org owner/member browsing
-- `/bookings/:bookingId` directly (the page calls `guest_submissions` from
-- the browser via the authenticated Supabase client) — admin *edge
-- functions* are unaffected since they use the service role key. No `ui/src`
-- code path currently references `ADMIN_ALLOWED_EMAILS`, so no known browser
-- flow depends on this today.

DROP POLICY IF EXISTS "Allow public to insert guest submissions" ON public.guest_submissions;
DROP POLICY IF EXISTS "Allow public to read guest submissions" ON public.guest_submissions;
DROP POLICY IF EXISTS "Allow public to update guest submissions" ON public.guest_submissions;
DROP POLICY IF EXISTS "Allow public to delete guest submissions" ON public.guest_submissions;

-- Replace the original `GRANT ALL ... TO public` (which implicitly covered
-- `anon` too) with the same explicit-role grant pattern already used for
-- `organizations` / `properties` (20260629180000_multi_tenancy_foundation.sql):
-- `authenticated` gets row-level CRUD gated by RLS policies, `service_role`
-- keeps unrestricted access for edge functions, `anon` gets nothing (no
-- legitimate anon-key direct-browser access path exists for this table —
-- confirmed in Phase 0 investigation, all guest-facing writes go through
-- edge functions using the service role key).
REVOKE ALL ON public.guest_submissions FROM public;
REVOKE ALL ON public.guest_submissions FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_submissions TO authenticated;
GRANT ALL ON public.guest_submissions TO service_role;
