import { describe, expect, it } from 'vitest';

import {
  GUEST_REVIEW_LINK_STATUSES,
  SD_REFUND_LINK_STATUSES,
  isGuestReviewLinkEligible,
  isSdRefundLinkEligible,
} from '@/features/dashboard/bookings/lib/guestShareLinkEligibility';

describe('guestShareLinkEligibility', () => {
  it('offers the SD refund link only before the refund is settled', () => {
    expect(SD_REFUND_LINK_STATUSES).toEqual(['READY_FOR_CHECKOUT', 'PENDING_SD_REFUND']);
    expect(isSdRefundLinkEligible('READY_FOR_CHECKOUT')).toBe(true);
    expect(isSdRefundLinkEligible('PENDING_SD_REFUND')).toBe(true);
    expect(isSdRefundLinkEligible('COMPLETED')).toBe(false);
    expect(isSdRefundLinkEligible('READY_FOR_CHECKIN')).toBe(false);
    expect(isSdRefundLinkEligible(null)).toBe(false);
  });

  it('offers the guest review link only before the refund is settled', () => {
    expect(GUEST_REVIEW_LINK_STATUSES).toEqual(['READY_FOR_CHECKOUT', 'PENDING_SD_REFUND']);
    expect(isGuestReviewLinkEligible('READY_FOR_CHECKOUT')).toBe(true);
    expect(isGuestReviewLinkEligible('PENDING_SD_REFUND')).toBe(true);
    expect(isGuestReviewLinkEligible('COMPLETED')).toBe(false);
    expect(isGuestReviewLinkEligible('CANCELLED')).toBe(false);
    expect(isGuestReviewLinkEligible(undefined)).toBe(false);
  });
});
