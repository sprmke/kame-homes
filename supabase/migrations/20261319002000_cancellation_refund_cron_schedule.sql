-- Daily cancellation refund / request-expiry sweep.
-- Plan: docs/workflow/in-progress/cancellation-policy-and-process.md §4.8
--
-- Same self-healing Vault-secret pattern as sd-refund-cron. While
-- `cancellation_refund_cron_secret` is absent from Vault, the job still runs
-- without the header (the handler's verifyCronSecret is fail-open until the
-- secret is configured, matching every sibling cron).

CREATE OR REPLACE FUNCTION public.sync_cancellation_refund_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '0 1 * * *'; -- 09:00 Asia/Manila
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/cancellation-refund-cron',
  headers := (
    CASE
      WHEN EXISTS (
        SELECT 1 FROM vault.decrypted_secrets ds
        WHERE ds.name = 'cancellation_refund_cron_secret'
      )
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'x-cancellation-refund-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cancellation_refund_cron_secret')
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
    WHERE jobname IN ('cancellation-refund-cron-daily', 'cancellation-refund-cron-daily-managed')
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('cancellation-refund-cron-daily-managed', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_cancellation_refund_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_cancellation_refund_cron_job() IS
  'Rebuilds the daily cancellation-refund-cron job. SECURITY DEFINER; service_role only. '
  'Requires Vault secrets project_url, anon_key, and (optional) cancellation_refund_cron_secret.';

REVOKE ALL ON FUNCTION public.sync_cancellation_refund_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_cancellation_refund_cron_job() TO service_role;

SELECT public.sync_cancellation_refund_cron_job();
