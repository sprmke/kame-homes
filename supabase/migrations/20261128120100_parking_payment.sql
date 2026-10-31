-- Phase 3 match engine: PayMongo guest payment for the parkings vertical.
-- New PENDING_PAYMENT status sits between host-claim and PENDING_REVIEW (now "paid & confirmed").

BEGIN;

-- 1) Widen status CHECK to add PENDING_PAYMENT.
ALTER TABLE public.guest_submissions
  DROP CONSTRAINT IF EXISTS guest_submissions_status_check;

ALTER TABLE public.guest_submissions
  ADD CONSTRAINT guest_submissions_status_check
  CHECK (status IN (
    'PENDING_REVIEW',
    'PENDING_DOCUMENTS',
    'PENDING_GAF',
    'PENDING_PARKING_REQUEST',
    'PENDING_PET_REQUEST',
    'READY_FOR_CHECKIN',
    'READY_FOR_CHECKOUT',
    'PENDING_SD_REFUND',
    'COMPLETED',
    'CANCELLED',
    'IMPORTED',
    'PENDING_HOST_ACCEPTANCE',
    'NO_HOST_AVAILABLE',
    'PENDING_PAYMENT'
  ));

COMMENT ON COLUMN public.guest_submissions.status IS
  'Workflow status. Values: PENDING_REVIEW | PENDING_DOCUMENTS | PENDING_GAF | '
  'PENDING_PARKING_REQUEST | PENDING_PET_REQUEST | READY_FOR_CHECKIN | '
  'READY_FOR_CHECKOUT | PENDING_SD_REFUND | COMPLETED | CANCELLED | IMPORTED | '
  'PENDING_HOST_ACCEPTANCE | NO_HOST_AVAILABLE | PENDING_PAYMENT. '
  'PENDING_HOST_ACCEPTANCE/PENDING_PAYMENT/NO_HOST_AVAILABLE are parking-only broadcast/payment '
  'statuses (see parkingStatusMachine.ts) and never flow through the property workflowOrchestrator.';

-- 2) New guest_submissions columns for guest-authenticated submit + payment TTL.
ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS guest_auth_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS parking_payment_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.guest_submissions.guest_auth_user_id IS
  'Signed-in guest identity that submitted this parking request (submit-parking-booking-request '
  'now requires guest auth). Used for ownership checks on cancel/pay-now and anti-spam rate '
  'limiting (Phase 3 fast-follow).';
COMMENT ON COLUMN public.guest_submissions.parking_payment_expires_at IS
  'TTL for the PENDING_PAYMENT window (same asymmetry as parking_broadcast_expires_at via '
  'parkingBroadcastTtlMs). Past this with no payment, runExpireParkingPayments() releases the '
  'claim and re-opens search (or terminates) via advanceOrTerminateParkingBatch.';

CREATE INDEX IF NOT EXISTS guest_submissions_parking_payment_expiry_idx
  ON public.guest_submissions (parking_payment_expires_at)
  WHERE status = 'PENDING_PAYMENT';

-- 3) Payment transaction ledger (mirrors org_payment_transactions).
CREATE TABLE IF NOT EXISTS public.parking_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.guest_submissions(id) ON DELETE CASCADE,
  parking_id UUID NOT NULL REFERENCES public.parkings(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  guest_charge_total NUMERIC(12, 2) NOT NULL,
  host_gross_total NUMERIC(12, 2) NOT NULL,
  commission_pct NUMERIC(5, 4) NOT NULL,
  host_net_total NUMERIC(12, 2) NOT NULL,
  nights INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'paymongo',
  provider_reference TEXT,
  checkout_url TEXT,
  payment_method_type TEXT,
  currency TEXT NOT NULL DEFAULT 'PHP',
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  raw_webhook_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  CONSTRAINT parking_payment_transactions_status_check CHECK (
    status IN ('pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded')
  )
);

CREATE INDEX IF NOT EXISTS idx_parking_payment_transactions_booking
  ON public.parking_payment_transactions (booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parking_payment_transactions_provider_ref
  ON public.parking_payment_transactions (provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS parking_payment_transactions_one_pending_per_booking_idx
  ON public.parking_payment_transactions (booking_id)
  WHERE status = 'pending';

COMMENT ON TABLE public.parking_payment_transactions IS
  'Audit ledger for PayMongo checkout links per parking booking payment. host_gross_total/'
  'commission_pct/host_net_total are an audit-trail snapshot only in Phase 3 (interim stub '
  'commission) -- no payout logic acts on them yet; Phase 4 owns real payout.';

ALTER TABLE public.parking_payment_transactions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.parking_payment_transactions TO service_role;

COMMIT;
