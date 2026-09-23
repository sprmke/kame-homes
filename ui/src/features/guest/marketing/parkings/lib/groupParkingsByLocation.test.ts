import { describe, expect, it } from 'vitest';

import { findCityByLocationSlug, filterParkingEntriesByLocationSlug, groupParkingsByLocation } from '@/features/guest/marketing/parkings/lib/groupParkingsByLocation';

describe('findCityByLocationSlug', () => {

  it('findCityByLocationSlug is exported', () => {
    expect(typeof findCityByLocationSlug).toBe('function');
  });

});

describe('filterParkingEntriesByLocationSlug', () => {

  it('filterParkingEntriesByLocationSlug is exported', () => {
    expect(typeof filterParkingEntriesByLocationSlug).toBe('function');
  });

});

describe('groupParkingsByLocation', () => {

  it('groupParkingsByLocation is exported', () => {
    expect(typeof groupParkingsByLocation).toBe('function');
  });

});
