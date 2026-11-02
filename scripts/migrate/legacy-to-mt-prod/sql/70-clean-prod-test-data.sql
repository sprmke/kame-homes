-- 70-clean-prod-test-data.sql — remove production-readiness QA fixtures from a
-- project that is also production.
--
-- The launch QA seed (scripts/dev/seed-readiness-qa-dev.mjs) writes real orgs,
-- properties, members and auth users through the edge functions. It is safe on a
-- dedicated dev project; on fwor (promoted to production on 2026-10-27) it leaves
-- test tenants next to the migrated Kame Homes org. Run this before anyone
-- outside the team touches prod (Google / PayMongo review, host walkthrough).
--
-- Idempotent. Deletes only the fixture signatures the seed creates:
--   orgs with slug readiness-qa-*
--   auth users with email sprmke.dev+qa-*
--
-- Legacy guest sign-ins (the five Google users legacy guests never needed) are
-- handled separately by 50-cleanup-guest-auth.sql.
--
-- Plan: docs/workflow/in-progress/kamespace-02-legacy-prod-to-mt-prod-cutover.md

-- activity_log is append-only (a BEFORE DELETE trigger rejects deletes), and the
-- rows carry no FK to organizations. Delete them under replica role so the guard
-- trigger is bypassed, in their own transaction: the same role would also
-- suppress FK cascade triggers, so never use it for the org delete below.
begin;
set local session_replication_role = replica;
delete from public.activity_log
where organization_id in (
  select id from public.organizations where slug like 'readiness-qa-%'
);
commit;

begin;

-- Cascades properties, settings, subscriptions, members, roles, invitations,
-- notifications, marketing/social rows, AI rows and support tickets.
delete from public.organizations
where slug like 'readiness-qa-%';

delete from auth.users
where lower(email) like 'sprmke.dev+qa-%';

commit;

select 'organizations' as what, count(*)::int as remaining from public.organizations
union all
select 'properties', count(*)::int from public.properties
union all
select 'auth_users', count(*)::int from auth.users
union all
select 'qa_users', count(*)::int from auth.users where lower(email) like 'sprmke.dev+qa-%'
union all
select 'qa_orgs', count(*)::int from public.organizations where slug like 'readiness-qa-%';
