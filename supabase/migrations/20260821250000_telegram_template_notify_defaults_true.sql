-- Per-template notification toggles default to enabled (module master toggle stays opt-in).

ALTER TABLE public.telegram_marketing_settings
  ALTER COLUMN notify_on_new_booking SET DEFAULT TRUE,
  ALTER COLUMN notify_on_cancellation SET DEFAULT TRUE,
  ALTER COLUMN notify_on_daily_default SET DEFAULT TRUE,
  ALTER COLUMN notify_on_daily_urgency SET DEFAULT TRUE;

ALTER TABLE public.telegram_staff_settings
  ALTER COLUMN notify_on_same_day_checkin SET DEFAULT TRUE,
  ALTER COLUMN notify_on_daily_summary SET DEFAULT TRUE,
  ALTER COLUMN notify_on_daily_summary_no_bookings SET DEFAULT TRUE;

ALTER TABLE public.telegram_finance_settings
  ALTER COLUMN notify_on_default_reminder SET DEFAULT TRUE;

ALTER TABLE public.telegram_maintenance_settings
  ALTER COLUMN notify_on_default_reminder SET DEFAULT TRUE;

UPDATE public.telegram_marketing_settings
SET
  notify_on_new_booking = TRUE,
  notify_on_cancellation = TRUE,
  notify_on_daily_default = TRUE,
  notify_on_daily_urgency = TRUE;

UPDATE public.telegram_staff_settings
SET
  notify_on_same_day_checkin = TRUE,
  notify_on_daily_summary = TRUE,
  notify_on_daily_summary_no_bookings = TRUE;

UPDATE public.telegram_finance_settings
SET notify_on_default_reminder = TRUE;

UPDATE public.telegram_maintenance_settings
SET notify_on_default_reminder = TRUE;
