import { describe, expect, it } from 'vitest';

import { parseFinanceQueryFromParams, writeFinanceQueryToParams, financeQueryToApiParams, ledgerSortToBookingsApiSort, previousFinancePeriodRange, isoDateInManila, bookingDateForPeriod, FINANCE_CHART_BOOKINGS_LIMIT, rangeForPreset, detectPreset } from '@/features/dashboard/finance/lib/financePeriod';

describe('parseFinanceQueryFromParams', () => {

  it('parseFinanceQueryFromParams is exported', () => {
    expect(typeof parseFinanceQueryFromParams).toBe('function');
  });

});

describe('writeFinanceQueryToParams', () => {

  it('writeFinanceQueryToParams is exported', () => {
    expect(typeof writeFinanceQueryToParams).toBe('function');
  });

});

describe('financeQueryToApiParams', () => {

  it('financeQueryToApiParams is exported', () => {
    expect(typeof financeQueryToApiParams).toBe('function');
  });

});

describe('ledgerSortToBookingsApiSort', () => {

  it('ledgerSortToBookingsApiSort is exported', () => {
    expect(typeof ledgerSortToBookingsApiSort).toBe('function');
  });

});

describe('previousFinancePeriodRange', () => {

  it('previousFinancePeriodRange is exported', () => {
    expect(typeof previousFinancePeriodRange).toBe('function');
  });

});

describe('isoDateInManila', () => {

  it('isoDateInManila is exported', () => {
    expect(typeof isoDateInManila).toBe('function');
  });

});

describe('bookingDateForPeriod', () => {

  it('bookingDateForPeriod is exported', () => {
    expect(typeof bookingDateForPeriod).toBe('function');
  });

});

describe('FINANCE_CHART_BOOKINGS_LIMIT', () => {
  it('is defined', () => {
    expect(FINANCE_CHART_BOOKINGS_LIMIT).toBeDefined();
  });
});

describe('rangeForPreset', () => {
  it('is defined', () => {
    expect(rangeForPreset).toBeDefined();
  });
});

describe('detectPreset', () => {
  it('is defined', () => {
    expect(detectPreset).toBeDefined();
  });
});
