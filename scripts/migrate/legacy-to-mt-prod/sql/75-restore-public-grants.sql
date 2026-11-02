-- 75-restore-public-grants.sql — re-assert the standard public-schema grants after
-- a restore or data push.
--
-- Why: a project restored from a legacy dump can end up with tables that have RLS
-- enabled but no table grants for the PostgREST roles. Edge functions then see
-- "permission denied for table X" (SQLSTATE 42501) on writes while reads against
-- other tables keep working, so the failure is easy to miss. Caught on `fwor`
-- 2026-11-02: processed_emails, email_suppressions, query_cache,
-- platform_super_admins, guest_saved_properties and two telegram logs had lost
-- their grants; the inbound approval webhook returned 200 but never recorded rows.
--
-- Idempotent. Run it after any reload of prod data (T0 reload, restore drill).
-- Does NOT grant function EXECUTE (SECURITY DEFINER functions keep their own grants).

begin;

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Match the tracked intent: every table is readable through RLS for these roles.
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- The two search projections are trigger-maintained and service_role-only.
revoke all on table public.public_listing_search from anon, authenticated;
revoke all on table public.public_listing_catalog_version from anon, authenticated;

-- Future objects created by migrations inherit the same grants.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

commit;

-- Report any table that still cannot be read or written by service_role.
select c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and (
    not has_table_privilege('service_role', c.oid, 'SELECT')
    or not has_table_privilege('service_role', c.oid, 'INSERT')
    or not has_table_privilege('service_role', c.oid, 'UPDATE')
    or not has_table_privilege('service_role', c.oid, 'DELETE')
  )
order by 1;
