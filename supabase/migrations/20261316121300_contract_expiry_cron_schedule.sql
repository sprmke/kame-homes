-- Register the daily listing-contract lifecycle sweep.
-- 01:00 UTC is 09:00 Asia/Manila.

CREATE OR REPLACE FUNCTION public.sync_contract_expiry_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr TEXT := '0 1 * * *';
  v_cmd_body TEXT := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/contract-expiry-cron',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
    'X-Contract-Expiry-Cron-Secret',
      (SELECT decrypted_secret FROM vault.decrypted_secrets
       WHERE name = 'contract_expiry_cron_secret')
  ),
  body := '{}'::jsonb
);
$BODY$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'pg_cron extension not installed');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name IN ('project_url', 'anon_key', 'contract_expiry_cron_secret')
    HAVING count(DISTINCT name) = 3
  ) THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'required Vault secrets are not configured'
    );
  END IF;

  FOR r IN
    SELECT jobname
    FROM cron.job
    WHERE jobname = 'contract-expiry-daily-manila'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('contract-expiry-daily-manila', cron_expr, v_cmd_body);
  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_contract_expiry_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_contract_expiry_cron_job() IS
  'Rebuilds the daily Manila listing-contract expiry cron. SECURITY DEFINER; service_role only.';

REVOKE ALL ON FUNCTION public.sync_contract_expiry_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_contract_expiry_cron_job() TO service_role;

SELECT public.sync_contract_expiry_cron_job();
