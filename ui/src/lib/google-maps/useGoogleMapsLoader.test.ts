import { describe, expect, it } from 'vitest';

import { getGoogleMapsApiKey, useGoogleMapsLoader, GOOGLE_MAPS_LIBRARIES_FULL, GOOGLE_MAPS_LIBRARIES_PLACES } from '@/lib/google-maps/useGoogleMapsLoader';

describe('getGoogleMapsApiKey', () => {

  it('getGoogleMapsApiKey is exported', () => {
    expect(typeof getGoogleMapsApiKey).toBe('function');
  });

});

describe('useGoogleMapsLoader', () => {

  it('useGoogleMapsLoader is exported', () => {
    expect(typeof useGoogleMapsLoader).toBe('function');
  });

});

describe('GOOGLE_MAPS_LIBRARIES_FULL', () => {
  it('is defined', () => {
    expect(GOOGLE_MAPS_LIBRARIES_FULL).toBeDefined();
  });
});

describe('GOOGLE_MAPS_LIBRARIES_PLACES', () => {
  it('is defined', () => {
    expect(GOOGLE_MAPS_LIBRARIES_PLACES).toBeDefined();
  });
});
