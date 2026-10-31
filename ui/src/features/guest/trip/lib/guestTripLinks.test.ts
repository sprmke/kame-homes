import { describe, expect, it } from 'vitest';

import { guestTripDirectionsUrl, isExternalHref } from '@/features/guest/trip/lib/guestTripLinks';

describe('guestTripDirectionsUrl', () => {
  it('prefers the listing maps URL', () => {
    expect(
      guestTripDirectionsUrl({ mapsUrl: 'https://maps.app/x', latitude: 1, longitude: 2 })
    ).toBe('https://maps.app/x');
  });

  it('falls back to coordinates, then the address', () => {
    expect(guestTripDirectionsUrl({ latitude: 15.03, longitude: 120.68 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=15.03,120.68'
    );
    expect(guestTripDirectionsUrl({ address: 'Azure North, San Fernando' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=Azure%20North%2C%20San%20Fernando'
    );
    expect(guestTripDirectionsUrl({})).toBeNull();
  });
});

describe('isExternalHref', () => {
  it('treats http, tel and mailto as external and app paths as internal', () => {
    expect(isExternalHref('https://x.test')).toBe(true);
    expect(isExternalHref('tel:0917')).toBe(true);
    expect(isExternalHref('mailto:a@b.c')).toBe(true);
    expect(isExternalHref('/properties/x/trip')).toBe(false);
  });
});
