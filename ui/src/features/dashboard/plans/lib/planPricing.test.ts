import { describe, expect, it } from 'vitest';

import { normalizePlanDiscountPercent, discountedPlanPricePhp, normalizeVolumeRampFloorPhp, normalizeVolumeRampAtCount, normalizeVolumeDiscountTiers, resolveVolumeDiscountPercent, resolveRampEffectivePerPropertyPhp, computeOrgSubscriptionTotalPhp, DEFAULT_VOLUME_RAMP_FLOOR_PHP, DEFAULT_VOLUME_RAMP_AT_COUNT, ORG_VOLUME_RAMP_FLOOR_PHP, ORG_VOLUME_RAMP_AT_COUNT } from '@/features/dashboard/plans/lib/planPricing';

describe('normalizePlanDiscountPercent', () => {

  it('normalizePlanDiscountPercent is exported', () => {
    expect(typeof normalizePlanDiscountPercent).toBe('function');
  });

});

describe('discountedPlanPricePhp', () => {

  it('discountedPlanPricePhp is exported', () => {
    expect(typeof discountedPlanPricePhp).toBe('function');
  });

});

describe('normalizeVolumeRampFloorPhp', () => {

  it('normalizeVolumeRampFloorPhp is exported', () => {
    expect(typeof normalizeVolumeRampFloorPhp).toBe('function');
  });

});

describe('normalizeVolumeRampAtCount', () => {

  it('normalizeVolumeRampAtCount is exported', () => {
    expect(typeof normalizeVolumeRampAtCount).toBe('function');
  });

});

describe('normalizeVolumeDiscountTiers', () => {

  it('normalizeVolumeDiscountTiers is exported', () => {
    expect(typeof normalizeVolumeDiscountTiers).toBe('function');
  });

});

describe('resolveVolumeDiscountPercent', () => {

  it('resolveVolumeDiscountPercent is exported', () => {
    expect(typeof resolveVolumeDiscountPercent).toBe('function');
  });

});

describe('resolveRampEffectivePerPropertyPhp', () => {

  it('resolveRampEffectivePerPropertyPhp is exported', () => {
    expect(typeof resolveRampEffectivePerPropertyPhp).toBe('function');
  });

});

describe('computeOrgSubscriptionTotalPhp', () => {

  it('computeOrgSubscriptionTotalPhp is exported', () => {
    expect(typeof computeOrgSubscriptionTotalPhp).toBe('function');
  });

});

describe('DEFAULT_VOLUME_RAMP_FLOOR_PHP', () => {
  it('is defined', () => {
    expect(DEFAULT_VOLUME_RAMP_FLOOR_PHP).toBeDefined();
  });
});

describe('DEFAULT_VOLUME_RAMP_AT_COUNT', () => {
  it('is defined', () => {
    expect(DEFAULT_VOLUME_RAMP_AT_COUNT).toBeDefined();
  });
});

describe('ORG_VOLUME_RAMP_FLOOR_PHP', () => {
  it('is defined', () => {
    expect(ORG_VOLUME_RAMP_FLOOR_PHP).toBeDefined();
  });
});

describe('ORG_VOLUME_RAMP_AT_COUNT', () => {
  it('is defined', () => {
    expect(ORG_VOLUME_RAMP_AT_COUNT).toBeDefined();
  });
});

