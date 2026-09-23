import { describe, expect, it } from 'vitest';

import { combineFinanceCategoryBreakdown, buildFinanceChartData } from '@/features/dashboard/finance/lib/financeChartData';

describe('combineFinanceCategoryBreakdown', () => {

  it('combineFinanceCategoryBreakdown is exported', () => {
    expect(typeof combineFinanceCategoryBreakdown).toBe('function');
  });

});

describe('buildFinanceChartData', () => {

  it('buildFinanceChartData is exported', () => {
    expect(typeof buildFinanceChartData).toBe('function');
  });

});
