-- Catch-up for 20260629160000 on fresh resets: that migration runs before
-- app_settings / late telegram_* tables exist, so it skips them. Re-apply
-- idempotent DDL once all targets exist (after 20260818120000 maintenance).

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
      RAISE EXCEPTION 'ensure_property_scoped_integration_credentials: missing public.%', t;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      t,
      t || '_id_check'
    );

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

COMMENT ON COLUMN public.app_settings.google_calendar_id IS
  'Property Google Calendar ID. Falls back to GOOGLE_CALENDAR_ID env when NULL.';
COMMENT ON COLUMN public.app_settings.google_spreadsheet_id IS
  'Property Google Spreadsheet ID. Falls back to GOOGLE_SPREADSHEET_ID env when NULL.';

COMMENT ON COLUMN public.telegram_marketing_settings.bot_token_encrypted IS
  'AES-256-GCM encrypted Telegram bot token (property-scoped). Env TELEGRAM_BOT_TOKEN fallback.';
COMMENT ON COLUMN public.telegram_marketing_settings.chat_id_encrypted IS
  'AES-256-GCM encrypted Telegram chat id (property-scoped). Env TELEGRAM_CHAT_ID fallback.';

-- service_role grant deferred from 20260702190000 (table created in 20260818120000)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_items TO service_role;
