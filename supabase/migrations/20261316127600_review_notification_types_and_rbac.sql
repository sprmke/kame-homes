-- Two-way reviews: new notification types + property team RBAC leaves.
--
-- New notification types: review_received, review_due, review_response_received.
-- New property leaves: reviews:view, reviews.guests:edit, reviews.responses:edit.
-- Backfill rule (same as 20261316125000): a stored permission array that holds the
-- "source" leaf also gets the new leaf. Roles that never had the source leaf are untouched.

BEGIN;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'booking_pending_review',
    'booking_ready_for_checkin',
    'booking_ready_for_checkout',
    'booking_sd_refund_due',
    'booking_gaf_auto_approved',
    'booking_pet_auto_approved',
    'booking_parking_matched',
    'inbox_new_message',
    'calendar_sync_failing',
    'calendar_conflict',
    'booking_external_imported',
    'booking_guest_form_completed',
    'smart_pricing_updated',
    'property_settings_copied',
    'analytics_review_updated',
    'review_received',
    'review_due',
    'review_response_received'
  )
);

CREATE OR REPLACE FUNCTION public._gfm_grant_leaf_if_has(
  raw jsonb,
  source_leaves text[],
  new_leaf text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF raw IS NULL OR jsonb_typeof(raw) <> 'array' THEN
    RETURN raw;
  END IF;
  IF raw ? new_leaf THEN
    RETURN raw;
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(source_leaves) AS s(leaf) WHERE raw ? s.leaf
  ) THEN
    RETURN raw || to_jsonb(new_leaf);
  END IF;
  RETURN raw;
END;
$$;

-- reviews:view — anyone who could already see bookings.
UPDATE public.property_members
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['bookings:view'], 'reviews:view'),
    saved_permissions = public._gfm_grant_leaf_if_has(saved_permissions, ARRAY['bookings:view'], 'reviews:view');
UPDATE public.property_custom_roles
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['bookings:view'], 'reviews:view');
UPDATE public.property_invitations
SET permissions = public._gfm_grant_leaf_if_has(permissions, ARRAY['bookings:view'], 'reviews:view');

-- reviews.guests:edit — roles that could already run booking workflow transitions.
UPDATE public.property_members
SET permissions = public._gfm_grant_leaf_if_has(
      permissions, ARRAY['bookings.detail.workflow:edit'], 'reviews.guests:edit'),
    saved_permissions = public._gfm_grant_leaf_if_has(
      saved_permissions, ARRAY['bookings.detail.workflow:edit'], 'reviews.guests:edit');
UPDATE public.property_custom_roles
SET permissions = public._gfm_grant_leaf_if_has(
      permissions, ARRAY['bookings.detail.workflow:edit'], 'reviews.guests:edit');
UPDATE public.property_invitations
SET permissions = public._gfm_grant_leaf_if_has(
      permissions, ARRAY['bookings.detail.workflow:edit'], 'reviews.guests:edit');

-- reviews.responses:edit — workflow-capable roles, or marketing/guest-facing-copy roles.
UPDATE public.property_members
SET permissions = public._gfm_grant_leaf_if_has(
      permissions, ARRAY['bookings.detail.workflow:edit', 'marketing.content:edit'], 'reviews.responses:edit'),
    saved_permissions = public._gfm_grant_leaf_if_has(
      saved_permissions, ARRAY['bookings.detail.workflow:edit', 'marketing.content:edit'], 'reviews.responses:edit');
UPDATE public.property_custom_roles
SET permissions = public._gfm_grant_leaf_if_has(
      permissions, ARRAY['bookings.detail.workflow:edit', 'marketing.content:edit'], 'reviews.responses:edit');
UPDATE public.property_invitations
SET permissions = public._gfm_grant_leaf_if_has(
      permissions, ARRAY['bookings.detail.workflow:edit', 'marketing.content:edit'], 'reviews.responses:edit');

DROP FUNCTION public._gfm_grant_leaf_if_has(jsonb, text[], text);

COMMIT;
