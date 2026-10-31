-- Audit Meta HUMAN_AGENT tagged replies in the social inbox.

ALTER TABLE public.social_messages
  ADD COLUMN IF NOT EXISTS message_tag TEXT;

ALTER TABLE public.social_messages
  DROP CONSTRAINT IF EXISTS social_messages_message_tag_check;

ALTER TABLE public.social_messages
  ADD CONSTRAINT social_messages_message_tag_check
  CHECK (message_tag IS NULL OR message_tag IN ('human_agent'));
