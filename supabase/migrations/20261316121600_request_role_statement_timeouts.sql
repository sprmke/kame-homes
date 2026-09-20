-- Database connection pooling / lock discipline — Phase 15.3.
-- Plan: docs/workflow/planned/production-readiness-checklist/15-database-connection-pooling.md
--
-- All HTTP-driven queries (edge functions via supabase-js, and any direct
-- anon/authenticated PostgREST calls) run as one of Postgres's three
-- PostgREST-facing roles: anon, authenticated, service_role. Nothing in this
-- repo previously set statement_timeout or idle_in_transaction_session_timeout
-- at the role level, so a stuck statement (a bad query plan, a lock wait
-- behind a long migration, a runaway RPC) could hold a PostgREST pool
-- connection indefinitely instead of failing fast.
--
-- Values follow this doc's own guidance (10-30s for request paths). 20s sits
-- in the middle: generous enough for the heaviest known admin list/finance
-- queries (see doc 10's listBookings / fetchAllBookingsForFinance work),
-- short enough that a stuck statement cannot starve the PostgREST pool for
-- more than ~20s. idle_in_transaction_session_timeout is set slightly higher
-- (30s) since a legitimate multi-statement RPC (e.g. a future workflowOrchestrator
-- atomicity fix — see doc 15 Phase 15.3 findings) may briefly sit idle between
-- statements inside one transaction.
--
-- Not touched: the postgres superuser role and any role used by
-- `supabase db push` / direct psql (backup/restore/migration scripts) — those
-- need to run arbitrarily long DDL/COPY operations and must not inherit a
-- request-path timeout. Only the three PostgREST-facing roles are scoped here.
--
-- These are role-level defaults, not database-wide — `SET LOCAL statement_timeout`
-- inside a specific RPC can still override for a known-long, deliberately
-- allowed operation.
--
-- Local-vs-hosted privilege gap (verified 2026-09-18 against a running local
-- stack): the local Supabase Postgres image runs migrations as `postgres`,
-- which is NOT a superuser locally and cannot ALTER ROLE for
-- anon/authenticated/service_role — only `supabase_admin` can (fails with
-- 42501 "anon is a reserved role, only superusers can modify it"; `postgres`
-- also cannot `SET ROLE supabase_admin`, permission denied). Hosted
-- Supabase's own migration path runs with the privilege this needs. Guarded
-- in a DO block so local `db:migrate` does not hard-fail the whole migration
-- run — every later migration in this repo depends on this one applying
-- cleanly on `--include-all`.

DO $$
BEGIN
  ALTER ROLE anon SET statement_timeout = '20s';
  ALTER ROLE anon SET idle_in_transaction_session_timeout = '30s';

  ALTER ROLE authenticated SET statement_timeout = '20s';
  ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '30s';

  ALTER ROLE service_role SET statement_timeout = '20s';
  ALTER ROLE service_role SET idle_in_transaction_session_timeout = '30s';

  COMMENT ON ROLE service_role IS
    'service_role: statement_timeout=20s, idle_in_transaction_session_timeout=30s '
    'set 2026-09 (doc 15 Phase 15.3) so a stuck statement or crashed function '
    'cannot hold a PostgREST pool connection indefinitely. A specific RPC that '
    'legitimately needs longer must SET LOCAL statement_timeout for its own '
    'session, not rely on the role default.';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING
    'Skipped role-level statement_timeout (doc 15 Phase 15.3): current role lacks '
    'privilege to ALTER anon/authenticated/service_role. Expected on local Supabase '
    '(only supabase_admin can alter these roles there) — must succeed on hosted '
    'deploy. Verify post-deploy with: SELECT rolname, rolconfig FROM pg_roles WHERE '
    'rolname IN (''anon'',''authenticated'',''service_role'');';
END $$;
