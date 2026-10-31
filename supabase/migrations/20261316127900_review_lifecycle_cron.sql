-- Two-way reviews: hourly lifecycle cron (open windows, request/reminder emails,
-- host review_due bells, force-publish expired windows).
-- Plan: docs/workflow/in-progress/two-way-reviews.md (Phase 3)
-- Ops:  docs/archive/operations/scheduled-jobs-and-testing.md

CREATE OR REPLACE FUNCTION public.sync_review_lifecycle_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  -- Hourly, :17 so it does not collide with on-the-hour jobs.
  cron_expr text := '17 * * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/review-lifecycle-cron',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'review_lifecycle_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Review-Lifecycle-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'review_lifecycle_cron_secret')
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
    SELECT jobname FROM cron.job WHERE jobname = 'review-lifecycle-hourly'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('review-lifecycle-hourly', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_review_lifecycle_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_review_lifecycle_cron_job() IS
  'Rebuilds the review-lifecycle-hourly cron job. SECURITY DEFINER; service_role only. '
  'Requires Vault secrets project_url + anon_key; safe on environments without '
  'pg_cron/pg_net/Vault — returns {ok:false, error}.';

REVOKE ALL ON FUNCTION public.sync_review_lifecycle_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_review_lifecycle_cron_job() TO service_role;

SELECT public.sync_review_lifecycle_cron_job();
