import { describe, expect, it } from 'vitest';

import { feesFromPricingDefaults, pricingPatchFromUiState, DEFAULT_WEEKDAY_NIGHTLY_RATE, DEFAULT_WEEKEND_NIGHTLY_RATE, DEFAULT_DOWN_PAYMENT, DEFAULT_SECURITY_DEPOSIT, DEFAULT_PET_FEE, DEFAULT_PARKING_GUEST_FEE, DEFAULT_GUEST_ADDITIONAL_FEE } from '@/features/dashboard/pricing/lib/pricingDefaults';

describe('feesFromPricingDefaults', () => {

  it('feesFromPricingDefaults is exported', () => {
    expect(typeof feesFromPricingDefaults).toBe('function');
  });

});

describe('pricingPatchFromUiState', () => {

  it('pricingPatchFromUiState is exported', () => {
    expect(typeof pricingPatchFromUiState).toBe('function');
  });

});

describe('DEFAULT_WEEKDAY_NIGHTLY_RATE', () => {
  it('is defined', () => {
    expect(DEFAULT_WEEKDAY_NIGHTLY_RATE).toBeDefined();
  });
});

describe('DEFAULT_WEEKEND_NIGHTLY_RATE', () => {
  it('is defined', () => {
    expect(DEFAULT_WEEKEND_NIGHTLY_RATE).toBeDefined();
  });
});

describe('DEFAULT_DOWN_PAYMENT', () => {
  it('is defined', () => {
    expect(DEFAULT_DOWN_PAYMENT).toBeDefined();
  });
});

describe('DEFAULT_SECURITY_DEPOSIT', () => {
  it('is defined', () => {
    expect(DEFAULT_SECURITY_DEPOSIT).toBeDefined();
  });
});

describe('DEFAULT_PET_FEE', () => {
  it('is defined', () => {
    expect(DEFAULT_PET_FEE).toBeDefined();
  });
});

describe('DEFAULT_PARKING_GUEST_FEE', () => {
  it('is defined', () => {
    expect(DEFAULT_PARKING_GUEST_FEE).toBeDefined();
  });
});

describe('DEFAULT_GUEST_ADDITIONAL_FEE', () => {
  it('is defined', () => {
    expect(DEFAULT_GUEST_ADDITIONAL_FEE).toBeDefined();
  });
});
