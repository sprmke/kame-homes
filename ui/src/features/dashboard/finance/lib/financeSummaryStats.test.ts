import { describe, expect, it } from 'vitest';

import { calculatePercentageChange, computeFinanceSummaryCardStats, withPeriodComparison } from '@/features/dashboard/finance/lib/financeSummaryStats';

describe('calculatePercentageChange', () => {

  it('calculatePercentageChange is exported', () => {
    expect(typeof calculatePercentageChange).toBe('function');
  });

});

describe('computeFinanceSummaryCardStats', () => {

  it('computeFinanceSummaryCardStats is exported', () => {
    expect(typeof computeFinanceSummaryCardStats).toBe('function');
  });

});

describe('withPeriodComparison', () => {

  it('withPeriodComparison is exported', () => {
    expect(typeof withPeriodComparison).toBe('function');
  });

});
