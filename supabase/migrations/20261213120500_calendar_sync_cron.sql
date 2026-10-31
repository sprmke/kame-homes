-- Airbnb / OTA two-way calendar sync — Phase 1.
-- Plan: docs/workflow/done/airbnb-calendar-sync.md §11
--
-- Schedules the global feed sweep (`calendar-sync-cron`). Mirrors
-- sync_parking_reminder_cron_job() (20261201120200) — self-invoking migration, fixed cadence,
-- no settings UI. The edge handler itself enforces a per-feed minimum interval
-- (CALENDAR_SYNC_MIN_INTERVAL_MINUTES, default 30) so tightening this cron is safe.

CREATE OR REPLACE FUNCTION public.sync_calendar_sync_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '*/30 * * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/calendar-sync-cron',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'calendar_sync_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Calendar-Sync-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'calendar_sync_cron_secret')
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
    SELECT jobname FROM cron.job WHERE jobname = 'calendar-sync-every-30m'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('calendar-sync-every-30m', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_calendar_sync_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_calendar_sync_cron_job() IS
  'Rebuilds the calendar-sync-every-30m cron job. SECURITY DEFINER; service_role only. '
  'Requires Vault secrets project_url + anon_key (see scheduled-jobs-and-testing.md); '
  'safe to call on environments missing pg_cron/pg_net/Vault — returns {ok:false, error}.';

REVOKE ALL ON FUNCTION public.sync_calendar_sync_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_calendar_sync_cron_job() TO service_role;

-- Self-invoke: no-op (ok:false) on environments without pg_cron/pg_net/Vault (e.g. fresh local reset).
SELECT public.sync_calendar_sync_cron_job();
