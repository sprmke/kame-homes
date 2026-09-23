import { describe, expect, it } from 'vitest';

import { parkingPresetFeatureName, resolveParkingFeatureLabels, parkingFeaturesDraftFromSettings, parkingFeaturesDraftIsDirty, parkingFeaturesSettingsPatch, PARKING_AMENITY_CATEGORY_ID, CUSTOM_PARKING_AMENITY_MAX_LENGTH } from '@/features/dashboard/parking/lib/parkingFeaturesConstants';

describe('parkingPresetFeatureName', () => {

  it('parkingPresetFeatureName is exported', () => {
    expect(typeof parkingPresetFeatureName).toBe('function');
  });

});

describe('resolveParkingFeatureLabels', () => {

  it('resolveParkingFeatureLabels is exported', () => {
    expect(typeof resolveParkingFeatureLabels).toBe('function');
  });

});

describe('parkingFeaturesDraftFromSettings', () => {

  it('parkingFeaturesDraftFromSettings is exported', () => {
    expect(typeof parkingFeaturesDraftFromSettings).toBe('function');
  });

});

describe('parkingFeaturesDraftIsDirty', () => {

  it('parkingFeaturesDraftIsDirty is exported', () => {
    expect(typeof parkingFeaturesDraftIsDirty).toBe('function');
  });

});

describe('parkingFeaturesSettingsPatch', () => {

  it('parkingFeaturesSettingsPatch is exported', () => {
    expect(typeof parkingFeaturesSettingsPatch).toBe('function');
  });

});

describe('PARKING_AMENITY_CATEGORY_ID', () => {
  it('is defined', () => {
    expect(PARKING_AMENITY_CATEGORY_ID).toBeDefined();
  });
});

describe('CUSTOM_PARKING_AMENITY_MAX_LENGTH', () => {
  it('is defined', () => {
    expect(CUSTOM_PARKING_AMENITY_MAX_LENGTH).toBeDefined();
  });
});
