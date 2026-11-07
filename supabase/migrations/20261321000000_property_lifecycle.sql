-- Property lifecycle: record why a listing is inactive, and enforce the invariant
-- that `status` and `inactive_reason` always agree.
--
-- `properties.status` stays the single "is it publicly live" flag so the existing
-- `.eq('status', 'ACTIVE')` reads keep working. `inactive_reason` explains which of the
-- five meanings applies:
--   pending_verification  new listing, waiting for Tier 1 approval
--   paused                host paused new bookings, listing still public
--   contract_lapsed       listing contract ended / access locked
--   consideration_denied  super admin denied a contract extension
--   succession            unit handed to another listing (peer activated)
--   archived              host retired the listing
--
-- Plan: docs/workflow/in-progress/property-archive-and-delete-lifecycle.md (P1).

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS inactive_reason TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

-- ─── Backfill before the invariant constraint is added ──────────────────────

WITH candidates AS (
  SELECT
    p.id,
    CASE
      -- No approved listing authorization (listing block first, org leg as the legacy fallback).
      WHEN COALESCE(
        p.settings #>> '{listingAuthorization,baseStatus}',
        o.settings #>> '{verification,baseStatus}'
      ) IS DISTINCT FROM 'approved' THEN 'pending_verification'
      -- Contract lifecycle locked (listing block first, org leg as the legacy fallback).
      WHEN COALESCE(
        p.settings #>> '{listingAuthorization,lifecycle,accessLockedAt}',
        o.settings #>> '{verification,propertyLifecycle,accessLockedAt}'
      ) IS NOT NULL THEN 'contract_lapsed'
      -- A peer in another org now holds the same tower + unit.
      WHEN EXISTS (
        SELECT 1
        FROM public.properties peer
        WHERE peer.id <> p.id
          AND peer.status = 'ACTIVE'
          AND peer.tower IS NOT NULL
          AND peer.unit_number IS NOT NULL
          AND lower(peer.tower) = lower(p.tower)
          AND peer.unit_number = p.unit_number
          AND peer.organization_id <> p.organization_id
      ) THEN 'succession'
      ELSE 'archived'
    END AS reason
  FROM public.properties p
  JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.status = 'INACTIVE'
    AND p.inactive_reason IS NULL
)
UPDATE public.properties p
SET
  inactive_reason = c.reason,
  archived_at = CASE WHEN c.reason = 'archived' THEN p.updated_at ELSE NULL END
FROM candidates c
WHERE p.id = c.id;

-- Any INACTIVE row with an unrecognised value would fail the constraint below; normalise
-- it to `archived` so the migration is idempotent and never blocks on stale data.
UPDATE public.properties
SET inactive_reason = 'archived',
    archived_at = COALESCE(archived_at, updated_at)
WHERE status = 'INACTIVE'
  AND inactive_reason IS NULL;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_inactive_reason_check;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_inactive_reason_check CHECK (
    inactive_reason IS NULL
    OR inactive_reason IN (
      'pending_verification',
      'paused',
      'contract_lapsed',
      'consideration_denied',
      'succession',
      'archived'
    )
  );

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_lifecycle_status_check;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_lifecycle_status_check CHECK (
    (status = 'ACTIVE' AND inactive_reason IS NULL)
    OR (status = 'INACTIVE' AND inactive_reason IS NOT NULL)
  );

COMMENT ON COLUMN public.properties.inactive_reason IS
  'Why the listing is INACTIVE. NULL iff status = ACTIVE (properties_lifecycle_status_check).';
COMMENT ON COLUMN public.properties.archived_at IS
  'When the host retired the listing. Only set for inactive_reason = archived.';
COMMENT ON COLUMN public.properties.paused_at IS
  'When the host paused new bookings. Survives verification approval and contract changes.';

CREATE INDEX IF NOT EXISTS idx_properties_org_lifecycle
  ON public.properties (organization_id, status, inactive_reason);

-- ─── Race backstop: no new guest booking on a non-live listing ──────────────
--
-- `submit-form` and `get-form` check the listing before insert, but a guest submit can
-- interleave with an archive. This trigger is the last line of defence and keeps the
-- invariant true even for writers that forget the check.
--
-- OTA iCal imports are exempt: a paused property still receives an import that was
-- already in flight (documented edge case), and a late import on an archived property is
-- caught by the archive pre-check/re-check instead.

CREATE OR REPLACE FUNCTION public.guard_guest_submission_property_live()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_status TEXT;
BEGIN
  IF NEW.property_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'IMPORTED' OR NEW.external_feed_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT status INTO listing_status
  FROM public.properties
  WHERE id = NEW.property_id;

  IF listing_status IS NOT NULL AND listing_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'PROPERTY_NOT_ACCEPTING_BOOKINGS'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger functions never need a public EXECUTE grant.
REVOKE ALL ON FUNCTION public.guard_guest_submission_property_live() FROM PUBLIC;

DROP TRIGGER IF EXISTS guest_submissions_property_live_guard ON public.guest_submissions;
CREATE TRIGGER guest_submissions_property_live_guard
  BEFORE INSERT ON public.guest_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_guest_submission_property_live();

COMMENT ON FUNCTION public.guard_guest_submission_property_live() IS
  'Rejects a new guest booking when its property is not ACTIVE. OTA imports are exempt.';
