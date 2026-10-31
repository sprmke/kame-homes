-- AI Dashboard Assistant — data model foundation (Phase 2 of docs/workflow/planned/ai-dashboard-assistant.md).
-- Independent of ai_platform_* (Phase A hardening): own kill switch, own quota, own audit trail.
-- See docs/workflow/planned/ai-dashboard-assistant.md §4 for the full field-by-field rationale.

-- ─── Kill switches + quota config ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_dashboard_assistant_global_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_dashboard_assistant_global_settings_singleton CHECK (id = TRUE)
);

INSERT INTO public.ai_dashboard_assistant_global_settings (id, enabled)
VALUES (TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.ai_dashboard_assistant_global_settings IS
  'Singleton platform-wide kill switch for the AI dashboard assistant — independent of ai_platform_global_settings.';

CREATE TABLE IF NOT EXISTS public.ai_dashboard_assistant_org_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations (id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  disabled_property_ids UUID[] NOT NULL DEFAULT '{}',
  daily_message_limit INT NOT NULL DEFAULT 50,
  monthly_message_limit INT NOT NULL DEFAULT 1000,
  daily_write_action_limit INT NOT NULL DEFAULT 20,
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_dashboard_assistant_org_settings_daily_message_limit_check CHECK (daily_message_limit > 0),
  CONSTRAINT ai_dashboard_assistant_org_settings_monthly_message_limit_check CHECK (monthly_message_limit > 0),
  CONSTRAINT ai_dashboard_assistant_org_settings_daily_write_limit_check CHECK (daily_write_action_limit > 0)
);

COMMENT ON TABLE public.ai_dashboard_assistant_org_settings IS
  'Org-level opt-in (default disabled) + per-property opt-out list + message/write-action quotas.';

-- ─── Conversations + messages (private per user) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_dashboard_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties (id) ON DELETE SET NULL,
  title TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_conversations_org_user_last_message
  ON public.ai_dashboard_assistant_conversations (organization_id, user_id, last_message_at DESC);

COMMENT ON TABLE public.ai_dashboard_assistant_conversations IS
  'Private per-user chat threads with the AI dashboard assistant — never shared/team-visible.';

CREATE TABLE IF NOT EXISTS public.ai_dashboard_assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_dashboard_assistant_conversations (id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content_text TEXT,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_dashboard_assistant_messages_role_check CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_messages_conversation_created
  ON public.ai_dashboard_assistant_messages (conversation_id, created_at ASC);

COMMENT ON TABLE public.ai_dashboard_assistant_messages IS
  'Chat turns. blocks = rendered ChatBlock[] sent to the client; tool_calls = redacted request/response pairs for debugging + audit.';

-- ─── Tier-2 confirmable proposals ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_dashboard_assistant_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_dashboard_assistant_conversations (id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.ai_dashboard_assistant_messages (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_dashboard_assistant_pending_actions_status_check CHECK (
    status IN ('pending', 'confirmed', 'executed', 'denied', 'expired')
  ),
  CONSTRAINT ai_dashboard_assistant_pending_actions_risk_tier_check CHECK (
    risk_tier IN ('tier1_auto', 'tier2_confirmed')
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_pending_actions_user_status
  ON public.ai_dashboard_assistant_pending_actions (user_id, status);

COMMENT ON TABLE public.ai_dashboard_assistant_pending_actions IS
  'Tier-2 action proposals awaiting an explicit confirm-click. Only the proposing user_id may confirm. Expires 15 minutes after proposal.';

-- ─── Usage metering (soft cap, no real billing) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_dashboard_assistant_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  message_count INT NOT NULL DEFAULT 0,
  write_action_count INT NOT NULL DEFAULT 0,
  UNIQUE (organization_id, usage_date)
);

COMMENT ON TABLE public.ai_dashboard_assistant_usage_daily IS
  'Per-org daily message/write-action counters — the future-paid-tier foundation, incremented via ON CONFLICT DO UPDATE.';

-- ─── Action audit (booking-detail "Actions taken by AI assistant" panel) ────

CREATE TABLE IF NOT EXISTS public.ai_dashboard_assistant_action_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties (id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.guest_submissions (id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_dashboard_assistant_conversations (id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.ai_dashboard_assistant_messages (id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  risk_tier TEXT NOT NULL,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_status TEXT NOT NULL,
  result_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_dashboard_assistant_action_audit_risk_tier_check CHECK (
    risk_tier IN ('tier1_auto', 'tier2_confirmed')
  ),
  CONSTRAINT ai_dashboard_assistant_action_audit_result_status_check CHECK (
    result_status IN ('success', 'failed', 'denied')
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_action_audit_org_created
  ON public.ai_dashboard_assistant_action_audit (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_action_audit_booking_created
  ON public.ai_dashboard_assistant_action_audit (booking_id, created_at DESC);

COMMENT ON TABLE public.ai_dashboard_assistant_action_audit IS
  'Every executed tool call (Tier 1 auto or Tier 2 confirmed) — the source for the booking-detail "Actions taken by AI assistant" viewer.';

-- ─── Knowledge base (synced from route guides) ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_dashboard_assistant_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_guide_path TEXT NOT NULL,
  route_path TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_guide_path, question)
);

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_knowledge_base_fts
  ON public.ai_dashboard_assistant_knowledge_base
  USING GIN (to_tsvector('english', question || ' ' || answer));

COMMENT ON TABLE public.ai_dashboard_assistant_knowledge_base IS
  'Ingested from docs/guides/routes/**/*.md "Host-facing knowledge" Q&A sections by scripts/sync-ai-knowledge-base.ts. Searched via Postgres FTS by the search_knowledge_base tool.';

-- ─── updated_at triggers ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_ai_dashboard_assistant_global_settings_updated_at
  ON public.ai_dashboard_assistant_global_settings;
CREATE TRIGGER update_ai_dashboard_assistant_global_settings_updated_at
  BEFORE UPDATE ON public.ai_dashboard_assistant_global_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_dashboard_assistant_org_settings_updated_at
  ON public.ai_dashboard_assistant_org_settings;
CREATE TRIGGER update_ai_dashboard_assistant_org_settings_updated_at
  BEFORE UPDATE ON public.ai_dashboard_assistant_org_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_dashboard_assistant_conversations_updated_at
  ON public.ai_dashboard_assistant_conversations;
CREATE TRIGGER update_ai_dashboard_assistant_conversations_updated_at
  BEFORE UPDATE ON public.ai_dashboard_assistant_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Reads for org/property members via a SECURITY DEFINER helper, mirroring
-- user_can_access_org_inbox (20260910120000_social_inbox.sql). Conversations,
-- messages, and pending actions are additionally scoped to the owning user —
-- private per user, not just private per org. All writes go through edge
-- functions' service-role client, which bypasses RLS.

ALTER TABLE public.ai_dashboard_assistant_global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_dashboard_assistant_org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_dashboard_assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_dashboard_assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_dashboard_assistant_pending_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_dashboard_assistant_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_dashboard_assistant_action_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_dashboard_assistant_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_access_ai_dashboard_assistant_org(p_org_id UUID)
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
  )
  OR EXISTS (
    SELECT 1 FROM public.property_members pm
    JOIN public.properties p ON p.id = pm.property_id
    WHERE p.organization_id = p_org_id
      AND pm.user_id = auth.uid()
      AND pm.status = 'active'
  );
$$;

CREATE POLICY ai_dashboard_assistant_global_settings_select
  ON public.ai_dashboard_assistant_global_settings
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY ai_dashboard_assistant_org_settings_select
  ON public.ai_dashboard_assistant_org_settings
  FOR SELECT TO authenticated
  USING (public.user_can_access_ai_dashboard_assistant_org(organization_id));

CREATE POLICY ai_dashboard_assistant_conversations_select
  ON public.ai_dashboard_assistant_conversations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND public.user_can_access_ai_dashboard_assistant_org(organization_id)
  );

CREATE POLICY ai_dashboard_assistant_messages_select
  ON public.ai_dashboard_assistant_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_dashboard_assistant_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY ai_dashboard_assistant_pending_actions_select
  ON public.ai_dashboard_assistant_pending_actions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY ai_dashboard_assistant_action_audit_select
  ON public.ai_dashboard_assistant_action_audit
  FOR SELECT TO authenticated
  USING (public.user_can_access_ai_dashboard_assistant_org(organization_id));

CREATE POLICY ai_dashboard_assistant_knowledge_base_select
  ON public.ai_dashboard_assistant_knowledge_base
  FOR SELECT TO authenticated
  USING (TRUE);

GRANT ALL ON public.ai_dashboard_assistant_global_settings TO service_role;
GRANT ALL ON public.ai_dashboard_assistant_org_settings TO service_role;
GRANT ALL ON public.ai_dashboard_assistant_conversations TO service_role;
GRANT ALL ON public.ai_dashboard_assistant_messages TO service_role;
GRANT ALL ON public.ai_dashboard_assistant_pending_actions TO service_role;
GRANT ALL ON public.ai_dashboard_assistant_usage_daily TO service_role;
GRANT ALL ON public.ai_dashboard_assistant_action_audit TO service_role;
GRANT ALL ON public.ai_dashboard_assistant_knowledge_base TO service_role;
