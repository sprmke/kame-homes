import type { BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';

/**
 * Booking statuses where the SD refund form link can be sent to a guest.
 * The form opens after check-out. COMPLETED stays included so the host can
 * resend the link after the stay was settled.
 */
export const SD_REFUND_LINK_STATUSES = [
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
] as const satisfies readonly BookingStatus[];

/** Guest review is offered from check-out through SD refund, and after completion. */
export const GUEST_REVIEW_LINK_STATUSES = [
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
] as const satisfies readonly BookingStatus[];

const SD_REFUND_LINK_STATUS_SET: ReadonlySet<string> = new Set(SD_REFUND_LINK_STATUSES);
const GUEST_REVIEW_LINK_STATUS_SET: ReadonlySet<string> = new Set(GUEST_REVIEW_LINK_STATUSES);

export function isSdRefundLinkEligible(status: string | null | undefined): boolean {
  return SD_REFUND_LINK_STATUS_SET.has(String(status ?? '').trim());
}

export function isGuestReviewLinkEligible(status: string | null | undefined): boolean {
  return GUEST_REVIEW_LINK_STATUS_SET.has(String(status ?? '').trim());
}
