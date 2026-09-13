-- Marketing Studio AI generation — cron sweep for in-flight video jobs (Phase 2).
-- Mirrors sync_dashboard_assistant_expire_cron_job(). Hosted pg_cron + pg_net only;
-- no-ops cleanly on environments without pg_cron/pg_net/Vault.
--
-- Runs every minute: Google retains generated videos for only 2 days, so a host who
-- closes the tab mid-render would otherwise lose an already-paid-for render. A 1-minute
-- cadence puts the worst-case gap between Google's `done` and our download at <=60s —
-- three orders of magnitude inside the retention window.

CREATE OR REPLACE FUNCTION public.sync_marketing_generation_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '* * * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/marketing-generation-sweeper',
  headers := (
    CASE
      WHEN EXISTS (
        SELECT 1 FROM vault.decrypted_secrets ds
        WHERE ds.name = 'marketing_generation_cron_secret'
      )
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Marketing-Generation-Cron-Secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'marketing_generation_cron_secret'
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
    SELECT jobname FROM cron.job WHERE jobname = 'marketing-generation-sweeper-every-1m'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule(
    'marketing-generation-sweeper-every-1m',
    cron_expr,
    v_cmd_body
  );

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_marketing_generation_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_marketing_generation_cron_job() IS
  'Rebuilds the marketing-generation-sweeper-every-1m cron job. SECURITY DEFINER; service_role '
  'only. Requires Vault secrets project_url + anon_key; optional marketing_generation_cron_secret. '
  'Safe when pg_cron/pg_net/Vault are missing.';

REVOKE ALL ON FUNCTION public.sync_marketing_generation_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_marketing_generation_cron_job() TO service_role;

SELECT public.sync_marketing_generation_cron_job();
