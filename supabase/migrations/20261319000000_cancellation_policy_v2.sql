-- Cancellation policy v2 — versions, booking-time snapshot, cancellation metadata.
-- Plan: docs/workflow/in-progress/cancellation-policy-and-process.md

-- ── Policy versions (append-only) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.property_cancellation_policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  policy JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_cancellation_policy_versions_property
  ON public.property_cancellation_policy_versions (property_id, created_at DESC);

COMMENT ON TABLE public.property_cancellation_policy_versions IS
  'Append-only history of a property cancellation policy. Current version id lives at properties.settings.cancellationPolicyVersionId.';

ALTER TABLE public.property_cancellation_policy_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Scoped property members can read cancellation policy versions"
  ON public.property_cancellation_policy_versions;
CREATE POLICY "Scoped property members can read cancellation policy versions"
  ON public.property_cancellation_policy_versions
  FOR SELECT
  TO authenticated
  USING (private.user_can_access_guest_submission_property(property_id));

-- ── Booking-time snapshot + cancellation metadata ────────────────────────────

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS cancellation_policy_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS cancellation_policy_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason_note TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_refund_override_php NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS cancellation_override_note TEXT;

UPDATE public.guest_submissions
SET booked_at = created_at
WHERE booked_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guest_submissions_cancelled_by_check'
  ) THEN
    ALTER TABLE public.guest_submissions
      ADD CONSTRAINT guest_submissions_cancelled_by_check
      CHECK (cancelled_by IS NULL OR cancelled_by IN ('guest', 'host', 'ota', 'system'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_guest_submissions_cancellation_requested
  ON public.guest_submissions (property_id, cancellation_requested_at DESC)
  WHERE cancellation_requested_at IS NOT NULL;

COMMENT ON COLUMN public.guest_submissions.cancellation_policy_snapshot IS
  'Immutable copy of the cancellation policy at booking time (policy + rendered copy + hash + capture source).';
COMMENT ON COLUMN public.guest_submissions.booked_at IS
  'Guest commitment moment. Anchors the free-cancellation grace window.';
COMMENT ON COLUMN public.guest_submissions.cancelled_by IS
  'Who cancelled: guest, host, ota (calendar sync), system (import revert).';

-- ── Snapshot immutability ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prevent_cancellation_policy_snapshot_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF old.cancellation_policy_snapshot IS NOT NULL
     AND new.cancellation_policy_snapshot IS DISTINCT FROM old.cancellation_policy_snapshot
     AND coalesce(current_setting('app.allow_cancellation_snapshot_override', true), '') <> 'on'
  THEN
    RAISE EXCEPTION 'cancellation_policy_snapshot is immutable'
      USING ERRCODE = 'P0001',
            HINT = 'Use admin_set_cancellation_policy_snapshot with a reason.';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_guest_submissions_cancellation_snapshot_immutable
  ON public.guest_submissions;
CREATE TRIGGER trg_guest_submissions_cancellation_snapshot_immutable
  BEFORE UPDATE OF cancellation_policy_snapshot ON public.guest_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_cancellation_policy_snapshot_update();

-- Emergency correction path. Platform super-admins only; requires a reason.
CREATE OR REPLACE FUNCTION public.admin_set_cancellation_policy_snapshot(
  p_booking_id UUID,
  p_snapshot JSONB,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_super_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF coalesce(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'reason is required' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.allow_cancellation_snapshot_override', 'on', true);

  UPDATE public.guest_submissions
  SET cancellation_policy_snapshot = p_snapshot
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_cancellation_policy_snapshot(UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_cancellation_policy_snapshot(UUID, JSONB, TEXT) TO authenticated;
