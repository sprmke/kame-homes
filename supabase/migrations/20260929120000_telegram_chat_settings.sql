-- Guest Chat Telegram notifications (inbound web messages → host Telegram group).

CREATE SEQUENCE IF NOT EXISTS telegram_chat_settings_id_seq;

CREATE TABLE IF NOT EXISTS public.telegram_chat_settings (
  id INTEGER PRIMARY KEY DEFAULT nextval('telegram_chat_settings_id_seq'),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  notify_on_new_message BOOLEAN NOT NULL DEFAULT TRUE,
  new_message_template TEXT NOT NULL,
  bot_token_encrypted TEXT,
  chat_id_encrypted TEXT,
  CONSTRAINT telegram_chat_settings_property_id_unique UNIQUE (property_id)
);

ALTER TABLE public.telegram_chat_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.telegram_chat_settings IS
  'Per-property Telegram alerts for inbound guest web chat messages.';

COMMENT ON COLUMN public.telegram_chat_settings.new_message_template IS
  'Telegram message body for each inbound guest chat message. Placeholders: guest_name, property_name, chat_source, chat_content, attachment_summary, attachment_line, conversation_link, check_in_date, check_out_date, sent_at.';

COMMENT ON COLUMN public.telegram_chat_settings.notify_on_new_message IS
  'When true (and enabled), send Telegram on every inbound guest web chat message.';

COMMENT ON COLUMN public.telegram_chat_settings.bot_token_encrypted IS
  'AES-256-GCM encrypted Telegram bot token (property-scoped).';

COMMENT ON COLUMN public.telegram_chat_settings.chat_id_encrypted IS
  'AES-256-GCM encrypted Telegram chat id (property-scoped).';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_chat_settings TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.telegram_chat_settings_id_seq TO service_role;
