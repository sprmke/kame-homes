-- Shared Telegram bot token per property / parking (Notifications → global card).
-- Modules still store their own token; global value pre-fills empty module fields.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS telegram_global_bot_token_encrypted TEXT;

COMMENT ON COLUMN public.app_settings.telegram_global_bot_token_encrypted IS
  'Optional shared Telegram bot token (AES-256-GCM). Pre-fills notification modules when module token is unset.';

ALTER TABLE public.parking_settings
  ADD COLUMN IF NOT EXISTS telegram_global_bot_token_encrypted TEXT;

COMMENT ON COLUMN public.parking_settings.telegram_global_bot_token_encrypted IS
  'Optional shared Telegram bot token for parking notification modules.';
