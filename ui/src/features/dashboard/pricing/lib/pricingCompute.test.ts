import { describe, expect, it } from 'vitest';

import { propertyPricingDefaultsFromDto, resolveHolidayRules, resolveNightlyRateForDate, computeDefaultBookingRate, resolveBookingRateTotal, resolveBookingNightlyForDate, resolveBookingAverageNightly } from '@/features/dashboard/pricing/lib/pricingCompute';

describe('propertyPricingDefaultsFromDto', () => {

  it('propertyPricingDefaultsFromDto is exported', () => {
    expect(typeof propertyPricingDefaultsFromDto).toBe('function');
  });

});

describe('resolveHolidayRules', () => {

  it('resolveHolidayRules is exported', () => {
    expect(typeof resolveHolidayRules).toBe('function');
  });

});

describe('resolveNightlyRateForDate', () => {

  it('resolveNightlyRateForDate is exported', () => {
    expect(typeof resolveNightlyRateForDate).toBe('function');
  });

});

describe('computeDefaultBookingRate', () => {

  it('computeDefaultBookingRate is exported', () => {
    expect(typeof computeDefaultBookingRate).toBe('function');
  });

});

describe('resolveBookingRateTotal', () => {

  it('resolveBookingRateTotal is exported', () => {
    expect(typeof resolveBookingRateTotal).toBe('function');
  });

});

describe('resolveBookingNightlyForDate', () => {

  it('resolveBookingNightlyForDate is exported', () => {
    expect(typeof resolveBookingNightlyForDate).toBe('function');
  });

});

describe('resolveBookingAverageNightly', () => {

  it('resolveBookingAverageNightly is exported', () => {
    expect(typeof resolveBookingAverageNightly).toBe('function');
  });

});
