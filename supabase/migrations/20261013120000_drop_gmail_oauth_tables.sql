-- Retired Connect Google / Gmail OAuth storage. Production GAF/pet approvals use Resend inbound.
-- GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY remains in use for Telegram bot token encryption.

DROP TRIGGER IF EXISTS update_gmail_mail_integration_updated_at ON public.gmail_mail_integration;

DROP TABLE IF EXISTS public.gmail_mail_oauth_state;
DROP TABLE IF EXISTS public.gmail_mail_integration;

ALTER TABLE public.parking_settings
  DROP COLUMN IF EXISTS gmail_connected;
