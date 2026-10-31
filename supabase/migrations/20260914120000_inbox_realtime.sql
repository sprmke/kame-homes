-- Realtime filters on organization_id require REPLICA IDENTITY FULL.

ALTER TABLE public.social_messages REPLICA IDENTITY FULL;
ALTER TABLE public.social_conversations REPLICA IDENTITY FULL;
