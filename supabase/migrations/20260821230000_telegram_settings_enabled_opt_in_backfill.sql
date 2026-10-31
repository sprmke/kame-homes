-- Opt-in Telegram bots: existing rows were seeded with enabled = true; flip to false.
-- Operators re-enable per module after connecting credentials.

UPDATE public.telegram_marketing_settings SET enabled = FALSE;
UPDATE public.telegram_staff_settings SET enabled = FALSE;
UPDATE public.telegram_admin_settings SET enabled = FALSE;
UPDATE public.telegram_finance_settings SET enabled = FALSE;
UPDATE public.telegram_maintenance_settings SET enabled = FALSE;
