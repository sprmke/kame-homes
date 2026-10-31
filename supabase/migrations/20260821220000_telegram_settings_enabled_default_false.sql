-- New telegram settings rows default to disabled (opt-in notifications).

ALTER TABLE public.telegram_marketing_settings
  ALTER COLUMN enabled SET DEFAULT FALSE;

ALTER TABLE public.telegram_staff_settings
  ALTER COLUMN enabled SET DEFAULT FALSE;

ALTER TABLE public.telegram_admin_settings
  ALTER COLUMN enabled SET DEFAULT FALSE;

ALTER TABLE public.telegram_finance_settings
  ALTER COLUMN enabled SET DEFAULT FALSE;

ALTER TABLE public.telegram_maintenance_settings
  ALTER COLUMN enabled SET DEFAULT FALSE;
