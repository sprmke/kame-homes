-- AI Dashboard Assistant — Phase 4 item 1: session-scoped working memory.
-- docs/workflow/in-progress/agentic-ai-assistants.md, Phase 4 item 1.
-- Compact per-turn references (booking/thread/item ids + a short digest) that the turn's tool
-- calls touched, replayed on later turns as "Known from earlier in this chat" facts so the agent
-- doesn't re-ask or re-search for an id it already has. Session-scoped only (no standing
-- cross-conversation memory), consistent with this plan's removal of standing memory.

ALTER TABLE public.ai_dashboard_assistant_messages
  ADD COLUMN IF NOT EXISTS entity_refs JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.ai_dashboard_assistant_messages.entity_refs IS
  'Entity references (kind, id, label, digest) this turn''s tool calls touched — replayed as working-memory facts on later turns in the same conversation. See _shared/dashboardAssistantEntityRefs.ts.';
