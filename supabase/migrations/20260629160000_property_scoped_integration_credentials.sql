-- Phase 1f: per-property integration credentials + multi-row settings tables.
-- Drops singleton id=1 CHECK so each property can have its own settings row.
-- Telegram bot token + chat id stored encrypted (GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY).
-- Google Calendar / Sheets IDs per property on app_settings (service account stays env).
--
-- Fresh-reset note: several target tables are created AFTER this version
-- (app_settings 20260701, telegram_admin 20260702, finance 20260710, maintenance 20260818).
-- Only mutate tables that already exist; catch-up is
-- 20260818120100_ensure_property_scoped_integration_credentials.sql.

-- ─── Allow multiple settings rows (drop id = 1 CHECK) ───────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'app_settings',
    'telegram_marketing_settings',
    'telegram_staff_settings',
    'telegram_admin_settings',
    'telegram_finance_settings',
    'telegram_maintenance_settings'
  ]) LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      t,
      t || '_id_check'
    );
  END LOOP;
END $$;

-- Sequences + defaults + Google IDs / Telegram encrypted columns (existing tables only)

DO $$
DECLARE
  t text;
  seq text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_settings',
    'telegram_marketing_settings',
    'telegram_staff_settings',
    'telegram_admin_settings',
    'telegram_finance_settings',
    'telegram_maintenance_settings'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    seq := t || '_id_seq';
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I', seq);
    EXECUTE format(
      'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(id) FROM public.%I), 0), 1))',
      seq,
      t
    );
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT nextval(%L)',
      t,
      'public.' || seq
    );

    IF t = 'app_settings' THEN
      ALTER TABLE public.app_settings
        ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
        ADD COLUMN IF NOT EXISTS google_spreadsheet_id TEXT;
    ELSE
      EXECUTE format(
        'ALTER TABLE public.%I
           ADD COLUMN IF NOT EXISTS bot_token_encrypted TEXT,
           ADD COLUMN IF NOT EXISTS chat_id_encrypted TEXT',
        t
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN public.telegram_marketing_settings.bot_token_encrypted IS
  'AES-256-GCM encrypted Telegram bot token (property-scoped). Env TELEGRAM_BOT_TOKEN fallback.';
COMMENT ON COLUMN public.telegram_marketing_settings.chat_id_encrypted IS
  'AES-256-GCM encrypted Telegram chat id (property-scoped). Env TELEGRAM_CHAT_ID fallback.';

DO $$
BEGIN
  IF to_regclass('public.app_settings') IS NOT NULL THEN
    COMMENT ON COLUMN public.app_settings.google_calendar_id IS
      'Property Google Calendar ID. Falls back to GOOGLE_CALENDAR_ID env when NULL.';
    COMMENT ON COLUMN public.app_settings.google_spreadsheet_id IS
      'Property Google Spreadsheet ID. Falls back to GOOGLE_SPREADSHEET_ID env when NULL.';
  END IF;
END $$;

-- ─── Multi-property cron dispatch (5-min tick; handlers filter by Manila schedule) ─

CREATE OR REPLACE FUNCTION public.ensure_telegram_multi_property_cron_dispatch()
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
         || '/functions/v1/telegram-marketing-cron',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'telegram_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Telegram-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'telegram_cron_secret')
      )
      ELSE jsonb_build_object('Content-Type', 'application/json')
    END
  ),
  body := '{}'::jsonb
);
$BODY$;
  staff_cmd text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/telegram-staff-cron',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'telegram_staff_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Telegram-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'telegram_staff_cron_secret')
      )
      ELSE jsonb_build_object('Content-Type', 'application/json')
    END
  ),
  body := '{}'::jsonb
);
$BODY$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pg_cron extension not installed');
  END IF;

  FOR r IN
    SELECT jobid FROM cron.job
    WHERE jobname LIKE 'telegram-marketing-daily-slot-%'
       OR jobname = 'telegram-marketing-daily-manila'
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-marketing-property-dispatch') THEN
    PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'telegram-marketing-property-dispatch' LIMIT 1));
  END IF;
  PERFORM cron.schedule('telegram-marketing-property-dispatch', cron_expr, v_cmd_body);

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-staff-property-dispatch') THEN
    PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'telegram-staff-property-dispatch' LIMIT 1));
  END IF;
  PERFORM cron.schedule('telegram-staff-property-dispatch', cron_expr, staff_cmd);

  RETURN jsonb_build_object(
    'ok', true,
    'marketingJob', 'telegram-marketing-property-dispatch',
    'staffJob', 'telegram-staff-property-dispatch',
    'cronExpr', cron_expr
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'ensure_telegram_multi_property_cron_dispatch failed: ' || SQLERRM
    );
END;
$fn$;

COMMENT ON FUNCTION public.ensure_telegram_multi_property_cron_dispatch() IS
  'Replaces per-slot marketing/staff pg_cron jobs with 5-min dispatchers. Edge handlers match each property Manila schedule.';

REVOKE ALL ON FUNCTION public.ensure_telegram_multi_property_cron_dispatch() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_telegram_multi_property_cron_dispatch() TO service_role;
