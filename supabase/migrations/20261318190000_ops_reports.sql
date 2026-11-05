-- Weekly operations reports: storage, weekly metrics, and the cron schedule.
-- Plan: docs/workflow/in-progress/weekly-ops-report.md
--
-- The report itself is generated in the `ops-report-cron` / `ops-report` edge functions
-- (external vendor checks cannot run in SQL). This migration provides the durable row
-- and the database-only weekly aggregates.
--
-- activity-log: N/A (platform reporting tables only; no org/property/guest state).

CREATE TABLE IF NOT EXISTS public.ops_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL CHECK (environment IN ('production', 'non-production')),
  period_kind text NOT NULL CHECK (period_kind IN ('weekly', 'manual')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  overall_status text NOT NULL CHECK (overall_status IN ('ok', 'warn', 'error', 'unknown')),
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL,
  markdown text NOT NULL,
  generated_by text NOT NULL CHECK (generated_by IN ('cron', 'manual')),
  generated_at timestamptz NOT NULL DEFAULT now(),
  email_sent_at timestamptz,
  email_recipients text[],
  email_error text,
  UNIQUE (environment, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_ops_reports_generated_at
  ON public.ops_reports (generated_at DESC);

COMMENT ON TABLE public.ops_reports IS
  'Weekly operations report snapshots. Service-role only; RLS enabled with no policies.';

ALTER TABLE public.ops_reports ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ops_reports TO service_role;

-- Database-only weekly aggregates. Every value is a count or sum; no guest PII,
-- message body, prompt text, or secret is selected.
CREATE OR REPLACE FUNCTION public.get_ops_weekly_metrics(
  p_since timestamptz,
  p_until timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'bookings', jsonb_build_object(
      'created', (SELECT count(*) FROM public.guest_submissions WHERE created_at >= p_since AND created_at < p_until),
      'completed', (SELECT count(*) FROM public.guest_submissions WHERE status = 'COMPLETED' AND status_updated_at >= p_since AND status_updated_at < p_until),
      'cancelled', (SELECT count(*) FROM public.guest_submissions WHERE status = 'CANCELLED' AND status_updated_at >= p_since AND status_updated_at < p_until),
      'pending_review', (SELECT count(*) FROM public.guest_submissions WHERE status = 'PENDING_REVIEW'),
      'pending_documents', (SELECT count(*) FROM public.guest_submissions WHERE status = 'PENDING_DOCUMENTS'),
      'ready_for_checkin', (SELECT count(*) FROM public.guest_submissions WHERE status = 'READY_FOR_CHECKIN'),
      'ready_for_checkout', (SELECT count(*) FROM public.guest_submissions WHERE status = 'READY_FOR_CHECKOUT')
    ),
    'emails', jsonb_build_object(
      'processed', (SELECT count(*) FROM public.processed_emails WHERE processed_at >= p_since AND processed_at < p_until),
      'suppressed', (SELECT count(*) FROM public.email_suppressions WHERE suppressed_at >= p_since AND suppressed_at < p_until)
    ),
    'payments', jsonb_build_object(
      'parking_paid', (SELECT count(*) FROM public.parking_payment_transactions WHERE status = 'paid' AND created_at >= p_since AND created_at < p_until),
      'parking_failed', (SELECT count(*) FROM public.parking_payment_transactions WHERE status = 'failed' AND created_at >= p_since AND created_at < p_until),
      'org_paid', (SELECT count(*) FROM public.org_payment_transactions WHERE status = 'paid' AND created_at >= p_since AND created_at < p_until),
      'org_failed', (SELECT count(*) FROM public.org_payment_transactions WHERE status = 'failed' AND created_at >= p_since AND created_at < p_until)
    ),
    'support', jsonb_build_object(
      'opened', (SELECT count(*) FROM public.support_tickets WHERE created_at >= p_since AND created_at < p_until),
      'open_now', (SELECT count(*) FROM public.support_tickets WHERE status IN ('open', 'in_progress'))
    ),
    'social', jsonb_build_object(
      'webhook_events', (SELECT count(*) FROM public.social_webhook_events WHERE processed_at >= p_since AND processed_at < p_until)
    ),
    'ai', jsonb_build_object(
      'requests', (SELECT count(*) FROM public.ai_platform_usage_events WHERE created_at >= p_since AND created_at < p_until),
      'errors', (SELECT count(*) FROM public.ai_platform_usage_events WHERE status = 'error' AND created_at >= p_since AND created_at < p_until),
      'credits', (SELECT COALESCE(sum(credits_consumed), 0) FROM public.ai_platform_usage_events WHERE created_at >= p_since AND created_at < p_until)
    ),
    'activity', jsonb_build_object(
      'total', (SELECT count(*) FROM public.activity_log WHERE created_at >= p_since AND created_at < p_until),
      'destructive', (SELECT count(*) FROM public.activity_log WHERE severity = 'destructive' AND created_at >= p_since AND created_at < p_until)
    ),
    'ops', jsonb_build_object(
      'rate_limit_rows', (SELECT count(*) FROM public.request_rate_limits),
      'failing_jobs', (SELECT count(*) FROM public.system_job_heartbeats WHERE consecutive_failures > 0),
      'db_size_bytes', pg_database_size(current_database())
    )
  );
$fn$;

COMMENT ON FUNCTION public.get_ops_weekly_metrics(timestamptz, timestamptz) IS
  'Database-only weekly aggregates for the operations report. service_role only.';

REVOKE ALL ON FUNCTION public.get_ops_weekly_metrics(timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ops_weekly_metrics(timestamptz, timestamptz)
  TO service_role;

-- Schedule the weekly job only when operators have provisioned the Vault secret.
-- The edge function still verifies the same secret, so a missing secret is a no-op,
-- never an unauthenticated generation path.
CREATE OR REPLACE FUNCTION public.sync_ops_report_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  cron_expr text := '0 0 * * 1'; -- Monday 08:00 Manila (00:00 UTC)
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/ops-report-cron',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
    'X-Ops-Report-Cron-Secret', (
      SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ops_report_cron_secret'
    )
  ),
  body := '{}'::jsonb
);
$BODY$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'pg_cron extension not installed');
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-report-weekly-manila') THEN
    PERFORM cron.unschedule('ops-report-weekly-manila');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'ops_report_cron_secret'
  ) THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'vault secret ops_report_cron_secret missing; job not scheduled'
    );
  END IF;

  PERFORM cron.schedule('ops-report-weekly-manila', cron_expr, v_cmd_body);
  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_ops_report_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_ops_report_cron_job() IS
  'Rebuilds the Monday 08:00 Manila ops-report cron job. Requires Vault secrets '
  'project_url, anon_key, and ops_report_cron_secret. Safe when pg_cron/Vault are missing.';

REVOKE ALL ON FUNCTION public.sync_ops_report_cron_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_ops_report_cron_job() TO service_role;

SELECT public.sync_ops_report_cron_job();
