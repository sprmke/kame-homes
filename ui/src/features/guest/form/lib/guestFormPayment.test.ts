import { describe, expect, it } from 'vitest';

import { computeGuestFormPaymentBreakdown, GUEST_DOWN_PAYMENT_RATE_PER_NIGHT } from '@/features/guest/form/lib/guestFormPayment';

describe('computeGuestFormPaymentBreakdown', () => {

  it('computeGuestFormPaymentBreakdown is exported', () => {
    expect(typeof computeGuestFormPaymentBreakdown).toBe('function');
  });

});

describe('GUEST_DOWN_PAYMENT_RATE_PER_NIGHT', () => {
  it('is defined', () => {
    expect(GUEST_DOWN_PAYMENT_RATE_PER_NIGHT).toBeDefined();
  });
});
