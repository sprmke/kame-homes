-- Schedule platform-billing-cron (property subscription renewal + dunning).
-- Plan: docs/workflow/in-progress/paymongo-subscription-billing.md

CREATE OR REPLACE FUNCTION public.sync_platform_billing_cron_job()
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
         || '/functions/v1/platform-billing-cron',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'platform_billing_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Platform-Billing-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'platform_billing_cron_secret')
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
    WHERE jobname = 'platform-billing-daily'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('platform-billing-daily', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_platform_billing_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_platform_billing_cron_job() IS
  'Rebuilds platform-billing-daily cron (06:00 UTC). SECURITY DEFINER; service_role only.';

REVOKE ALL ON FUNCTION public.sync_platform_billing_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_platform_billing_cron_job() TO service_role;

SELECT public.sync_platform_billing_cron_job();
