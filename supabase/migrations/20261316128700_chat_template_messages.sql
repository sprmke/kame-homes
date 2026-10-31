-- Chat template messages: a web chat reply can carry a rendered property
-- template (standard or custom) instead of plain text. The snapshot keeps the
-- exact HTML that was sent, so later template edits never rewrite history.

ALTER TABLE public.social_messages
  ADD COLUMN IF NOT EXISTS message_kind TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS template_snapshot JSONB;

ALTER TABLE public.social_messages
  DROP CONSTRAINT IF EXISTS social_messages_message_kind_check;

ALTER TABLE public.social_messages
  ADD CONSTRAINT social_messages_message_kind_check CHECK (
    message_kind IN ('text', 'template')
  );

COMMENT ON COLUMN public.social_messages.message_kind IS
  'text for normal replies, template when the reply carries a property template snapshot.';
COMMENT ON COLUMN public.social_messages.template_snapshot IS
  'Rendered property template snapshot: templateKey, name, category, html, sectionImageUrl, propertyId.';
