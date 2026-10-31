-- Production readiness hardening: give the SD refund cron's hosted pg_cron job the same
-- self-healing, Vault-secret-aware schedule as `sync_parking_broadcast_expire_cron_job()`
-- (see supabase/migrations/20261018120001_parking_broadcast_expire_cron.sql).
--
-- Today the hosted `sd-refund-cron-every-5m` job (see
-- docs/archive/operations/scheduled-jobs-and-testing.md §11.3) was only ever created via a
-- one-off SQL Editor command — it is not version controlled and never sends a cron secret
-- header, so the unscoped (global sweep) path of `sd-refund-cron` has no way to distinguish
-- the real scheduler from any other caller. `supabase/functions/sd-refund-cron/index.ts` now
-- checks `SD_REFUND_CRON_SECRET` / `X-Sd-Refund-Cron-Secret` using the same
-- fail-open-until-configured convention as every sibling cron — this migration mirrors that:
-- while `sd_refund_cron_secret` is absent from Vault, behavior is unchanged (no header sent,
-- same as today); once an operator adds that secret to Vault, the very next tick starts
-- sending it automatically, no further migration needed.

CREATE OR REPLACE FUNCTION public.sync_sd_refund_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '*/5 * * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/sd-refund-cron',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'sd_refund_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Sd-Refund-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sd_refund_cron_secret')
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
  -- Clean up both the legacy manually-created job name and any prior run of this function,
  -- so we never end up with two jobs firing sd-refund-cron every 5 minutes.
  FOR r IN
    SELECT jobname FROM cron.job
    WHERE jobname IN ('sd-refund-cron-every-5m', 'sd-refund-cron-every-5m-managed')
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('sd-refund-cron-every-5m-managed', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_sd_refund_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_sd_refund_cron_job() IS
  'Rebuilds sd-refund-cron-every-5m-managed cron job (replaces the legacy manually-created '
  'sd-refund-cron-every-5m job). SECURITY DEFINER; service_role only. Requires Vault secrets '
  'project_url + anon_key; optional sd_refund_cron_secret enables the X-Sd-Refund-Cron-Secret '
  'header automatically once set. Safe to call on environments missing pg_cron/pg_net/Vault — '
  'returns {ok:false, error} instead of failing.';

REVOKE ALL ON FUNCTION public.sync_sd_refund_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_sd_refund_cron_job() TO service_role;

-- Self-invoke: fixed cadence, no settings UI drives this — activate immediately on
-- environments with pg_cron + Vault configured (project_url/anon_key). No-op
-- ({ok:false}, not an error) on environments without them, e.g. a fresh local `db reset`
-- that hasn't seeded those Vault secrets yet.
SELECT public.sync_sd_refund_cron_job();
