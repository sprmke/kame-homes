import { describe, expect, it } from 'vitest';

import { getPropertyResidenceNames, isKnownResidence, getTowersForResidence, isTowerInResidence, isCondoPropertyType, ALL_PROPERTY_TOWERS, DEFAULT_PROPERTY_TOWER } from '@/features/dashboard/org/lib/propertyResidences';

describe('getPropertyResidenceNames', () => {

  it('getPropertyResidenceNames is exported', () => {
    expect(typeof getPropertyResidenceNames).toBe('function');
  });

});

describe('isKnownResidence', () => {

  it('isKnownResidence is exported', () => {
    expect(typeof isKnownResidence).toBe('function');
  });

});

describe('getTowersForResidence', () => {

  it('getTowersForResidence is exported', () => {
    expect(typeof getTowersForResidence).toBe('function');
  });

});

describe('isTowerInResidence', () => {

  it('isTowerInResidence is exported', () => {
    expect(typeof isTowerInResidence).toBe('function');
  });

});

describe('isCondoPropertyType', () => {

  it('isCondoPropertyType is exported', () => {
    expect(typeof isCondoPropertyType).toBe('function');
  });

});

describe('ALL_PROPERTY_TOWERS', () => {
  it('is defined', () => {
    expect(ALL_PROPERTY_TOWERS).toBeDefined();
  });
});

describe('DEFAULT_PROPERTY_TOWER', () => {
  it('is defined', () => {
    expect(DEFAULT_PROPERTY_TOWER).toBeDefined();
  });
});
