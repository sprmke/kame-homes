import { describe, expect, it } from 'vitest';

import { bookingGuestName, bookingStayRange, bookingSearchHaystack } from '@/features/dashboard/inbox/lib/inboxShareBookingItems';

describe('bookingGuestName', () => {

  it('bookingGuestName is exported', () => {
    expect(typeof bookingGuestName).toBe('function');
  });

});

describe('bookingStayRange', () => {

  it('bookingStayRange is exported', () => {
    expect(typeof bookingStayRange).toBe('function');
  });

});

describe('bookingSearchHaystack', () => {

  it('bookingSearchHaystack is exported', () => {
    expect(typeof bookingSearchHaystack).toBe('function');
  });

});
