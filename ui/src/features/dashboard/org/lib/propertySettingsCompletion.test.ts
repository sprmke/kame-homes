import { describe, expect, it } from 'vitest';

import { computePropertySettingsCompletion, MIN_PROPERTY_PHOTOS, MIN_PROPERTY_AMENITIES } from '@/features/dashboard/org/lib/propertySettingsCompletion';

describe('computePropertySettingsCompletion', () => {

  it('computePropertySettingsCompletion is exported', () => {
    expect(typeof computePropertySettingsCompletion).toBe('function');
  });

});

describe('MIN_PROPERTY_PHOTOS', () => {
  it('is defined', () => {
    expect(MIN_PROPERTY_PHOTOS).toBeDefined();
  });
});

describe('MIN_PROPERTY_AMENITIES', () => {
  it('is defined', () => {
    expect(MIN_PROPERTY_AMENITIES).toBeDefined();
  });
});
