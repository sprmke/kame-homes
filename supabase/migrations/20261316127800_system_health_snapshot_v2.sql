-- System health snapshot v2 (`/admin/health`).
-- Plan: docs/workflow/in-progress/super-admin-system-health.md
--
-- Adds to get_system_health_snapshot():
--   meta.webhook_failing   : connected pages whose last webhook verification failed
--   meta_items             : up to 5 broken / expiring Meta connections with org
--   calendar_items         : up to 5 failing iCal feeds with property + last error
--   telegram               : enabled bots across all channel tables, missing creds + items
--   ai_providers           : per-provider calls / errors / rate_limited / auth in 24h
--                            (ai_platform_usage_events, BRIN on created_at)
--   email                  : bounces / complaints (7d), inbound approval results (7d)
-- Still small tables, partial counters and LIMIT 5 lists only; no third-party calls.

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
  v_telegram JSONB;
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

  -- Enabled Telegram bots across every channel table; missing creds means alerts never send.
  WITH bots AS (
    SELECT 'Admin alerts' AS channel, property_id, parking_id, bot_token_encrypted, chat_id_encrypted FROM public.telegram_admin_settings WHERE enabled
    UNION ALL SELECT 'Guest chat', property_id, parking_id, bot_token_encrypted, chat_id_encrypted FROM public.telegram_chat_settings WHERE enabled
    UNION ALL SELECT 'Marketing', property_id, parking_id, bot_token_encrypted, chat_id_encrypted FROM public.telegram_marketing_settings WHERE enabled
    UNION ALL SELECT 'Staff', property_id, parking_id, bot_token_encrypted, chat_id_encrypted FROM public.telegram_staff_settings WHERE enabled
    UNION ALL SELECT 'Finance', property_id, parking_id, bot_token_encrypted, chat_id_encrypted FROM public.telegram_finance_settings WHERE enabled
    UNION ALL SELECT 'Maintenance', property_id, parking_id, bot_token_encrypted, chat_id_encrypted FROM public.telegram_maintenance_settings WHERE enabled
    UNION ALL SELECT 'Parking', NULL::uuid, parking_id, bot_token_encrypted, chat_id_encrypted FROM public.telegram_parking_settings WHERE enabled
  ), missing AS (
    SELECT b.channel, COALESCE(p.name, pk.name) AS unit_name, o.name AS org_name, o.slug AS org_slug
    FROM bots b
    LEFT JOIN public.properties p ON p.id = b.property_id
    LEFT JOIN public.parkings pk ON pk.id = b.parking_id
    LEFT JOIN public.organizations o ON o.id = COALESCE(p.organization_id, pk.organization_id)
    WHERE b.bot_token_encrypted IS NULL OR b.chat_id_encrypted IS NULL
  )
  SELECT jsonb_build_object(
    'enabled', (SELECT count(*) FROM bots),
    'missing_creds', (SELECT count(*) FROM missing),
    'missing_items', (SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb) FROM (SELECT * FROM missing LIMIT 5) m)
  ) INTO v_telegram;

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
          AND (webhook_last_verified_at IS NULL OR webhook_last_verified_at < now() - interval '24 hours')),
        'webhook_failing', count(*) FILTER (WHERE platform IN ('facebook', 'instagram') AND status = 'connected'
          AND webhook_verify_attempts > 0)
      ) FROM public.social_channel_connections),
    'meta_items', (SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb) FROM (
        SELECT c.display_name, c.platform, o.name AS org_name, o.slug AS org_slug,
               CASE
                 WHEN c.status = 'error' THEN 'Error'
                 WHEN c.token_expires_at < now() THEN 'Token expired'
                 WHEN c.webhook_verify_attempts > 0 THEN 'Webhook failing'
                 ELSE 'Token expires soon'
               END AS reason
        FROM public.social_channel_connections c
        JOIN public.organizations o ON o.id = c.organization_id
        WHERE c.platform IN ('facebook', 'instagram')
          AND (c.status = 'error'
            OR (c.status = 'connected' AND (c.webhook_verify_attempts > 0
              OR c.token_expires_at < now() + interval '7 days')))
        ORDER BY (c.status = 'error') DESC, c.token_expires_at NULLS LAST
        LIMIT 5
      ) m),
    'calendar_feeds', (SELECT jsonb_build_object(
        'active', count(*),
        'failing', count(*) FILTER (WHERE consecutive_failures >= 4),
        'stale_6h', count(*) FILTER (WHERE last_success_at IS NULL OR last_success_at < now() - interval '6 hours')
      ) FROM public.property_calendar_feeds WHERE is_active),
    'calendar_items', (SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM (
        SELECT COALESCE(cf.label, cf.provider) AS feed, p.name AS property_name, o.name AS org_name,
               o.slug AS org_slug, cf.consecutive_failures, left(cf.last_error, 120) AS last_error
        FROM public.property_calendar_feeds cf
        JOIN public.properties p ON p.id = cf.property_id
        JOIN public.organizations o ON o.id = p.organization_id
        WHERE cf.is_active AND cf.consecutive_failures >= 4
        ORDER BY cf.consecutive_failures DESC
        LIMIT 5
      ) f),
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
    'telegram', v_telegram,
    'ai_providers', (SELECT COALESCE(jsonb_object_agg(provider, stats), '{}'::jsonb) FROM (
        SELECT provider, jsonb_build_object(
          'calls', count(*),
          'errors', count(*) FILTER (WHERE status = 'error'),
          'rate_limited', count(*) FILTER (WHERE error_code = 'rate_limited'),
          'auth', count(*) FILTER (WHERE error_code = 'auth'),
          'last_error_at', max(created_at) FILTER (WHERE status = 'error')
        ) AS stats
        FROM public.ai_platform_usage_events
        WHERE created_at > now() - interval '24 hours' AND provider IN ('gemini', 'groq')
        GROUP BY provider
      ) a),
    'email', jsonb_build_object(
        'bounced_7d', (SELECT count(*) FROM public.email_suppressions
          WHERE reason = 'bounced' AND suppressed_at > now() - interval '7 days'),
        'complained_7d', (SELECT count(*) FROM public.email_suppressions
          WHERE reason = 'complained' AND suppressed_at > now() - interval '7 days'),
        'inbound_7d', (SELECT count(*) FROM public.processed_emails
          WHERE processed_at > now() - interval '7 days'),
        'inbound_failed_7d', (SELECT count(*) FROM public.processed_emails
          WHERE status = 'failed' AND processed_at > now() - interval '7 days'),
        'inbound_last_at', (SELECT max(processed_at) FROM public.processed_emails)
      ),
    'paymongo_last_event_at', (SELECT max(created_at) FROM public.processed_paymongo_events)
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_system_health_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_health_snapshot() TO service_role;
