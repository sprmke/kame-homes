-- Smart Pricing autopilot cron — nightly sweep of properties with mode='autopilot'.
-- Mirrors sync_superhost_assessment_cron_job (20261231130200). Hosted pg_cron + pg_net only;
-- no-ops cleanly on environments without pg_cron/pg_net/Vault.
-- Runs 17:30 UTC daily = 01:30 Asia/Manila (low-traffic hour).

CREATE OR REPLACE FUNCTION public.sync_smart_pricing_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '30 17 * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/smart-pricing-cron',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'smart_pricing_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Smart-Pricing-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'smart_pricing_cron_secret')
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
    SELECT jobname FROM cron.job WHERE jobname = 'smart-pricing-autopilot-nightly'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('smart-pricing-autopilot-nightly', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_smart_pricing_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_smart_pricing_cron_job() IS
  'Rebuilds the smart-pricing-autopilot-nightly cron job. SECURITY DEFINER; service_role only. '
  'Requires Vault secrets project_url + anon_key (see scheduled-jobs-and-testing.md); '
  'safe on environments missing pg_cron/pg_net/Vault — returns {ok:false, error}.';

REVOKE ALL ON FUNCTION public.sync_smart_pricing_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_smart_pricing_cron_job() TO service_role;

SELECT public.sync_smart_pricing_cron_job();
