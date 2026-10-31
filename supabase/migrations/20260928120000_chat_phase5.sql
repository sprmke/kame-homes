-- Phase 5 chat UX: guest attachments bucket + offline reply email dedupe.

ALTER TABLE public.social_messages
  ADD COLUMN IF NOT EXISTS guest_reply_email_sent_at TIMESTAMPTZ;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'guest-chat-attachments',
  'guest-chat-attachments',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMENT ON COLUMN public.social_messages.guest_reply_email_sent_at IS
  'When an offline guest reply notification email was sent for this outbound web message.';
