-- Phase 7: schedule the pre-arrival parking reminder sweep (`send-parking-reminders`).
-- Mirrors sync_parking_broadcast_expire_cron_job() (self-invoking migration, fixed cadence,
-- no settings UI) — see 20261018120001_parking_broadcast_expire_cron.sql.

CREATE OR REPLACE FUNCTION public.sync_parking_reminder_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '0 6 * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/send-parking-reminders',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'parking_reminder_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Parking-Reminder-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'parking_reminder_cron_secret')
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
    WHERE jobname = 'parking-reminder-daily'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('parking-reminder-daily', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_parking_reminder_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_parking_reminder_cron_job() IS
  'Rebuilds parking-reminder-daily cron job. SECURITY DEFINER; service_role only. '
  'Requires Vault secrets project_url + anon_key (see scheduled-jobs-and-testing.md §11.3); '
  'safe to call on environments missing pg_cron/pg_net/Vault — returns {ok:false, error} instead of failing.';

REVOKE ALL ON FUNCTION public.sync_parking_reminder_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_parking_reminder_cron_job() TO service_role;

-- Self-invoke: fixed cadence, no admin PATCH drives this. No-op (ok:false) on environments
-- without pg_cron/pg_net/Vault, e.g. a fresh local `db reset`.
SELECT public.sync_parking_reminder_cron_job();
