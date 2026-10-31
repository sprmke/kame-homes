/** Shared parking E2E copy — guest, host, and property booking surfaces stay aligned. */

export type ParkingFlowStatus =
  | 'PENDING_HOST_ACCEPTANCE'
  | 'PENDING_PAYMENT'
  | 'PENDING_REVIEW'
  | 'READY_FOR_CHECKIN'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_HOST_AVAILABLE';

/** Short badge label (lists, chips). */
export const PARKING_STATUS_BADGE: Record<ParkingFlowStatus, string> = {
  PENDING_HOST_ACCEPTANCE: 'Finding host',
  PENDING_PAYMENT: 'Awaiting payment',
  PENDING_REVIEW: 'Confirmed',
  READY_FOR_CHECKIN: 'Ready',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_HOST_AVAILABLE: 'No host',
};

/** Guest status page — one headline (no badge + headline duplicates). */
export const PARKING_STATUS_GUEST: Record<
  ParkingFlowStatus,
  { badge: string; headline: string; detail?: string; tone: 'waiting' | 'accepted' | 'ended' }
> = {
  PENDING_HOST_ACCEPTANCE: {
    badge: 'Finding host',
    headline: 'Finding a host',
    detail: 'We’ll email you when it’s time to pay.',
    tone: 'waiting',
  },
  PENDING_PAYMENT: {
    badge: 'Payment due',
    headline: 'Pay to confirm',
    detail: 'A host accepted. Confirm before the timer ends.',
    tone: 'waiting',
  },
  PENDING_REVIEW: {
    badge: 'Confirmed',
    headline: 'Parking confirmed',
    tone: 'accepted',
  },
  READY_FOR_CHECKIN: {
    badge: 'Ready',
    headline: 'Ready for check-in',
    tone: 'accepted',
  },
  COMPLETED: {
    badge: 'Completed',
    headline: 'Stay completed',
    tone: 'accepted',
  },
  CANCELLED: {
    badge: 'Cancelled',
    headline: 'Request cancelled',
    detail: 'Browse other listings if you still need parking.',
    tone: 'ended',
  },
  NO_HOST_AVAILABLE: {
    badge: 'No host',
    headline: 'No host available',
    detail: 'Try different dates or another listing.',
    tone: 'ended',
  },
};

/** Property booking parking panel — plain-language match status. */
export const PARKING_STATUS_PROPERTY: Record<ParkingFlowStatus, string> = {
  PENDING_HOST_ACCEPTANCE: 'Finding a parking host',
  PENDING_PAYMENT: 'Waiting for guest payment',
  PENDING_REVIEW: 'Paid. Finalizing',
  READY_FOR_CHECKIN: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_HOST_AVAILABLE: 'No host was available',
};

/** Host booking detail — context lines for non-actionable states. */
export const PARKING_HOST_STATUS_NOTE: Partial<Record<ParkingFlowStatus, string>> = {
  PENDING_PAYMENT: 'Guest must pay before this booking is confirmed.',
  PENDING_REVIEW: 'Payment received. Endorsement sends automatically.',
  READY_FOR_CHECKIN: 'Guest is confirmed for these dates.',
  NO_HOST_AVAILABLE: 'Every eligible host declined or timed out.',
  CANCELLED: 'This request was cancelled.',
};

export function parkingStatusBadge(status: string): string {
  return PARKING_STATUS_BADGE[status as ParkingFlowStatus] ?? status;
}

export function parkingStatusGuest(status: string) {
  return (
    PARKING_STATUS_GUEST[status as ParkingFlowStatus] ?? {
      badge: status,
      headline: status,
      tone: 'ended' as const,
    }
  );
}

export function parkingStatusProperty(status: string): string {
  return PARKING_STATUS_PROPERTY[status as ParkingFlowStatus] ?? status;
}
