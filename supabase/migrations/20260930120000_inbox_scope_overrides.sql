-- Property/parking Meta inbox overrides + parking_id on web conversations.

-- ── social_channel_connections scope ─────────────────────────────────────────

ALTER TABLE public.social_channel_connections
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parking_id UUID REFERENCES public.parkings (id) ON DELETE CASCADE;

ALTER TABLE public.social_channel_connections
  DROP CONSTRAINT IF EXISTS social_channel_connections_scope_check;

ALTER TABLE public.social_channel_connections
  ADD CONSTRAINT social_channel_connections_scope_check
  CHECK (NOT (property_id IS NOT NULL AND parking_id IS NOT NULL));

COMMENT ON COLUMN public.social_channel_connections.property_id IS
  'When set, this Meta connection is a property-level override. NULL = org default (or parking override).';

COMMENT ON COLUMN public.social_channel_connections.parking_id IS
  'When set, this Meta connection is a parking-level override. NULL = org default (or property override).';

-- At most one connected org-default Facebook Page per org
CREATE UNIQUE INDEX IF NOT EXISTS social_channel_connections_org_default_facebook_connected
  ON public.social_channel_connections (organization_id)
  WHERE platform = 'facebook'
    AND property_id IS NULL
    AND parking_id IS NULL
    AND status = 'connected';

-- At most one connected Facebook override per property
CREATE UNIQUE INDEX IF NOT EXISTS social_channel_connections_property_facebook_connected
  ON public.social_channel_connections (organization_id, property_id)
  WHERE platform = 'facebook'
    AND property_id IS NOT NULL
    AND status = 'connected';

-- At most one connected Facebook override per parking
CREATE UNIQUE INDEX IF NOT EXISTS social_channel_connections_parking_facebook_connected
  ON public.social_channel_connections (organization_id, parking_id)
  WHERE platform = 'facebook'
    AND parking_id IS NOT NULL
    AND status = 'connected';

CREATE INDEX IF NOT EXISTS idx_social_channel_connections_property
  ON public.social_channel_connections (property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_channel_connections_parking
  ON public.social_channel_connections (parking_id)
  WHERE parking_id IS NOT NULL;

-- One live Facebook Page row globally (webhook .maybeSingle)
CREATE UNIQUE INDEX IF NOT EXISTS social_channel_connections_meta_page_connected_unique
  ON public.social_channel_connections (meta_page_id)
  WHERE platform = 'facebook'
    AND status = 'connected'
    AND meta_page_id IS NOT NULL;

-- ── meta_inbox_oauth_state scope ─────────────────────────────────────────────

ALTER TABLE public.meta_inbox_oauth_state
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parking_id UUID REFERENCES public.parkings (id) ON DELETE CASCADE;

ALTER TABLE public.meta_inbox_oauth_state
  DROP CONSTRAINT IF EXISTS meta_inbox_oauth_state_scope_check;

ALTER TABLE public.meta_inbox_oauth_state
  ADD CONSTRAINT meta_inbox_oauth_state_scope_check
  CHECK (NOT (property_id IS NOT NULL AND parking_id IS NOT NULL));

COMMENT ON COLUMN public.meta_inbox_oauth_state.property_id IS
  'When set, OAuth completes as a property Meta override.';

COMMENT ON COLUMN public.meta_inbox_oauth_state.parking_id IS
  'When set, OAuth completes as a parking Meta override.';

-- ── social_conversations parking scope (future parking web chat) ─────────────

ALTER TABLE public.social_conversations
  ADD COLUMN IF NOT EXISTS parking_id UUID REFERENCES public.parkings (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.social_conversations.parking_id IS
  'Parking scope for platform=web guest chat threads (future). Meta threads leave this null.';

CREATE UNIQUE INDEX IF NOT EXISTS social_conversations_web_parking_guest_unique
  ON public.social_conversations (parking_id, guest_user_id)
  WHERE platform = 'web' AND guest_user_id IS NOT NULL AND parking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_conversations_parking_web
  ON public.social_conversations (parking_id)
  WHERE platform = 'web' AND parking_id IS NOT NULL;
