-- Help & Support — Ticket support (Module 3, in-app + one-way email notify).
-- Docs: docs/workflow/in-progress/help-support-center.md, Module 3.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties (id) ON DELETE SET NULL,
  parking_id UUID REFERENCES public.parkings (id) ON DELETE SET NULL,
  submitted_by_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  submitted_by_name TEXT NOT NULL,
  submitted_by_email TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT,
  category_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_tickets_category_check CHECK (
    category IN ('bug_report', 'feature_suggestion', 'general_inquiry', 'business_inquiry')
  ),
  CONSTRAINT support_tickets_status_check CHECK (
    status IN ('open', 'in_progress', 'resolved', 'closed')
  ),
  CONSTRAINT support_tickets_priority_check CHECK (
    priority IS NULL OR priority IN ('low', 'medium', 'high')
  )
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_org_created
  ON public.support_tickets (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_org_status
  ON public.support_tickets (organization_id, status);

COMMENT ON TABLE public.support_tickets IS
  'Host-filed support tickets (bug report / feature suggestion / general inquiry / business inquiry). Filed at org, property, or parking scope; category_fields holds the per-category dynamic fields (page_url, browser_info, steps_to_reproduce, severity, expected_benefit, contact_preference).';

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets (id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_ticket_messages_sender_type_check CHECK (sender_type IN ('host', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_created
  ON public.support_ticket_messages (ticket_id, created_at ASC);

COMMENT ON TABLE public.support_ticket_messages IS
  'Ticket reply thread. First row is always the initial submission (sender_type=host). attachments: [{ name, mimeType, size, path }] — bytes live in the private support-ticket-attachments Storage bucket.';

DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── Storage bucket ──────────────────────────────────────────────────────────
-- Private — service role only. Images + video (bug-report screenshots/recordings), 20MB.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-ticket-attachments',
  'support-ticket-attachments',
  FALSE,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Service role full access to support-ticket-attachments" ON storage.objects;

CREATE POLICY "Service role full access to support-ticket-attachments"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'support-ticket-attachments')
  WITH CHECK (bucket_id = 'support-ticket-attachments');

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Reads scoped to the caller's org (owner / active org member / active property
-- member) via a SECURITY DEFINER helper, mirroring user_can_access_ai_dashboard_assistant_org
-- (20261018120000_ai_dashboard_assistant.sql). All writes go through service-role
-- edge functions — RLS isn't the access-control layer here.

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_access_org_support_tickets(p_org_id UUID)
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

CREATE POLICY support_tickets_select ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.user_can_access_org_support_tickets(organization_id));

CREATE POLICY support_ticket_messages_select ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND public.user_can_access_org_support_tickets(t.organization_id)
    )
  );

GRANT ALL ON public.support_tickets TO service_role;
GRANT ALL ON public.support_ticket_messages TO service_role;
