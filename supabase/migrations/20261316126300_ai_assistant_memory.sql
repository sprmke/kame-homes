-- AI assistant memory (docs/workflow/in-progress/ai-chat-mode.md Phase 6).
--
-- kind = 'preference'  → one host's standing instruction for the assistant (user_id set).
-- kind = 'house_style' → org-wide tone / conventions every member's assistant follows
--                        (user_id null; managed by members with org.settings.aiAssistant:edit).
-- Written only by the dashboard-assistant-memory edge function and the Tier-1
-- `remember_preference` tool (service role). Injected into the assistant system prompt as data.

CREATE TABLE IF NOT EXISTS public.ai_dashboard_assistant_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CONSTRAINT ai_dashboard_assistant_memories_kind_check CHECK (kind IN ('preference', 'house_style')),
  content TEXT NOT NULL
    CONSTRAINT ai_dashboard_assistant_memories_content_length
      CHECK (char_length(content) BETWEEN 1 AND 300),
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_dashboard_assistant_memories_owner_check
    CHECK ((kind = 'preference') = (user_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_memories_org_user
  ON public.ai_dashboard_assistant_memories (organization_id, user_id, created_at);

ALTER TABLE public.ai_dashboard_assistant_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_dashboard_assistant_memories_select_own
  ON public.ai_dashboard_assistant_memories;
CREATE POLICY ai_dashboard_assistant_memories_select_own
  ON public.ai_dashboard_assistant_memories
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT ALL ON public.ai_dashboard_assistant_memories TO service_role;
GRANT SELECT ON public.ai_dashboard_assistant_memories TO authenticated;
REVOKE ALL ON public.ai_dashboard_assistant_memories FROM anon;
