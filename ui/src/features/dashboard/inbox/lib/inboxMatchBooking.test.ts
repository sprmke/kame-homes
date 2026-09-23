import { describe, expect, it } from 'vitest';

import { bookingNamesMatch, matchBookingForConversation } from '@/features/dashboard/inbox/lib/inboxMatchBooking';

describe('bookingNamesMatch', () => {

  it('bookingNamesMatch is exported', () => {
    expect(typeof bookingNamesMatch).toBe('function');
  });

});

describe('matchBookingForConversation', () => {

  it('matchBookingForConversation is exported', () => {
    expect(typeof matchBookingForConversation).toBe('function');
  });

});
