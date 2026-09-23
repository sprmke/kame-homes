import { describe, expect, it } from 'vitest';

import { bookingsSortButtonLabel } from '@/features/dashboard/bookings/lib/bookingsSortOptions';

describe('bookingsSortButtonLabel', () => {

  it('bookingsSortButtonLabel is exported', () => {
    expect(typeof bookingsSortButtonLabel).toBe('function');
  });

});
