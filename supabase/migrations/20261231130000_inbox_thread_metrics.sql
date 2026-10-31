-- Superhost Phase 1: inbox response metrics (rolling 365-day response rate).

BEGIN;

CREATE TABLE IF NOT EXISTS public.inbox_thread_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.social_conversations (id) ON DELETE CASCADE,
  first_guest_message_at TIMESTAMPTZ NOT NULL,
  first_host_reply_at TIMESTAMPTZ,
  responded_within_24h BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inbox_thread_metrics_conversation_unique UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_thread_metrics_org_first_guest
  ON public.inbox_thread_metrics (organization_id, first_guest_message_at DESC);

COMMENT ON TABLE public.inbox_thread_metrics IS
  'Per-inbox-thread Superhost response metrics. first_guest_message_at set on first inbound; first_host_reply_at on first outbound host reply.';

ALTER TABLE public.inbox_thread_metrics ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.inbox_thread_metrics TO service_role;

COMMIT;
