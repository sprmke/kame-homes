import { describe, expect, it } from 'vitest';

import { resolveParkingNightlyRateForDate, computeParkingStayTotal } from '@/features/dashboard/parking/lib/parkingPricingCompute';

describe('resolveParkingNightlyRateForDate', () => {

  it('resolveParkingNightlyRateForDate is exported', () => {
    expect(typeof resolveParkingNightlyRateForDate).toBe('function');
  });

});

describe('computeParkingStayTotal', () => {

  it('computeParkingStayTotal is exported', () => {
    expect(typeof computeParkingStayTotal).toBe('function');
  });

});
