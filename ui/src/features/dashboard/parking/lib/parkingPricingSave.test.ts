import { describe, expect, it } from 'vitest';

import { dateOverridesRecordFromMap, parkingPricingBaselineFromDto, parkingPricingFormHasBaseRateChanges, buildParkingPricingSavePatch } from '@/features/dashboard/parking/lib/parkingPricingSave';

describe('dateOverridesRecordFromMap', () => {

  it('dateOverridesRecordFromMap is exported', () => {
    expect(typeof dateOverridesRecordFromMap).toBe('function');
  });

});

describe('parkingPricingBaselineFromDto', () => {

  it('parkingPricingBaselineFromDto is exported', () => {
    expect(typeof parkingPricingBaselineFromDto).toBe('function');
  });

});

describe('parkingPricingFormHasBaseRateChanges', () => {

  it('parkingPricingFormHasBaseRateChanges is exported', () => {
    expect(typeof parkingPricingFormHasBaseRateChanges).toBe('function');
  });

});

describe('buildParkingPricingSavePatch', () => {

  it('buildParkingPricingSavePatch is exported', () => {
    expect(typeof buildParkingPricingSavePatch).toBe('function');
  });

});
