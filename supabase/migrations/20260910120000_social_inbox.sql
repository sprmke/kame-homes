-- Org-level social guest inbox: channel connections, conversations, messages, templates.

CREATE TABLE IF NOT EXISTS public.social_channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_account_id TEXT NOT NULL,
  display_name TEXT,
  profile_image_url TEXT,
  encrypted_access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  meta_page_id TEXT,
  meta_ig_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  webhook_subscribed_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_channel_connections_platform_check CHECK (
    platform IN ('facebook', 'instagram', 'tiktok', 'airbnb')
  ),
  CONSTRAINT social_channel_connections_status_check CHECK (
    status IN ('connected', 'disconnected', 'error', 'pending')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS social_channel_connections_org_platform_external_unique
  ON public.social_channel_connections (organization_id, platform, external_account_id);

CREATE INDEX IF NOT EXISTS idx_social_channel_connections_org_status
  ON public.social_channel_connections (organization_id, status);

CREATE TABLE IF NOT EXISTS public.social_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.social_channel_connections (id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  conversation_type TEXT NOT NULL DEFAULT 'dm',
  external_thread_id TEXT NOT NULL,
  external_participant_id TEXT,
  participant_name TEXT,
  participant_avatar_url TEXT,
  subject_preview TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_inbound_at TIMESTAMPTZ,
  unread_count INT NOT NULL DEFAULT 0,
  reply_status TEXT NOT NULL DEFAULT 'none',
  messaging_window_expires_at TIMESTAMPTZ,
  linked_post_id TEXT,
  linked_post_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_conversations_platform_check CHECK (
    platform IN ('facebook', 'instagram', 'tiktok', 'airbnb')
  ),
  CONSTRAINT social_conversations_type_check CHECK (
    conversation_type IN ('dm', 'comment')
  ),
  CONSTRAINT social_conversations_reply_status_check CHECK (
    reply_status IN ('pending', 'replied', 'none')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS social_conversations_org_platform_thread_unique
  ON public.social_conversations (organization_id, platform, external_thread_id);

CREATE INDEX IF NOT EXISTS idx_social_conversations_org_last_message
  ON public.social_conversations (organization_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_conversations_org_reply_status
  ON public.social_conversations (organization_id, reply_status);

CREATE INDEX IF NOT EXISTS idx_social_conversations_org_unread
  ON public.social_conversations (organization_id, unread_count)
  WHERE unread_count > 0;

CREATE TABLE IF NOT EXISTS public.social_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.social_conversations (id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  external_message_id TEXT NOT NULL,
  body_text TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_status TEXT,
  sent_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_messages_direction_check CHECK (
    direction IN ('inbound', 'outbound')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS social_messages_external_message_id_unique
  ON public.social_messages (external_message_id);

CREATE INDEX IF NOT EXISTS idx_social_messages_conversation_sent
  ON public.social_messages (conversation_id, sent_at ASC);

CREATE TABLE IF NOT EXISTS public.social_reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body_text TEXT NOT NULL,
  platform TEXT,
  conversation_type TEXT NOT NULL DEFAULT 'all',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_reply_templates_platform_check CHECK (
    platform IS NULL OR platform IN ('facebook', 'instagram', 'tiktok', 'airbnb')
  ),
  CONSTRAINT social_reply_templates_type_check CHECK (
    conversation_type IN ('dm', 'comment', 'all')
  )
);

CREATE INDEX IF NOT EXISTS idx_social_reply_templates_org
  ON public.social_reply_templates (organization_id, sort_order ASC);

CREATE TABLE IF NOT EXISTS public.social_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_event_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'meta',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_webhook_events_external_unique UNIQUE (external_event_id)
);

CREATE TABLE IF NOT EXISTS public.social_inbox_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  auto_reply_mode TEXT NOT NULL DEFAULT 'draft',
  ai_system_prompt TEXT,
  platform_toggles JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_inbox_settings_auto_reply_mode_check CHECK (
    auto_reply_mode IN ('draft', 'send')
  )
);

CREATE TABLE IF NOT EXISTS public.meta_inbox_oauth_state (
  state TEXT PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  return_origin TEXT NOT NULL,
  return_path TEXT NOT NULL DEFAULT '/inbox',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.social_channel_connections IS
  'Org-scoped OAuth connections to social platforms (Meta, future TikTok/Airbnb).';

DROP TRIGGER IF EXISTS update_social_channel_connections_updated_at ON public.social_channel_connections;
CREATE TRIGGER update_social_channel_connections_updated_at
  BEFORE UPDATE ON public.social_channel_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_conversations_updated_at ON public.social_conversations;
CREATE TRIGGER update_social_conversations_updated_at
  BEFORE UPDATE ON public.social_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_reply_templates_updated_at ON public.social_reply_templates;
CREATE TRIGGER update_social_reply_templates_updated_at
  BEFORE UPDATE ON public.social_reply_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_inbox_settings_updated_at ON public.social_inbox_settings;
CREATE TRIGGER update_social_inbox_settings_updated_at
  BEFORE UPDATE ON public.social_inbox_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS: edge functions use service_role; Realtime + direct reads for org members.
ALTER TABLE public.social_channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_reply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_inbox_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_inbox_oauth_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_access_org_inbox(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org_id AND o.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  );
$$;

CREATE POLICY social_channel_connections_select ON public.social_channel_connections
  FOR SELECT TO authenticated
  USING (public.user_can_access_org_inbox(organization_id));

CREATE POLICY social_conversations_select ON public.social_conversations
  FOR SELECT TO authenticated
  USING (public.user_can_access_org_inbox(organization_id));

CREATE POLICY social_messages_select ON public.social_messages
  FOR SELECT TO authenticated
  USING (public.user_can_access_org_inbox(organization_id));

CREATE POLICY social_reply_templates_select ON public.social_reply_templates
  FOR SELECT TO authenticated
  USING (public.user_can_access_org_inbox(organization_id));

CREATE POLICY social_inbox_settings_select ON public.social_inbox_settings
  FOR SELECT TO authenticated
  USING (public.user_can_access_org_inbox(organization_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.social_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_messages;
