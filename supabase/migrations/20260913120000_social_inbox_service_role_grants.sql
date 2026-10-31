-- social_inbox tables had RLS enabled but no role grants — edge functions (service_role) failed with
-- "permission denied for table social_channel_connections".

GRANT ALL ON public.social_channel_connections TO service_role;
GRANT ALL ON public.social_conversations TO service_role;
GRANT ALL ON public.social_messages TO service_role;
GRANT ALL ON public.social_reply_templates TO service_role;
GRANT ALL ON public.social_inbox_settings TO service_role;
GRANT ALL ON public.social_webhook_events TO service_role;
GRANT ALL ON public.meta_inbox_oauth_state TO service_role;

-- Realtime client reads (RLS policies enforce org access)
GRANT SELECT ON public.social_channel_connections TO authenticated;
GRANT SELECT ON public.social_conversations TO authenticated;
GRANT SELECT ON public.social_messages TO authenticated;
GRANT SELECT ON public.social_reply_templates TO authenticated;
GRANT SELECT ON public.social_inbox_settings TO authenticated;
