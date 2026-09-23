import { describe, expect, it } from 'vitest';

import { uniqueTowersFromInsideSlots, showsTowerFilter, filterParkingSlots, sortParkingSlots, countActiveParkingFilters, locationsFromLegacyTypeParam, PARKING_PRICE_RANGE_OPTIONS } from '@/features/guest/marketing/developments/lib/parkingSlotFilters';

describe('uniqueTowersFromInsideSlots', () => {

  it('uniqueTowersFromInsideSlots is exported', () => {
    expect(typeof uniqueTowersFromInsideSlots).toBe('function');
  });

});

describe('showsTowerFilter', () => {

  it('showsTowerFilter is exported', () => {
    expect(typeof showsTowerFilter).toBe('function');
  });

});

describe('filterParkingSlots', () => {

  it('filterParkingSlots is exported', () => {
    expect(typeof filterParkingSlots).toBe('function');
  });

});

describe('sortParkingSlots', () => {

  it('sortParkingSlots is exported', () => {
    expect(typeof sortParkingSlots).toBe('function');
  });

});

describe('countActiveParkingFilters', () => {

  it('countActiveParkingFilters is exported', () => {
    expect(typeof countActiveParkingFilters).toBe('function');
  });

});

describe('locationsFromLegacyTypeParam', () => {

  it('locationsFromLegacyTypeParam is exported', () => {
    expect(typeof locationsFromLegacyTypeParam).toBe('function');
  });

});

describe('PARKING_PRICE_RANGE_OPTIONS', () => {
  it('is defined', () => {
    expect(PARKING_PRICE_RANGE_OPTIONS).toBeDefined();
  });
});
