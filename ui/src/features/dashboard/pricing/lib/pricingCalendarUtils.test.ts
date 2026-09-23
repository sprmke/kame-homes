import { describe, expect, it } from 'vitest';

import { isWeekendRateDay, dateKey, mergeDateRateOverrides, contiguousDateRanges } from '@/features/dashboard/pricing/lib/pricingCalendarUtils';

describe('isWeekendRateDay', () => {

  it('isWeekendRateDay is exported', () => {
    expect(typeof isWeekendRateDay).toBe('function');
  });

});

describe('dateKey', () => {

  it('dateKey is exported', () => {
    expect(typeof dateKey).toBe('function');
  });

});

describe('mergeDateRateOverrides', () => {

  it('mergeDateRateOverrides is exported', () => {
    expect(typeof mergeDateRateOverrides).toBe('function');
  });

});

describe('contiguousDateRanges', () => {

  it('contiguousDateRanges is exported', () => {
    expect(typeof contiguousDateRanges).toBe('function');
  });

});
