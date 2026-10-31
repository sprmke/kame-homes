-- Probe the configured Gemini Live model weekly. The handler skips provider access in production.

CREATE OR REPLACE FUNCTION public.sync_voice_receptionist_canary_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr TEXT := '0 2 * * 1';
  v_cmd_body TEXT := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/voice-receptionist-canary',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (
      SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'
    ),
    'X-Voice-Receptionist-Canary-Secret', COALESCE(
      (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'voice_receptionist_canary_secret'
      ),
      ''
    )
  ),
  body := '{}'::jsonb
);
$BODY$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'pg_cron extension not installed');
  END IF;

  FOR r IN
    SELECT jobname FROM cron.job WHERE jobname = 'voice-receptionist-canary-weekly'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('voice-receptionist-canary-weekly', cron_expr, v_cmd_body);
  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_voice_receptionist_canary_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.sync_voice_receptionist_canary_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_voice_receptionist_canary_cron_job() TO service_role;

SELECT public.sync_voice_receptionist_canary_cron_job();
