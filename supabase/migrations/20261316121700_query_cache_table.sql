-- Generic read-through query cache (doc 12, Phase 12.3).
--
-- Shape mirrors `ai_platform_response_cache` (`_shared/aiQuotaCache.ts`): a content-addressed
-- key, an explicit TTL column, best-effort writes. This is a DB-backed cache for expensive,
-- shared, per-request-recomputed aggregates — first wired to `dashboard-stats`
-- (`_shared/dashboardService.ts#computeDashboardStats`), which does an unbounded
-- `select('*')` on `guest_submissions` (single-property, single-parking, org-wide, and
-- "no scope" branches all fetch every matching row, no `.limit()` anywhere in the function)
-- and is polled every 60s by every open property/org/parking dashboard tab
-- (`ui/src/features/dashboard/property/hooks/useDashboardStats.ts`,
-- `useOrgDashboardStats.ts`, `useParkingDashboardStats.ts`) — an expensive aggregate
-- multiplied by every open tab, the doc's own definition of the worst-offender shape.
--
-- SECURITY — cache_key must encode every scope + permission dimension of the read it
-- caches. For dashboard-stats specifically: org-scoped requests resolve a per-viewer
-- `scopedPropertyIds`/`scopedParkingIds` set (`_shared/orgAuth.ts#resolveAssignedListingIdsForOrgUser`)
-- for admins where `all_listings = false` — two admins on the same org can legitimately see
-- different listing sets. A cache key built from org_id alone would let a scoped admin's
-- response leak to (or receive) an all-listings admin's response, or leak between two
-- differently-scoped admins. `_shared/queryCache.ts#buildDashboardStatsCacheKey` hashes the
-- resolved scope-id list into the key for exactly this reason — do not key this table by
-- org/property/parking id alone from any future call site without including the resolved
-- viewer-permission scope the same way.
CREATE TABLE IF NOT EXISTS query_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  -- Scope columns kept alongside the opaque key (not parsed out of it) so a tenant's cache
  -- can be purged wholesale without decoding the key — mirrors the doc's own Phase 12.3 rule.
  scope_org_id uuid NULL,
  scope_property_id uuid NULL,
  scope_parking_id uuid NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  -- Bumped whenever a deploy changes a cached payload's shape (schema version embedded in
  -- the key itself by the TS helper, mirrored here as a plain column for cheap bulk purges
  -- of a stale version without needing to pattern-match the key).
  schema_version int NOT NULL DEFAULT 1
);

-- Read path: exact key lookup, already covered by the primary key.
-- Sweep path: expired-row cleanup by expires_at.
CREATE INDEX IF NOT EXISTS idx_query_cache_expires_at ON query_cache (expires_at);

-- Wholesale tenant purge path (invalidation on a booking transition).
CREATE INDEX IF NOT EXISTS idx_query_cache_scope_org_id ON query_cache (scope_org_id)
  WHERE scope_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_query_cache_scope_property_id ON query_cache (scope_property_id)
  WHERE scope_property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_query_cache_scope_parking_id ON query_cache (scope_parking_id)
  WHERE scope_parking_id IS NOT NULL;

COMMENT ON TABLE query_cache IS
  'Generic read-through cache for expensive shared aggregates (doc 12, Phase 12.3). '
  'cache_key must include every scope + viewer-permission dimension — see file header comment. '
  'service_role only, no public RLS policy (edge functions are the access boundary per '
  'CLAUDE.md "RLS is not the access-control layer today").';

-- No RLS policy is added deliberately: this table is only ever read/written by the
-- service-role client from edge functions (_shared/queryCache.ts), never from a
-- client-side Supabase call. RLS stays disabled here the same way it is on other
-- service-role-only tables in this codebase (see CLAUDE.md's RLS sharp-edge note).

-- Nightly sweep cron for expired rows — mirrors sync_dashboard_assistant_expire_cron_job's
-- pattern (20261316121100_dashboard_assistant_expire_cron.sql): rebuild the cron job
-- idempotently, no-op cleanly when pg_cron/pg_net/Vault are unavailable (local dev).
CREATE OR REPLACE FUNCTION public.sync_query_cache_sweep_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '17 2 * * *'; -- 02:17 UTC = 10:17 Manila, off-peak, matches doc's nightly-cadence convention
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/query-cache-sweep-cron',
  headers := (
    CASE
      WHEN EXISTS (
        SELECT 1 FROM vault.decrypted_secrets ds
        WHERE ds.name = 'query_cache_sweep_cron_secret'
      )
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Query-Cache-Sweep-Cron-Secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'query_cache_sweep_cron_secret'
        )
      )
      ELSE jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
      )
    END
  ),
  body := '{}'::jsonb
);
$BODY$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'pg_cron extension not installed');
  END IF;

  FOR r IN
    SELECT jobname FROM cron.job WHERE jobname = 'query-cache-sweep-nightly'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule(
    'query-cache-sweep-nightly',
    cron_expr,
    v_cmd_body
  );

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_query_cache_sweep_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_query_cache_sweep_cron_job() IS
  'Rebuilds the query-cache-sweep-nightly cron job (deletes expired query_cache rows so the '
  'cache table itself does not become the next unbounded table). SECURITY DEFINER; '
  'service_role only. Requires Vault secrets project_url + anon_key; optional '
  'query_cache_sweep_cron_secret. Safe when pg_cron/pg_net/Vault are missing.';

REVOKE ALL ON FUNCTION public.sync_query_cache_sweep_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_query_cache_sweep_cron_job() TO service_role;

SELECT public.sync_query_cache_sweep_cron_job();
