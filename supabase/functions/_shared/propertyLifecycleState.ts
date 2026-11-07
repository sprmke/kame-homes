/**
 * Pure property-lifecycle vocabulary — no DB, no side effects.
 *
 * Split out from `propertyLifecycle.ts` so public read paths (the guest property page) can
 * map a status + reason without pulling the billing/lifecycle service graph into their bundle.
 * `propertyLifecycle.ts` re-exports everything here.
 */

export const PROPERTY_INACTIVE_REASONS = [
  'pending_verification',
  'paused',
  'contract_lapsed',
  'consideration_denied',
  'succession',
  'archived',
] as const;
export type PropertyInactiveReason = (typeof PROPERTY_INACTIVE_REASONS)[number];

export const PROPERTY_LIFECYCLE_STATES = [
  'pending_verification',
  'live',
  'paused',
  'suspended',
  'archived',
] as const;
export type PropertyLifecycleState = (typeof PROPERTY_LIFECYCLE_STATES)[number];

export const PROPERTY_LIFECYCLE_ACTIONS = ['pause', 'resume', 'archive', 'restore'] as const;
export type PropertyLifecycleAction = (typeof PROPERTY_LIFECYCLE_ACTIONS)[number];

const INACTIVE_REASON_LABELS: Record<PropertyInactiveReason, string> = {
  pending_verification: 'Waiting for approval',
  paused: 'Paused',
  contract_lapsed: 'Contract ended',
  consideration_denied: 'Contract extension declined',
  succession: 'Unit handed over',
  archived: 'Archived',
};

export function inactiveReasonLabel(reason: PropertyInactiveReason | null): string | null {
  return reason ? INACTIVE_REASON_LABELS[reason] : null;
}

export function asPropertyInactiveReason(value: unknown): PropertyInactiveReason | null {
  return typeof value === 'string' &&
    (PROPERTY_INACTIVE_REASONS as readonly string[]).includes(value)
    ? (value as PropertyInactiveReason)
    : null;
}

/** Map a stored row to the host-facing state. */
export function resolvePropertyLifecycleState(row: {
  status: string | null;
  inactive_reason: string | null;
}): PropertyLifecycleState {
  if (String(row.status ?? '').toUpperCase() === 'ACTIVE') return 'live';
  switch (asPropertyInactiveReason(row.inactive_reason)) {
    case 'paused':
      return 'paused';
    case 'archived':
      return 'archived';
    case 'pending_verification':
      return 'pending_verification';
    case 'contract_lapsed':
    case 'consideration_denied':
    case 'succession':
      return 'suspended';
    default:
      // Unknown reason on an inactive row: the safest closed state is archived.
      return 'archived';
  }
}

export type PropertyAutomationJob =
  | 'booking_email'
  | 'sd_refund'
  | 'cancellation_refund'
  | 'review_lifecycle'
  | 'ical_import'
  | 'ical_export'
  | 'smart_pricing'
  | 'meta_scheduled_post'
  | 'telegram_digest'
  | 'inbox_ai_auto_reply'
  | 'voice_receptionist';

const ALWAYS_ON_JOBS: ReadonlySet<PropertyAutomationJob> = new Set([
  'booking_email',
  'sd_refund',
  'cancellation_refund',
  // Reviews for completed stays keep running so guests can still leave them.
  'review_lifecycle',
]);

/**
 * The single automation matrix from the plan (§4.6). Paused keeps everything on; suspended
 * and archived stop every operational job. Money and review jobs always run.
 */
export function automationAllowed(
  state: PropertyLifecycleState,
  job: PropertyAutomationJob
): boolean {
  if (state === 'live' || state === 'paused') return true;
  if (ALWAYS_ON_JOBS.has(job)) return true;
  return false;
}

/** Only a live listing may appear in new-booking surfaces. */
export function stateAcceptsNewBookings(state: PropertyLifecycleState): boolean {
  return state === 'live';
}

/** The public page stays up for a paused listing so shared links and QR codes keep working. */
export function stateHasPublicPage(state: PropertyLifecycleState): boolean {
  return state === 'live' || state === 'paused';
}
