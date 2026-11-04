-- Marketing media library — Phase 1 (T1.9): orphan finder + hosted cron for marketing-media-sweeper.
-- Mirrors sync_marketing_generation_cron_job(); reuses the marketing_generation_cron_secret Vault
-- secret. Hosted pg_cron + pg_net only; no-ops cleanly where they are missing.

-- Objects in the bucket with no asset row (original or poster), older than p_min_age_hours.
-- Returned names are removed through the Storage API by the sweeper, never deleted here.
CREATE OR REPLACE FUNCTION public.marketing_media_orphan_objects(
  p_min_age_hours INTEGER DEFAULT 24,
  p_limit INTEGER DEFAULT 200
)
RETURNS TABLE (name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT o.name
  FROM storage.objects o
  WHERE o.bucket_id = 'marketing-media'
    AND o.created_at < now() - make_interval(hours => p_min_age_hours)
    AND NOT EXISTS (
      SELECT 1 FROM public.marketing_media_assets a
      WHERE a.bucket = 'marketing-media'
        AND (a.storage_path = o.name OR a.poster_path = o.name)
    )
  ORDER BY o.created_at
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.marketing_media_orphan_objects(INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_media_orphan_objects(INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_marketing_media_sweeper_cron_job()
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
         || '/functions/v1/marketing-media-sweeper',
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
    SELECT jobname FROM cron.job WHERE jobname = 'marketing-media-sweeper-every-30m'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('marketing-media-sweeper-every-30m', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_marketing_media_sweeper_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_marketing_media_sweeper_cron_job() IS
  'Rebuilds the marketing-media-sweeper-every-30m cron job. SECURITY DEFINER; service_role only. '
  'Requires Vault secrets project_url + anon_key; optional marketing_generation_cron_secret. '
  'Safe when pg_cron/pg_net/Vault are missing.';

REVOKE ALL ON FUNCTION public.sync_marketing_media_sweeper_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_marketing_media_sweeper_cron_job() TO service_role;

SELECT public.sync_marketing_media_sweeper_cron_job();
