-- Org Activity & Audit Log — Phase 6: retention.
-- Plan: docs/workflow/in-progress/org-activity-audit-log.md  (Phase 6)
-- Ops:  docs/archive/operations/scheduled-jobs-and-testing.md
--
-- activity_log is append-only (20261306150000): a BEFORE UPDATE OR DELETE trigger
-- rejects every DELETE unless `activity_log.allow_purge = 'on'` is set in-session.
-- This migration adds:
--   1. platform_settings.activity_log_retention_months  (default 24, editable knob)
--   2. purge_activity_log(months, max_rows)  — SECURITY DEFINER; sets the GUC and
--      batch-deletes rows past the window. The ONLY sanctioned purge path.
--   3. sync_activity_log_retention_cron_job()  — monthly pg_cron job → the
--      activity-log-retention-cron edge function.

-- ── 1. Retention window knob ────────────────────────────────────────────────

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS activity_log_retention_months INT NOT NULL DEFAULT 24
    CHECK (activity_log_retention_months >= 6);

COMMENT ON COLUMN public.platform_settings.activity_log_retention_months IS
  'How many months of activity_log rows the monthly retention cron keeps hot. '
  'Floor 6. Data is retained regardless of a plan''s queryable window.';

-- ── 2. Sanctioned purge RPC ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.purge_activity_log(
  p_retention_months INT DEFAULT 24,
  p_max_rows INT DEFAULT 200000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_months INT := GREATEST(COALESCE(p_retention_months, 24), 6);
  v_cutoff TIMESTAMPTZ := NOW() - make_interval(months => v_months);
  v_batch INT := 5000;
  v_total INT := 0;
  v_deleted INT;
BEGIN
  -- Opt this transaction past the append-only trigger.
  PERFORM set_config('activity_log.allow_purge', 'on', true);

  LOOP
    DELETE FROM public.activity_log
    WHERE ctid IN (
      SELECT ctid FROM public.activity_log
      WHERE created_at < v_cutoff
      LIMIT v_batch
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_total := v_total + v_deleted;
    EXIT WHEN v_deleted = 0 OR v_total >= COALESCE(p_max_rows, 200000);
  END LOOP;

  RETURN v_total;
END;
$fn$;

COMMENT ON FUNCTION public.purge_activity_log(INT, INT) IS
  'Retention purge for activity_log — deletes rows older than p_retention_months '
  '(floor 6) in bounded batches, capped at p_max_rows per call. Sets '
  'activity_log.allow_purge so the append-only trigger permits the DELETE. '
  'Called only by the activity-log-retention-cron edge function.';

REVOKE ALL ON FUNCTION public.purge_activity_log(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_activity_log(INT, INT) TO service_role;

-- ── 3. Monthly cron ────────────────────────────────────────────────────────
-- Mirrors sync_property_page_views_prune_cron_job() (20261313120000).

CREATE OR REPLACE FUNCTION public.sync_activity_log_retention_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  -- 18:00 UTC on the 1st = 02:00 Asia/Manila on the 2nd (offset from the
  -- page-views prune at 17:00 UTC so the two never collide).
  cron_expr text := '0 18 1 * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/activity-log-retention-cron',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'activity_log_retention_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Activity-Log-Retention-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'activity_log_retention_cron_secret')
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
    SELECT jobname FROM cron.job WHERE jobname = 'activity-log-retention-monthly-manila'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('activity-log-retention-monthly-manila', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_activity_log_retention_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_activity_log_retention_cron_job() IS
  'Rebuilds the activity-log-retention-monthly-manila cron job. SECURITY DEFINER; '
  'service_role only. Requires Vault secrets project_url + anon_key; safe on '
  'environments without pg_cron/pg_net/Vault — returns {ok:false, error}.';

REVOKE ALL ON FUNCTION public.sync_activity_log_retention_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_activity_log_retention_cron_job() TO service_role;

SELECT public.sync_activity_log_retention_cron_job();
