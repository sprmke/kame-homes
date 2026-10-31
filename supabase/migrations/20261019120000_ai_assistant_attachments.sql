-- AI dashboard assistant: host-uploaded chat attachments (receipts, GAF PDFs, photos).
-- Private bucket — service role only. Metadata lives on ai_dashboard_assistant_messages.attachments.

ALTER TABLE public.ai_dashboard_assistant_messages
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.ai_dashboard_assistant_messages.attachments IS
  'Host-uploaded files for this turn: [{ name, mimeType, size, path }]. Bytes live in Storage, not this column.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-assistant-attachments',
  'ai-assistant-attachments',
  FALSE,
  4194304,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Service role full access to ai-assistant-attachments" ON storage.objects;

CREATE POLICY "Service role full access to ai-assistant-attachments"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'ai-assistant-attachments')
  WITH CHECK (bucket_id = 'ai-assistant-attachments');
