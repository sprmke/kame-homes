-- Chat UX Phases 2–4: read receipts, edit, reply threading, guest unread count.

ALTER TABLE public.social_conversations
  ADD COLUMN IF NOT EXISTS guest_last_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS host_last_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS guest_unread_count INT NOT NULL DEFAULT 0;

ALTER TABLE public.social_messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.social_messages (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_preview_text TEXT;

CREATE INDEX IF NOT EXISTS idx_social_messages_conversation_active
  ON public.social_messages (conversation_id, sent_at ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_social_conversations_web_guest_unread
  ON public.social_conversations (guest_user_id, guest_unread_count)
  WHERE platform = 'web' AND guest_unread_count > 0;

COMMENT ON COLUMN public.social_conversations.guest_unread_count IS
  'Unread host/AI outbound messages for the signed-in guest (web chat).';
COMMENT ON COLUMN public.social_conversations.guest_last_read_at IS
  'When the guest last opened the thread and marked host messages read.';
COMMENT ON COLUMN public.social_conversations.host_last_read_at IS
  'When an org operator last opened the thread and marked guest messages read.';
