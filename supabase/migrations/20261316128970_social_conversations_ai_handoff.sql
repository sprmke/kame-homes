-- Guest AI handoff: when the AI receptionist passes a thread to the host team it records why, and
-- stops auto-replying on that thread until a human replies (the reply clears the flag).
ALTER TABLE public.social_conversations
  ADD COLUMN IF NOT EXISTS ai_handoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_handoff_reason text;

COMMENT ON COLUMN public.social_conversations.ai_handoff_at IS
  'Set when the AI receptionist asked for the host; cleared when a human replies.';
COMMENT ON COLUMN public.social_conversations.ai_handoff_reason IS
  'Short, sanitized reason the AI gave for the handoff (shown to the host).';

CREATE INDEX IF NOT EXISTS idx_social_conversations_ai_handoff
  ON public.social_conversations (organization_id, ai_handoff_at DESC)
  WHERE ai_handoff_at IS NOT NULL;
