-- Catch-up for 20260719153000 (ran before social inbox tables existed on fresh reset).

ALTER TABLE public.social_channel_connections
  DROP CONSTRAINT IF EXISTS social_channel_connections_platform_check;

ALTER TABLE public.social_channel_connections
  ADD CONSTRAINT social_channel_connections_platform_check CHECK (
    platform IN ('facebook', 'instagram', 'tiktok', 'airbnb', 'web')
  );

ALTER TABLE public.social_conversations
  DROP CONSTRAINT IF EXISTS social_conversations_platform_check;

ALTER TABLE public.social_conversations
  ADD CONSTRAINT social_conversations_platform_check CHECK (
    platform IN ('facebook', 'instagram', 'tiktok', 'airbnb', 'web')
  );

ALTER TABLE public.social_reply_templates
  DROP CONSTRAINT IF EXISTS social_reply_templates_platform_check;

ALTER TABLE public.social_reply_templates
  ADD CONSTRAINT social_reply_templates_platform_check CHECK (
    platform IS NULL OR platform IN ('facebook', 'instagram', 'tiktok', 'airbnb', 'web')
  );

ALTER TABLE public.social_conversations
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS guest_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inquiry_check_in DATE,
  ADD COLUMN IF NOT EXISTS inquiry_check_out DATE;

CREATE UNIQUE INDEX IF NOT EXISTS social_conversations_web_property_guest_unique
  ON public.social_conversations (property_id, guest_user_id)
  WHERE platform = 'web' AND guest_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_conversations_org_platform_last_message
  ON public.social_conversations (organization_id, platform, last_message_at DESC);

COMMENT ON COLUMN public.social_conversations.property_id IS
  'Property scope for platform=web guest chat threads.';
COMMENT ON COLUMN public.social_conversations.guest_user_id IS
  'Authenticated guest user for platform=web threads.';
COMMENT ON COLUMN public.social_conversations.inquiry_check_in IS
  'Guest-selected check-in date when opening web chat from property page.';
COMMENT ON COLUMN public.social_conversations.inquiry_check_out IS
  'Guest-selected check-out date when opening web chat from property page.';

CREATE OR REPLACE FUNCTION public.user_can_access_guest_web_conversation(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.social_conversations sc
    WHERE sc.id = p_conversation_id
      AND sc.platform = 'web'
      AND sc.guest_user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.user_can_access_guest_web_conversation(UUID) IS
  'Guest Realtime read access for their own web chat thread.';

DROP POLICY IF EXISTS social_conversations_select ON public.social_conversations;
CREATE POLICY social_conversations_select ON public.social_conversations
  FOR SELECT TO authenticated
  USING (
    public.user_can_access_org_inbox(organization_id)
    OR (platform = 'web' AND guest_user_id = auth.uid())
  );

DROP POLICY IF EXISTS social_messages_select ON public.social_messages;
CREATE POLICY social_messages_select ON public.social_messages
  FOR SELECT TO authenticated
  USING (
    public.user_can_access_org_inbox(organization_id)
    OR public.user_can_access_guest_web_conversation(conversation_id)
  );
