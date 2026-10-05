import { describe, expect, it } from 'vitest';

import {
  showsTowerFilter,
  countActiveParkingFilters,
  locationsFromLegacyTypeParam,
  PARKING_PRICE_RANGE_OPTIONS,
} from '@/features/guest/marketing/developments/lib/parkingSlotFilters';

describe('showsTowerFilter', () => {
  it('showsTowerFilter is exported', () => {
    expect(typeof showsTowerFilter).toBe('function');
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
