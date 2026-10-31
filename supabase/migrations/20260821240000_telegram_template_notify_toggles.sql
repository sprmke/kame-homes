-- Per-template opt-in toggles for Telegram notification templates.

ALTER TABLE public.telegram_marketing_settings
  ADD COLUMN IF NOT EXISTS notify_on_daily_default BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_on_daily_urgency BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.telegram_staff_settings
  ADD COLUMN IF NOT EXISTS notify_on_daily_summary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_on_daily_summary_no_bookings BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.telegram_finance_settings
  ADD COLUMN IF NOT EXISTS notify_on_default_reminder BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.telegram_maintenance_settings
  ADD COLUMN IF NOT EXISTS notify_on_default_reminder BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.telegram_marketing_settings.notify_on_daily_default IS
  'When true, daily cron sends daily_default_template at configured Manila times.';
COMMENT ON COLUMN public.telegram_marketing_settings.notify_on_daily_urgency IS
  'When true, daily cron also sends daily_urgency_template when calendar is within urgency_days_threshold.';
COMMENT ON COLUMN public.telegram_staff_settings.notify_on_daily_summary IS
  'When true, daily cron sends daily_summary_template when there are check-ins today.';
COMMENT ON COLUMN public.telegram_staff_settings.notify_on_daily_summary_no_bookings IS
  'When true, daily cron sends daily_summary_no_bookings_template when there are no check-ins today.';
COMMENT ON COLUMN public.telegram_finance_settings.notify_on_default_reminder IS
  'When true, finance cron sends default_reminder_template for eligible line items.';
COMMENT ON COLUMN public.telegram_maintenance_settings.notify_on_default_reminder IS
  'When true, maintenance cron sends default_reminder_template for eligible items.';
