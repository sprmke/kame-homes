import { describe, expect, it } from 'vitest';

import { orgParkingTypeLabel, orgParkingTypeIcon, orgParkingStatsOrEmpty, orgParkingResidenceLine, orgParkingAddressLine, orgParkingLocationLine, orgParkingSearchHaystack, ORG_PARKING_TYPES } from '@/features/dashboard/org/lib/orgParkingDisplay';

describe('orgParkingTypeLabel', () => {

  it('orgParkingTypeLabel is exported', () => {
    expect(typeof orgParkingTypeLabel).toBe('function');
  });

});

describe('orgParkingTypeIcon', () => {

  it('orgParkingTypeIcon is exported', () => {
    expect(typeof orgParkingTypeIcon).toBe('function');
  });

});

describe('orgParkingStatsOrEmpty', () => {

  it('orgParkingStatsOrEmpty is exported', () => {
    expect(typeof orgParkingStatsOrEmpty).toBe('function');
  });

});

describe('orgParkingResidenceLine', () => {

  it('orgParkingResidenceLine is exported', () => {
    expect(typeof orgParkingResidenceLine).toBe('function');
  });

});

describe('orgParkingAddressLine', () => {

  it('orgParkingAddressLine is exported', () => {
    expect(typeof orgParkingAddressLine).toBe('function');
  });

});

describe('orgParkingLocationLine', () => {

  it('orgParkingLocationLine is exported', () => {
    expect(typeof orgParkingLocationLine).toBe('function');
  });

});

describe('orgParkingSearchHaystack', () => {

  it('orgParkingSearchHaystack is exported', () => {
    expect(typeof orgParkingSearchHaystack).toBe('function');
  });

});

describe('ORG_PARKING_TYPES', () => {
  it('is defined', () => {
    expect(ORG_PARKING_TYPES).toBeDefined();
  });
});
