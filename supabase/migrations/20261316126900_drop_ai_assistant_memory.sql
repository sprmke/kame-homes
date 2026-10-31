-- Drop standing assistant memory (preferences + org house style).
-- Those rows were free-text notes injected into the prompt, not product settings.
-- Conversation context inside a thread is unchanged.

DROP TABLE IF EXISTS public.ai_dashboard_assistant_memories;
