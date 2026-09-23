import { describe, expect, it } from 'vitest';

import { parkingPricingDefaultsFromDto, DEFAULT_PARKING_WEEKDAY_NIGHTLY_RATE, DEFAULT_PARKING_WEEKEND_NIGHTLY_RATE, STUB_GUEST_PARKING_RATE_WEEKDAY, STUB_GUEST_PARKING_RATE_WEEKEND, STUB_COMMISSION_PCT, STUB_DIRECT_COMMISSION_PCT } from '@/features/dashboard/parking/lib/parkingPricingDefaults';

describe('parkingPricingDefaultsFromDto', () => {

  it('parkingPricingDefaultsFromDto is exported', () => {
    expect(typeof parkingPricingDefaultsFromDto).toBe('function');
  });

});

describe('DEFAULT_PARKING_WEEKDAY_NIGHTLY_RATE', () => {
  it('is defined', () => {
    expect(DEFAULT_PARKING_WEEKDAY_NIGHTLY_RATE).toBeDefined();
  });
});

describe('DEFAULT_PARKING_WEEKEND_NIGHTLY_RATE', () => {
  it('is defined', () => {
    expect(DEFAULT_PARKING_WEEKEND_NIGHTLY_RATE).toBeDefined();
  });
});

describe('STUB_GUEST_PARKING_RATE_WEEKDAY', () => {
  it('is defined', () => {
    expect(STUB_GUEST_PARKING_RATE_WEEKDAY).toBeDefined();
  });
});

describe('STUB_GUEST_PARKING_RATE_WEEKEND', () => {
  it('is defined', () => {
    expect(STUB_GUEST_PARKING_RATE_WEEKEND).toBeDefined();
  });
});

describe('STUB_COMMISSION_PCT', () => {
  it('is defined', () => {
    expect(STUB_COMMISSION_PCT).toBeDefined();
  });
});

describe('STUB_DIRECT_COMMISSION_PCT', () => {
  it('is defined', () => {
    expect(STUB_DIRECT_COMMISSION_PCT).toBeDefined();
  });
});
