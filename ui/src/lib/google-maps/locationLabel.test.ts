import { describe, expect, it } from 'vitest';

import { parseGoogleAddressComponents, locationLabelFromPlace, locationLabelFromGooglePlace } from '@/lib/google-maps/locationLabel';

describe('parseGoogleAddressComponents', () => {

  it('parseGoogleAddressComponents is exported', () => {
    expect(typeof parseGoogleAddressComponents).toBe('function');
  });

});

describe('locationLabelFromPlace', () => {

  it('locationLabelFromPlace is exported', () => {
    expect(typeof locationLabelFromPlace).toBe('function');
  });

});

describe('locationLabelFromGooglePlace', () => {

  it('locationLabelFromGooglePlace is exported', () => {
    expect(typeof locationLabelFromGooglePlace).toBe('function');
  });

});
