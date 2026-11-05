import { describe, expect, it } from 'vitest';

import {
  GUEST_REVIEW_LINK_STATUSES,
  SD_REFUND_LINK_STATUSES,
  isGuestReviewLinkEligible,
  isSdRefundLinkEligible,
} from '@/features/dashboard/bookings/lib/guestShareLinkEligibility';

describe('guestShareLinkEligibility', () => {
  it('offers the SD refund link from check-out through completion', () => {
    expect(SD_REFUND_LINK_STATUSES).toEqual([
      'READY_FOR_CHECKOUT',
      'PENDING_SD_REFUND',
      'COMPLETED',
    ]);
    expect(isSdRefundLinkEligible('READY_FOR_CHECKOUT')).toBe(true);
    expect(isSdRefundLinkEligible('PENDING_SD_REFUND')).toBe(true);
    expect(isSdRefundLinkEligible('COMPLETED')).toBe(true);
    expect(isSdRefundLinkEligible('READY_FOR_CHECKIN')).toBe(false);
    expect(isSdRefundLinkEligible(null)).toBe(false);
  });

  it('offers the guest review link from check-out through completion', () => {
    expect(GUEST_REVIEW_LINK_STATUSES).toEqual([
      'READY_FOR_CHECKOUT',
      'PENDING_SD_REFUND',
      'COMPLETED',
    ]);
    expect(isGuestReviewLinkEligible('READY_FOR_CHECKOUT')).toBe(true);
    expect(isGuestReviewLinkEligible('PENDING_SD_REFUND')).toBe(true);
    expect(isGuestReviewLinkEligible('COMPLETED')).toBe(true);
    expect(isGuestReviewLinkEligible('CANCELLED')).toBe(false);
    expect(isGuestReviewLinkEligible(undefined)).toBe(false);
  });
});
