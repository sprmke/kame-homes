-- Guest thumbs on AI web-chat replies. Service role writes via guest-web-chat-feedback.
-- activity-log: N/A — private quality signal, no org/property/parking state change.

CREATE TABLE IF NOT EXISTS public.guest_chat_ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL
    REFERENCES public.social_conversations (id) ON DELETE CASCADE,
  message_id UUID NOT NULL
    REFERENCES public.social_messages (id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL
    CONSTRAINT guest_chat_ai_feedback_rating_check CHECK (rating IN (-1, 1)),
  reason TEXT
    CONSTRAINT guest_chat_ai_feedback_reason_length CHECK (char_length(reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT guest_chat_ai_feedback_one_per_user UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_guest_chat_ai_feedback_created_at
  ON public.guest_chat_ai_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guest_chat_ai_feedback_conversation_id
  ON public.guest_chat_ai_feedback (conversation_id);

ALTER TABLE public.guest_chat_ai_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guest_chat_ai_feedback_select_own
  ON public.guest_chat_ai_feedback;
CREATE POLICY guest_chat_ai_feedback_select_own
  ON public.guest_chat_ai_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT ALL ON public.guest_chat_ai_feedback TO service_role;
GRANT SELECT ON public.guest_chat_ai_feedback TO authenticated;
REVOKE ALL ON public.guest_chat_ai_feedback FROM anon;
