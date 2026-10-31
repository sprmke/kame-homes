import { describe, expect, it } from 'vitest';

import {
  bookingHasInvalidReceiptAi,
  bookingRequestsSurpriseDecor,
} from '@/features/dashboard/bookings/lib/bookingFlags';

describe('bookingFlags', () => {
  it('detects surprise decor from bool or string', () => {
    expect(bookingRequestsSurpriseDecor(true)).toBe(true);
    expect(bookingRequestsSurpriseDecor('true')).toBe(true);
    expect(bookingRequestsSurpriseDecor(false)).toBe(false);
  });

  it('flags invalid AI verdict when receipt URL exists', () => {
    expect(
      bookingHasInvalidReceiptAi({
        payment_receipt_url: 'https://x/r.jpg',
        dp_receipt_ai_verdict: 'invalid',
      })
    ).toBe(true);

    expect(
      bookingHasInvalidReceiptAi({
        payment_receipt_url: 'https://x/r.jpg',
        dp_receipt_ai_verdict: 'valid',
      })
    ).toBe(false);
  });
});
