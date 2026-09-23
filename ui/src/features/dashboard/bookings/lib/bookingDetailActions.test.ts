import { describe, expect, it } from 'vitest';

import { buildBookingDetailActions } from '@/features/dashboard/bookings/lib/bookingDetailActions';

describe('buildBookingDetailActions', () => {

  it('buildBookingDetailActions is exported', () => {
    expect(typeof buildBookingDetailActions).toBe('function');
  });

});
