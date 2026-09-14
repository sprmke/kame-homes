-- Dashboard assistant pending-action TTL + attachment retention cron.
-- Mirrors sync_smart_pricing_cron_job. Hosted pg_cron + pg_net only; no-ops
-- cleanly on environments without pg_cron/pg_net/Vault.
-- Runs every 5 minutes so expired Tier-2 actions do not sit more than one cadence.

CREATE OR REPLACE FUNCTION public.sync_dashboard_assistant_expire_cron_job()
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
         || '/functions/v1/dashboard-assistant-expire-pending-actions',
  headers := (
    CASE
      WHEN EXISTS (
        SELECT 1 FROM vault.decrypted_secrets ds
        WHERE ds.name = 'dashboard_assistant_expire_cron_secret'
      )
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Dashboard-Assistant-Expire-Cron-Secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'dashboard_assistant_expire_cron_secret'
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
    SELECT jobname FROM cron.job WHERE jobname = 'dashboard-assistant-expire-pending-actions-every-5m'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule(
    'dashboard-assistant-expire-pending-actions-every-5m',
    cron_expr,
    v_cmd_body
  );

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_dashboard_assistant_expire_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_dashboard_assistant_expire_cron_job() IS
  'Rebuilds the dashboard-assistant-expire-pending-actions-every-5m cron job. '
  'SECURITY DEFINER; service_role only. Requires Vault secrets project_url + anon_key; '
  'optional dashboard_assistant_expire_cron_secret. Safe when pg_cron/pg_net/Vault are missing.';

REVOKE ALL ON FUNCTION public.sync_dashboard_assistant_expire_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_dashboard_assistant_expire_cron_job() TO service_role;

SELECT public.sync_dashboard_assistant_expire_cron_job();
