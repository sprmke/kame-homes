-- AI chat mode (docs/workflow/in-progress/ai-chat-mode.md)
--
-- 1. user_ui_preferences: per-user dashboard mode ('advanced' | 'ai'). Written only by the
--    user-ui-preferences edge function (service role); own-row RLS covers direct reads.
-- 2. ai_dashboard_assistant_global_settings.ai_mode_enabled: platform switch for the full-page
--    AI mode. Off by default so the toggle stays hidden until a super admin turns it on.
-- 3. Conversation management: pinned_at / archived_at on conversations.
-- 4. ai_dashboard_assistant_feedback: thumbs up/down per assistant message (one row per user
--    and message), surfaced on the super-admin AI usage tab.

-- 1. user_ui_preferences ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_ui_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  dashboard_mode TEXT NOT NULL DEFAULT 'advanced'
    CONSTRAINT user_ui_preferences_dashboard_mode_check CHECK (dashboard_mode IN ('advanced', 'ai')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_ui_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_ui_preferences_select_own ON public.user_ui_preferences;
CREATE POLICY user_ui_preferences_select_own
  ON public.user_ui_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_ui_preferences_insert_own ON public.user_ui_preferences;
CREATE POLICY user_ui_preferences_insert_own
  ON public.user_ui_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_ui_preferences_update_own ON public.user_ui_preferences;
CREATE POLICY user_ui_preferences_update_own
  ON public.user_ui_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Platform switch for AI mode --------------------------------------------------------------

ALTER TABLE public.ai_dashboard_assistant_global_settings
  ADD COLUMN IF NOT EXISTS ai_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Conversation management ------------------------------------------------------------------

ALTER TABLE public.ai_dashboard_assistant_conversations
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- History list: active (not archived) rows for one user in one org, pinned first, newest first.
CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_conversations_history
  ON public.ai_dashboard_assistant_conversations (
    organization_id,
    user_id,
    pinned_at DESC NULLS LAST,
    last_message_at DESC
  )
  WHERE archived_at IS NULL;

-- 4. Message feedback -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_dashboard_assistant_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL
    REFERENCES public.ai_dashboard_assistant_conversations (id) ON DELETE CASCADE,
  message_id UUID NOT NULL
    REFERENCES public.ai_dashboard_assistant_messages (id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL
    CONSTRAINT ai_dashboard_assistant_feedback_rating_check CHECK (rating IN (-1, 1)),
  reason TEXT
    CONSTRAINT ai_dashboard_assistant_feedback_reason_length CHECK (char_length(reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_dashboard_assistant_feedback_one_per_user UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_feedback_created_at
  ON public.ai_dashboard_assistant_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_feedback_conversation_id
  ON public.ai_dashboard_assistant_feedback (conversation_id);

ALTER TABLE public.ai_dashboard_assistant_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_dashboard_assistant_feedback_select_own
  ON public.ai_dashboard_assistant_feedback;
CREATE POLICY ai_dashboard_assistant_feedback_select_own
  ON public.ai_dashboard_assistant_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
