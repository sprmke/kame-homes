/** Edge mirror of ui/src/lib/posthog/catalog.ts — keep event names in sync. */

export const POSTHOG_EVENTS = [
  'guest_form_submitted',
  'guest_form_rejected',
  'guest_form_completion_submitted',
  'org_created',
  'property_created',
  'parking_created',
  'team_invite_accepted',
  'host_verification_submitted',
  'host_verification_resolved',
  'booking_workflow_transitioned',
  'booking_document_step_completed',
  'booking_cancelled',
  'booking_imported',
  'sd_form_submitted',
  'sd_voucher_claimed',
  'guest_review_submitted',
  'host_guest_review_submitted',
  'review_pair_published',
  'review_response_posted',
  'review_reported',
  'review_removed',
  'parking_payment_completed',
  'parking_payment_failed',
] as const;

export type PostHogEventName = (typeof POSTHOG_EVENTS)[number];
