-- AI chat mode grants (follow-up to 20261316126000_ai_chat_mode.sql).
-- New tables need explicit privileges in this project: edge functions write with the service
-- role; authenticated users only get what their own-row RLS policies allow; anon gets nothing.

GRANT ALL ON public.user_ui_preferences TO service_role;
GRANT ALL ON public.ai_dashboard_assistant_feedback TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.user_ui_preferences TO authenticated;
GRANT SELECT ON public.ai_dashboard_assistant_feedback TO authenticated;

REVOKE ALL ON public.user_ui_preferences FROM anon;
REVOKE ALL ON public.ai_dashboard_assistant_feedback FROM anon;
