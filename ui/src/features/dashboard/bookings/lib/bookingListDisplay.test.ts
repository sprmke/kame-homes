import { describe, expect, it } from 'vitest';

import { bookingListDisplayName } from '@/features/dashboard/bookings/lib/bookingListDisplay';

describe('bookingListDisplayName', () => {

  it('bookingListDisplayName is exported', () => {
    expect(typeof bookingListDisplayName).toBe('function');
  });

});
