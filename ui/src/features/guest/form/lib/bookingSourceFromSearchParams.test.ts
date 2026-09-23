import { describe, expect, it } from 'vitest';

import { normalizeBookingSource, bookingSourceFromUrlSearchParams, hasStrippedGuestQueryKeys, stripLegacyFromQueryParam, BOOKING_SOURCE_OPTIONS, STRIPPED_GUEST_QUERY_KEYS } from '@/features/guest/form/lib/bookingSourceFromSearchParams';

describe('normalizeBookingSource', () => {

  it('normalizeBookingSource is exported', () => {
    expect(typeof normalizeBookingSource).toBe('function');
  });

});

describe('bookingSourceFromUrlSearchParams', () => {

  it('bookingSourceFromUrlSearchParams is exported', () => {
    expect(typeof bookingSourceFromUrlSearchParams).toBe('function');
  });

});

describe('hasStrippedGuestQueryKeys', () => {

  it('hasStrippedGuestQueryKeys is exported', () => {
    expect(typeof hasStrippedGuestQueryKeys).toBe('function');
  });

});

describe('stripLegacyFromQueryParam', () => {

  it('stripLegacyFromQueryParam is exported', () => {
    expect(typeof stripLegacyFromQueryParam).toBe('function');
  });

});

describe('BOOKING_SOURCE_OPTIONS', () => {
  it('is defined', () => {
    expect(BOOKING_SOURCE_OPTIONS).toBeDefined();
  });
});

describe('STRIPPED_GUEST_QUERY_KEYS', () => {
  it('is defined', () => {
    expect(STRIPPED_GUEST_QUERY_KEYS).toBeDefined();
  });
});
