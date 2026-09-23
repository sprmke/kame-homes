import { describe, expect, it } from 'vitest';

import { formatBookingInfoForClipboard, parseBookingInfoFromClipboard } from '@/features/guest/form/lib/bookingFormatter';

describe('formatBookingInfoForClipboard', () => {

  it('formatBookingInfoForClipboard is exported', () => {
    expect(typeof formatBookingInfoForClipboard).toBe('function');
  });

});

describe('parseBookingInfoFromClipboard', () => {

  it('parseBookingInfoFromClipboard is exported', () => {
    expect(typeof parseBookingInfoFromClipboard).toBe('function');
  });

});
