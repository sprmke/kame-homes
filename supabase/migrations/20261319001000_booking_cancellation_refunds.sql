-- Cancellation requests + refund tracking.
-- Plan: docs/workflow/in-progress/cancellation-policy-and-process.md §4.8

CREATE TABLE IF NOT EXISTS public.booking_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.guest_submissions (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'approved', 'declined', 'withdrawn', 'expired')),
  reason_code TEXT NOT NULL,
  reason_note TEXT,
  host_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_cancellation_requests_one_open_per_booking
  ON public.booking_cancellation_requests (booking_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_booking_cancellation_requests_property
  ON public.booking_cancellation_requests (property_id, requested_at DESC);

COMMENT ON TABLE public.booking_cancellation_requests IS
  'Guest cancellation requests when the policy is request-mode. One open request per booking.';

ALTER TABLE public.booking_cancellation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Scoped property members can read cancellation requests"
  ON public.booking_cancellation_requests;
CREATE POLICY "Scoped property members can read cancellation requests"
  ON public.booking_cancellation_requests
  FOR SELECT
  TO authenticated
  USING (private.user_can_access_guest_submission_property(property_id));

CREATE TABLE IF NOT EXISTS public.booking_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.guest_submissions (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations (id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'cancellation'
    CHECK (kind IN ('cancellation', 'goodwill')),
  amount_due_php NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount_paid_php NUMERIC(12, 2),
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('not_due', 'awaiting_guest_details', 'pending', 'sent', 'cancelled')),
  method TEXT,
  bank TEXT,
  account_name TEXT,
  account_number TEXT,
  phone TEXT,
  proof_url TEXT,
  sent_at TIMESTAMPTZ,
  created_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_refunds_one_cancellation_per_booking
  ON public.booking_refunds (booking_id)
  WHERE kind = 'cancellation';

CREATE INDEX IF NOT EXISTS idx_booking_refunds_property_status
  ON public.booking_refunds (property_id, status, created_at DESC);

COMMENT ON TABLE public.booking_refunds IS
  'Refund owed to a guest after a cancellation or goodwill adjustment. Host sends the money manually and marks it sent.';

ALTER TABLE public.booking_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Scoped property members can read booking refunds"
  ON public.booking_refunds;
CREATE POLICY "Scoped property members can read booking refunds"
  ON public.booking_refunds
  FOR SELECT
  TO authenticated
  USING (private.user_can_access_guest_submission_property(property_id));

-- Shared updated_at trigger (reuse if the repo already has one).
CREATE OR REPLACE FUNCTION public.set_booking_refunds_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_refunds_updated_at ON public.booking_refunds;
CREATE TRIGGER trg_booking_refunds_updated_at
  BEFORE UPDATE ON public.booking_refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.set_booking_refunds_updated_at();

CREATE OR REPLACE FUNCTION public.set_booking_cancellation_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_cancellation_requests_updated_at
  ON public.booking_cancellation_requests;
CREATE TRIGGER trg_booking_cancellation_requests_updated_at
  BEFORE UPDATE ON public.booking_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_booking_cancellation_requests_updated_at();
