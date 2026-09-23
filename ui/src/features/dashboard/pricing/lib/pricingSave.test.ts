import { describe, expect, it } from 'vitest';

import { dateOverridesRecordFromMap, buildFeesOnlySavePatch, pricingBaselineFromDefaults, pricingFormHasBaseRateChanges, pricingFormHasFeeChanges, buildPricingSavePatch } from '@/features/dashboard/pricing/lib/pricingSave';

describe('dateOverridesRecordFromMap', () => {

  it('dateOverridesRecordFromMap is exported', () => {
    expect(typeof dateOverridesRecordFromMap).toBe('function');
  });

});

describe('buildFeesOnlySavePatch', () => {

  it('buildFeesOnlySavePatch is exported', () => {
    expect(typeof buildFeesOnlySavePatch).toBe('function');
  });

});

describe('pricingBaselineFromDefaults', () => {

  it('pricingBaselineFromDefaults is exported', () => {
    expect(typeof pricingBaselineFromDefaults).toBe('function');
  });

});

describe('pricingFormHasBaseRateChanges', () => {

  it('pricingFormHasBaseRateChanges is exported', () => {
    expect(typeof pricingFormHasBaseRateChanges).toBe('function');
  });

});

describe('pricingFormHasFeeChanges', () => {

  it('pricingFormHasFeeChanges is exported', () => {
    expect(typeof pricingFormHasFeeChanges).toBe('function');
  });

});

describe('buildPricingSavePatch', () => {

  it('buildPricingSavePatch is exported', () => {
    expect(typeof buildPricingSavePatch).toBe('function');
  });

});
