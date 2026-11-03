-- Guest AI receptionist write tools: request_booking_inquiry / request_early_checkin_late_checkout.
-- Plan: docs/workflow/in-progress/agentic-ai-assistants.md (Phase 5, guest write tools).
--
-- Nothing binding happens until a host approves or declines — the row only records the guest's
-- request and the host's decision. Approving never auto-creates or edits a booking; that stays a
-- manual admin action elsewhere (same posture as every other booking field edit in this app).

CREATE TABLE IF NOT EXISTS public.guest_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  -- The inbox thread the guest asked from, so the host sees this inline where they'd expect it.
  conversation_id UUID REFERENCES public.social_conversations (id) ON DELETE SET NULL,
  guest_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Set only for early_checkin_late_checkout (an existing booking). Null for booking_inquiry
  -- (a prospective stay with no booking yet).
  booking_id UUID REFERENCES public.guest_submissions (id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT guest_requests_kind_check CHECK (
    kind IN ('booking_inquiry', 'early_checkin_late_checkout')
  ),
  CONSTRAINT guest_requests_status_check CHECK (
    status IN ('pending', 'approved', 'declined')
  )
);

CREATE INDEX IF NOT EXISTS idx_guest_requests_conversation
  ON public.guest_requests (conversation_id);
CREATE INDEX IF NOT EXISTS idx_guest_requests_property_status
  ON public.guest_requests (property_id, status);

COMMENT ON TABLE public.guest_requests IS
  'Guest-submitted, host-reviewed requests from the AI receptionist. Approve/decline only records the decision — never auto-creates or edits a booking.';

ALTER TABLE public.guest_requests ENABLE ROW LEVEL SECURITY;

-- Reuses the existing org/property-membership check from the dashboard assistant migration
-- (public.user_can_access_ai_dashboard_assistant_org) — it is a plain org-access helper with
-- nothing AI-assistant-specific in its body, and this row is part of the same AI receptionist
-- surface area.
CREATE POLICY guest_requests_select
  ON public.guest_requests
  FOR SELECT TO authenticated
  USING (
    guest_user_id = auth.uid()
    OR public.user_can_access_ai_dashboard_assistant_org(organization_id)
  );

GRANT ALL ON public.guest_requests TO service_role;
