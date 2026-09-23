import { describe, expect, it } from 'vitest';

import { dashboardTransactionMaxRows, buildDashboardTransactionRows, countDashboardDueInPeriod, countDashboardRecurringInPeriod } from '@/features/dashboard/property/lib/dashboardFinanceTransactions';

describe('dashboardTransactionMaxRows', () => {

  it('dashboardTransactionMaxRows is exported', () => {
    expect(typeof dashboardTransactionMaxRows).toBe('function');
  });

});

describe('buildDashboardTransactionRows', () => {

  it('buildDashboardTransactionRows is exported', () => {
    expect(typeof buildDashboardTransactionRows).toBe('function');
  });

});

describe('countDashboardDueInPeriod', () => {

  it('countDashboardDueInPeriod is exported', () => {
    expect(typeof countDashboardDueInPeriod).toBe('function');
  });

});

describe('countDashboardRecurringInPeriod', () => {

  it('countDashboardRecurringInPeriod is exported', () => {
    expect(typeof countDashboardRecurringInPeriod).toBe('function');
  });

});
