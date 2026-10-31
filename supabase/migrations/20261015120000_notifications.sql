-- In-App Notification Center: broadcast event content + per-admin read tracking.
-- See docs/workflow/in-progress/in-app-notifications.md for the full plan.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE,
  parking_id UUID REFERENCES public.parkings (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  booking_id UUID REFERENCES public.guest_submissions (id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.social_conversations (id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_type_check CHECK (
    type IN (
      'booking_pending_review',
      'booking_ready_for_checkin',
      'booking_ready_for_checkout',
      'booking_sd_refund_due',
      'booking_gaf_auto_approved',
      'booking_pet_auto_approved',
      'inbox_new_message'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_type_dedupe_key_unique
  ON public.notifications (type, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_org_created
  ON public.notifications (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_property_created
  ON public.notifications (property_id, created_at DESC)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_parking_created
  ON public.notifications (parking_id, created_at DESC)
  WHERE parking_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_reads_notification_user_unique UNIQUE (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user_notification
  ON public.notification_reads (user_id, notification_id);

COMMENT ON TABLE public.notifications IS
  'Broadcast in-app notification events, scoped to org/property/parking. Read state is per-user — see notification_reads.';
COMMENT ON TABLE public.notification_reads IS
  'Per-admin read tracking for notifications. Absence of a row = unread.';

-- RLS: edge functions use service_role; direct reads + Realtime for org/property/parking members.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_access_org_notifications(p_org_id UUID)
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

CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (public.user_can_access_org_notifications(organization_id));

CREATE POLICY notification_reads_select ON public.notification_reads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notification_reads_insert ON public.notification_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Realtime filters on organization_id require REPLICA IDENTITY FULL.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Explicit grants — RLS-enabled tables without grants fail with "permission denied"
-- for service_role (see 20260913120000_social_inbox_service_role_grants.sql precedent).
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.notification_reads TO service_role;
GRANT SELECT ON public.notifications TO authenticated;
GRANT SELECT, INSERT ON public.notification_reads TO authenticated;
