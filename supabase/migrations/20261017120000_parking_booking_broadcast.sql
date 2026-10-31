-- Parking broadcast/claim substrate (Phase 1c of parking E2E plan): widen status CHECK,
-- relax parking_id for pre-claim broadcast rows, add parking_booking_broadcasts table.

BEGIN;

-- 1) Widen status CHECK to add PENDING_HOST_ACCEPTANCE + NO_HOST_AVAILABLE.
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
    'NO_HOST_AVAILABLE'
  ));

COMMENT ON COLUMN public.guest_submissions.status IS
  'Workflow status. Values: PENDING_REVIEW | PENDING_DOCUMENTS | PENDING_GAF | '
  'PENDING_PARKING_REQUEST | PENDING_PET_REQUEST | READY_FOR_CHECKIN | '
  'READY_FOR_CHECKOUT | PENDING_SD_REFUND | COMPLETED | CANCELLED | IMPORTED | '
  'PENDING_HOST_ACCEPTANCE | NO_HOST_AVAILABLE. '
  'PENDING_HOST_ACCEPTANCE/NO_HOST_AVAILABLE are parking-only broadcast statuses '
  '(see parkingStatusMachine.ts) and never flow through the property workflowOrchestrator.';

-- 2) New columns on guest_submissions for the parking broadcast/claim flow.
ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS parking_request_organization_id UUID REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS requested_vehicle_type TEXT
    CHECK (requested_vehicle_type IS NULL OR requested_vehicle_type IN ('car', 'motorcycle')),
  ADD COLUMN IF NOT EXISTS parking_broadcast_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parking_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parking_endorsement_note TEXT
    CHECK (parking_endorsement_note IS NULL OR char_length(parking_endorsement_note) <= 2000);

COMMENT ON COLUMN public.guest_submissions.parking_request_organization_id IS
  'Org scope for a parking broadcast request; required while parking_id is null (pre-claim).';
COMMENT ON COLUMN public.guest_submissions.parking_broadcast_expires_at IS
  'TTL for the single broadcast round; expire-parking-broadcasts cron flips to NO_HOST_AVAILABLE past this.';
COMMENT ON COLUMN public.guest_submissions.parking_claimed_at IS
  'Set by claim-parking-booking on the winning Accept.';
COMMENT ON COLUMN public.guest_submissions.parking_endorsement_note IS
  'Host access instructions shown to the guest after Accept.';

-- 3) Relax property/parking exclusivity CHECK to allow a pre-claim broadcast row
--    (neither property nor parking set, org required, status locked to PENDING_HOST_ACCEPTANCE).
ALTER TABLE public.guest_submissions
  DROP CONSTRAINT IF EXISTS guest_submissions_property_or_parking_check;

ALTER TABLE public.guest_submissions
  ADD CONSTRAINT guest_submissions_property_or_parking_check
  CHECK (
    (property_id IS NOT NULL AND parking_id IS NULL AND parking_request_organization_id IS NULL)
    OR
    (property_id IS NULL AND parking_id IS NOT NULL)
    OR
    (
      property_id IS NULL
      AND parking_id IS NULL
      AND parking_request_organization_id IS NOT NULL
      AND status = 'PENDING_HOST_ACCEPTANCE'
    )
  );

-- 4) Broadcast candidate table.
CREATE TABLE IF NOT EXISTS public.parking_booking_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.guest_submissions(id) ON DELETE CASCADE,
  parking_id UUID NOT NULL REFERENCES public.parkings(id) ON DELETE CASCADE,
  notified_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response TEXT NOT NULL DEFAULT 'pending'
    CHECK (response IN ('pending', 'claimed', 'declined', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, parking_id)
);

CREATE INDEX IF NOT EXISTS parking_booking_broadcasts_booking_response_idx
  ON public.parking_booking_broadcasts (booking_id, response);

CREATE INDEX IF NOT EXISTS parking_booking_broadcasts_parking_pending_idx
  ON public.parking_booking_broadcasts (parking_id)
  WHERE response = 'pending';

COMMENT ON TABLE public.parking_booking_broadcasts IS
  'Per-candidate fan-out rows for a parking broadcast request; first claim wins, service-role writes only.';

ALTER TABLE public.parking_booking_broadcasts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_booking_broadcasts TO service_role;

-- 5) Expiration cron support.
CREATE INDEX IF NOT EXISTS guest_submissions_parking_broadcast_expiry_idx
  ON public.guest_submissions (parking_broadcast_expires_at)
  WHERE status = 'PENDING_HOST_ACCEPTANCE';

COMMIT;
