-- Super Admin System health module (`/admin/health`).
-- Plan: docs/workflow/in-progress/super-admin-system-health.md
--
-- system_job_heartbeats       : one row per scheduled edge function, written by serveCronPost
-- system_health_probe_results : last result per live provider probe (on-demand, throttled)
-- record_system_job_heartbeat : atomic per-run upsert
-- get_system_health_snapshot  : one read for the summary view (small tables + counters only;
--                               cron.job_run_details is deliberately not read)
-- get_system_health_capacity  : DB size, largest tables, storage per bucket (Usage page only)
--
-- Platform-only rows, no org scope. RLS on with no policies; service_role only.

CREATE TABLE IF NOT EXISTS public.system_job_heartbeats (
  job_name             TEXT PRIMARY KEY,
  last_started_at      TIMESTAMPTZ,
  last_finished_at     TIMESTAMPTZ,
  last_success_at      TIMESTAMPTZ,
  last_failure_at      TIMESTAMPTZ,
  last_status          TEXT CHECK (last_status IN ('ok', 'error')),
  last_error           TEXT,
  last_duration_ms     INT,
  consecutive_failures INT NOT NULL DEFAULT 0,
  total_runs           BIGINT NOT NULL DEFAULT 0,
  total_failures       BIGINT NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_job_heartbeats ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.system_job_heartbeats TO service_role;

CREATE TABLE IF NOT EXISTS public.system_health_probe_results (
  probe_id    TEXT PRIMARY KEY,
  status      TEXT NOT NULL CHECK (status IN ('ok', 'warn', 'error', 'off', 'unknown')),
  detail      TEXT,
  latency_ms  INT,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_health_probe_results ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.system_health_probe_results TO service_role;

CREATE OR REPLACE FUNCTION public.record_system_job_heartbeat(
  p_job_name TEXT,
  p_ok BOOLEAN,
  p_started_at TIMESTAMPTZ,
  p_duration_ms INT,
  p_error TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.system_job_heartbeats AS t (
    job_name, last_started_at, last_finished_at, last_success_at, last_failure_at,
    last_status, last_error, last_duration_ms, consecutive_failures, total_runs,
    total_failures, updated_at
  )
  VALUES (
    p_job_name, p_started_at, now(),
    CASE WHEN p_ok THEN now() END,
    CASE WHEN p_ok THEN NULL ELSE now() END,
    CASE WHEN p_ok THEN 'ok' ELSE 'error' END,
    CASE WHEN p_ok THEN NULL ELSE left(p_error, 500) END,
    p_duration_ms,
    CASE WHEN p_ok THEN 0 ELSE 1 END,
    1,
    CASE WHEN p_ok THEN 0 ELSE 1 END,
    now()
  )
  ON CONFLICT (job_name) DO UPDATE SET
    last_started_at      = EXCLUDED.last_started_at,
    last_finished_at     = now(),
    last_success_at      = CASE WHEN p_ok THEN now() ELSE t.last_success_at END,
    last_failure_at      = CASE WHEN p_ok THEN t.last_failure_at ELSE now() END,
    last_status          = EXCLUDED.last_status,
    last_error           = EXCLUDED.last_error,
    last_duration_ms     = EXCLUDED.last_duration_ms,
    consecutive_failures = CASE WHEN p_ok THEN 0 ELSE t.consecutive_failures + 1 END,
    total_runs           = t.total_runs + 1,
    total_failures       = t.total_failures + CASE WHEN p_ok THEN 0 ELSE 1 END,
    updated_at           = now();
$$;

REVOKE ALL ON FUNCTION public.record_system_job_heartbeat(TEXT, BOOLEAN, TIMESTAMPTZ, INT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_system_job_heartbeat(TEXT, BOOLEAN, TIMESTAMPTZ, INT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_system_health_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_has_cron BOOLEAN := EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');
  v_has_net BOOLEAN := EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net');
  v_cron_jobs JSONB := NULL;
  v_vault_names JSONB := NULL;
  v_result JSONB;
BEGIN
  IF v_has_cron THEN
    BEGIN
      EXECUTE $q$
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'jobname', jobname, 'schedule', schedule, 'active', active, 'command', command
        ) ORDER BY jobname), '[]'::jsonb)
        FROM cron.job
      $q$ INTO v_cron_jobs;
    EXCEPTION WHEN OTHERS THEN
      v_cron_jobs := NULL;
    END;
  END IF;

  -- Secret names only, never values.
  BEGIN
    EXECUTE $q$ SELECT COALESCE(jsonb_agg(name ORDER BY name), '[]'::jsonb) FROM vault.secrets WHERE name IS NOT NULL $q$
      INTO v_vault_names;
  EXCEPTION WHEN OTHERS THEN
    v_vault_names := NULL;
  END;

  SELECT jsonb_build_object(
    'extensions', jsonb_build_object('pg_cron', v_has_cron, 'pg_net', v_has_net),
    'cron_jobs', v_cron_jobs,
    'vault_secret_names', v_vault_names,
    'db_size_bytes', pg_database_size(current_database()),
    'heartbeats', (SELECT COALESCE(jsonb_agg(to_jsonb(h)), '[]'::jsonb) FROM public.system_job_heartbeats h),
    'probes', (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM public.system_health_probe_results p),
    'platform_settings', (SELECT jsonb_build_object(
        'maintenance_mode', s.maintenance_mode,
        'signups_enabled', s.signups_enabled,
        'authenticated_rate_limit_enforce', s.authenticated_rate_limit_enforce
      ) FROM public.platform_settings s WHERE s.id = 1),
    'ai_settings', (SELECT jsonb_build_object(
        'enabled', g.enabled,
        'enforce_quotas', g.enforce_quotas,
        'voice_health_status', g.voice_receptionist_health_status,
        'voice_health_checked_at', g.voice_receptionist_health_checked_at,
        'voice_health_failure_code', g.voice_receptionist_health_failure_code
      ) FROM public.ai_platform_global_settings g WHERE g.id = 1),
    'meta', (SELECT jsonb_build_object(
        'total', count(*) FILTER (WHERE platform IN ('facebook', 'instagram')),
        'connected', count(*) FILTER (WHERE platform IN ('facebook', 'instagram') AND status = 'connected'),
        'error', count(*) FILTER (WHERE platform IN ('facebook', 'instagram') AND status = 'error'),
        'disconnected', count(*) FILTER (WHERE platform IN ('facebook', 'instagram') AND status = 'disconnected'),
        'token_expired', count(*) FILTER (WHERE platform IN ('facebook', 'instagram') AND status = 'connected'
          AND token_expires_at IS NOT NULL AND token_expires_at < now()),
        'token_expiring_7d', count(*) FILTER (WHERE platform IN ('facebook', 'instagram') AND status = 'connected'
          AND token_expires_at >= now() AND token_expires_at < now() + interval '7 days'),
        'webhook_unverified_24h', count(*) FILTER (WHERE platform IN ('facebook', 'instagram') AND status = 'connected'
          AND (webhook_last_verified_at IS NULL OR webhook_last_verified_at < now() - interval '24 hours'))
      ) FROM public.social_channel_connections),
    'calendar_feeds', (SELECT jsonb_build_object(
        'active', count(*),
        'failing', count(*) FILTER (WHERE consecutive_failures >= 4),
        'stale_6h', count(*) FILTER (WHERE last_success_at IS NULL OR last_success_at < now() - interval '6 hours')
      ) FROM public.property_calendar_feeds WHERE is_active),
    'push', (SELECT jsonb_build_object(
        'active', count(*) FILTER (WHERE disabled_at IS NULL),
        'disabled', count(*) FILTER (WHERE disabled_at IS NOT NULL),
        'failing', count(*) FILTER (WHERE disabled_at IS NULL AND failure_count >= 3)
      ) FROM public.push_subscriptions),
    'marketing_jobs', (SELECT jsonb_build_object(
        'created_24h', count(*),
        'failed_24h', count(*) FILTER (WHERE job_status = 'failed'),
        'stuck', count(*) FILTER (WHERE job_status IN ('pending', 'processing', 'finalizing')
          AND created_at < now() - interval '30 minutes')
      ) FROM public.marketing_generation_jobs WHERE created_at > now() - interval '24 hours'),
    'paymongo_last_event_at', (SELECT max(created_at) FROM public.processed_paymongo_events)
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_system_health_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_health_snapshot() TO service_role;

CREATE OR REPLACE FUNCTION public.get_system_health_capacity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_buckets JSONB := NULL;
BEGIN
  BEGIN
    EXECUTE $q$
      SELECT COALESCE(jsonb_agg(row_to_json(b) ORDER BY b.bytes DESC), '[]'::jsonb)
      FROM (
        SELECT bucket_id AS bucket, count(*)::bigint AS objects,
               COALESCE(sum((metadata->>'size')::bigint), 0)::bigint AS bytes
        FROM storage.objects
        GROUP BY bucket_id
      ) b
    $q$ INTO v_buckets;
  EXCEPTION WHEN OTHERS THEN
    v_buckets := NULL;
  END;

  RETURN jsonb_build_object(
    'db_size_bytes', pg_database_size(current_database()),
    'tables', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.bytes DESC), '[]'::jsonb)
      FROM (
        SELECT c.relname AS name,
               pg_total_relation_size(c.oid)::bigint AS bytes,
               GREATEST(c.reltuples, 0)::bigint AS approx_rows
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC
        LIMIT 10
      ) t
    ),
    'buckets', v_buckets
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_system_health_capacity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_health_capacity() TO service_role;
