import { describe, expect, it } from 'vitest';

import {
  computeGuestFormPaymentBreakdown,
  DEFAULT_GUEST_DOWN_PAYMENT,
} from '@/features/guest/form/lib/guestFormPayment';

const sevenNights = { checkInDate: '2026-10-22', checkOutDate: '2026-10-29' };

describe('computeGuestFormPaymentBreakdown', () => {
  it('uses the property down payment as a flat amount, not per night', () => {
    const breakdown = computeGuestFormPaymentBreakdown(sevenNights, 1500);
    expect(breakdown.stayNights).toBe(7);
    expect(breakdown.downPayment).toBe(1500);
    expect(breakdown.total).toBe(1500);
  });

  it('follows each property setting', () => {
    expect(computeGuestFormPaymentBreakdown(sevenNights, 3000).total).toBe(3000);
    expect(computeGuestFormPaymentBreakdown(sevenNights, 0).total).toBe(0);
  });

  it('falls back to the server default when the setting is missing or invalid', () => {
    for (const value of [null, undefined, Number.NaN, -1]) {
      expect(computeGuestFormPaymentBreakdown(sevenNights, value).total).toBe(
        DEFAULT_GUEST_DOWN_PAYMENT
      );
    }
  });
});
