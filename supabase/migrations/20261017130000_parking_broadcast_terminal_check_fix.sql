-- Fix guest_submissions_property_or_parking_check: a broadcast pre-claim request that
-- times out or is cancelled before any host claims it must be allowed to reach
-- NO_HOST_AVAILABLE / CANCELLED while parking_id and property_id stay null.
-- (20261017120000 only allowed the pre-claim status itself, not its terminal outcomes.)

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
      AND status IN ('PENDING_HOST_ACCEPTANCE', 'NO_HOST_AVAILABLE', 'CANCELLED')
    )
  );
