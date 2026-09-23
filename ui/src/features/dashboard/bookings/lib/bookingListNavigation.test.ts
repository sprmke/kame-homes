import { describe, expect, it } from 'vitest';

import { resolveBookingListHref, resolveBookingPropertySlug } from '@/features/dashboard/bookings/lib/bookingListNavigation';

describe('resolveBookingListHref', () => {

  it('resolveBookingListHref is exported', () => {
    expect(typeof resolveBookingListHref).toBe('function');
  });

});

describe('resolveBookingPropertySlug', () => {

  it('resolveBookingPropertySlug is exported', () => {
    expect(typeof resolveBookingPropertySlug).toBe('function');
  });

});
