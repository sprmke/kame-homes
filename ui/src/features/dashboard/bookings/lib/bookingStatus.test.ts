import { describe, expect, it } from 'vitest';

import {
  BOOKING_STATUSES,
  canCancelBookingAtStatus,
  canGuestPublicUpdateForm,
  isStayGuideEligibleStatus,
  STATUS_LABELS,
  STATUS_TONE,
  TERMINAL_STATUSES,
} from '@/features/dashboard/bookings/lib/bookingStatus';

describe('bookingStatus', () => {
  it('defines label and tone for every status', () => {
    for (const status of BOOKING_STATUSES) {
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0);
      expect(STATUS_TONE[status]).toBeTruthy();
    }
  });

  it('guest form updates only in pending review', () => {
    expect(canGuestPublicUpdateForm('PENDING_REVIEW')).toBe(true);
    expect(canGuestPublicUpdateForm('READY_FOR_CHECKIN')).toBe(false);
  });

  it('stay guide eligible statuses', () => {
    expect(isStayGuideEligibleStatus('READY_FOR_CHECKIN')).toBe(true);
    expect(isStayGuideEligibleStatus('PENDING_REVIEW')).toBe(false);
  });

  it('cancel allowed before check-out stage', () => {
    expect(canCancelBookingAtStatus('READY_FOR_CHECKIN')).toBe(true);
    expect(canCancelBookingAtStatus('READY_FOR_CHECKOUT')).toBe(false);
    expect(canCancelBookingAtStatus('COMPLETED')).toBe(false);
  });

  it('terminal statuses are completed and cancelled', () => {
    expect(TERMINAL_STATUSES.has('COMPLETED')).toBe(true);
    expect(TERMINAL_STATUSES.has('CANCELLED')).toBe(true);
    expect(TERMINAL_STATUSES.has('PENDING_REVIEW')).toBe(false);
  });
});
