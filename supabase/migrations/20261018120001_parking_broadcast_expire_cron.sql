-- Parking E2E Phase 1e: schedule the TTL expiry sweep (`expire-parking-broadcasts`).
-- The function/handler already existed and is idempotent, but no `cron.schedule` ever
-- ran it in any environment — see docs/archive/operations/scheduled-jobs-and-testing.md.
-- Mirrors the sync_telegram_maintenance_hourly_cron_job() pattern (fixed, non-configurable
-- cadence — no settings UI needed, so this migration self-invokes at the bottom instead of
-- waiting on an admin PATCH to trigger it).

CREATE OR REPLACE FUNCTION public.sync_parking_broadcast_expire_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '*/5 * * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/expire-parking-broadcasts',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'parking_broadcast_expire_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Parking-Broadcast-Expire-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'parking_broadcast_expire_cron_secret')
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
  FOR r IN
    SELECT jobname FROM cron.job
    WHERE jobname = 'parking-broadcast-expire-every-5m'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('parking-broadcast-expire-every-5m', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_parking_broadcast_expire_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_parking_broadcast_expire_cron_job() IS
  'Rebuilds parking-broadcast-expire-every-5m cron job. SECURITY DEFINER; service_role only. '
  'Requires Vault secrets project_url + anon_key (see scheduled-jobs-and-testing.md §11.3); '
  'safe to call on environments missing pg_cron/pg_net/Vault — returns {ok:false, error} instead of failing.';

REVOKE ALL ON FUNCTION public.sync_parking_broadcast_expire_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_parking_broadcast_expire_cron_job() TO service_role;

-- Self-invoke: no settings UI drives this (fixed cadence), so activate immediately on
-- environments with pg_cron + Vault configured. No-op (ok:false, logged as a NOTICE-free
-- return value) on environments without them — e.g. a fresh local `db reset`.
SELECT public.sync_parking_broadcast_expire_cron_job();
