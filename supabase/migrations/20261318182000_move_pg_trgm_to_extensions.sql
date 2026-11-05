-- Clear database linter 0014 (extension_in_public) for pg_trgm.
--
-- Plan: docs/workflow/in-progress/supabase-capacity-and-operational-readiness.md
--
-- The extension's operator classes are referenced by OID from the existing GIN
-- indexes, so moving it does not invalidate those indexes. No application or
-- function calls similarity()/word_similarity() directly; search uses LIKE and
-- the pls_* ranking helpers. Future trigram indexes should use
-- `extensions.gin_trgm_ops` if the migration role's search_path does not include
-- `extensions`.
--
-- activity-log: N/A (extension schema only).

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_extension e
       JOIN pg_namespace n ON n.oid = e.extnamespace
       WHERE e.extname = 'pg_trgm' AND n.nspname = 'extensions'
     )
  THEN
    EXECUTE 'ALTER EXTENSION pg_trgm SET SCHEMA extensions';
  END IF;
END
$do$;
