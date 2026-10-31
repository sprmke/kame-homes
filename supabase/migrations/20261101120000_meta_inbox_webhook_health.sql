-- Meta inbox webhook health checks: verify subscriptions every 10 minutes and
-- expose retry state without forcing operators to disconnect/reconnect.

ALTER TABLE public.social_channel_connections
  ADD COLUMN IF NOT EXISTS webhook_last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_verify_attempts INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.sync_meta_inbox_webhook_healthcheck_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '*/10 * * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/meta-inbox-webhook-healthcheck',
  headers := (
    CASE
      WHEN EXISTS (
        SELECT 1 FROM vault.decrypted_secrets ds
        WHERE ds.name = 'meta_inbox_webhook_healthcheck_cron_secret'
      )
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Meta-Inbox-Webhook-Healthcheck-Cron-Secret',
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'meta_inbox_webhook_healthcheck_cron_secret')
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
    WHERE jobname = 'meta-inbox-webhook-healthcheck-every-10m'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('meta-inbox-webhook-healthcheck-every-10m', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_meta_inbox_webhook_healthcheck_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_meta_inbox_webhook_healthcheck_cron_job() IS
  'Rebuilds meta-inbox-webhook-healthcheck-every-10m cron job. SECURITY DEFINER; service_role only. '
  'Requires Vault secrets project_url + anon_key, plus optional meta_inbox_webhook_healthcheck_cron_secret. '
  'Safe to call on environments missing pg_cron/pg_net/Vault — returns {ok:false, error} instead of failing.';

REVOKE ALL ON FUNCTION public.sync_meta_inbox_webhook_healthcheck_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_meta_inbox_webhook_healthcheck_cron_job() TO service_role;

SELECT public.sync_meta_inbox_webhook_healthcheck_cron_job();
