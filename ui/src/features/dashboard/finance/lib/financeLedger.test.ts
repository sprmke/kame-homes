import { describe, expect, it } from 'vitest';

import { stayLedgerStatus, transactionLedgerStatus, buildStayLedgerEntry, buildTransactionLedgerEntry, buildFinanceLedgerEntries, filterFinanceLedgerEntries, sortFinanceLedgerEntries, paginateFinanceLedgerEntries, collectLedgerCategories } from '@/features/dashboard/finance/lib/financeLedger';

describe('stayLedgerStatus', () => {

  it('stayLedgerStatus is exported', () => {
    expect(typeof stayLedgerStatus).toBe('function');
  });

});

describe('transactionLedgerStatus', () => {

  it('transactionLedgerStatus is exported', () => {
    expect(typeof transactionLedgerStatus).toBe('function');
  });

});

describe('buildStayLedgerEntry', () => {

  it('buildStayLedgerEntry is exported', () => {
    expect(typeof buildStayLedgerEntry).toBe('function');
  });

});

describe('buildTransactionLedgerEntry', () => {

  it('buildTransactionLedgerEntry is exported', () => {
    expect(typeof buildTransactionLedgerEntry).toBe('function');
  });

});

describe('buildFinanceLedgerEntries', () => {

  it('buildFinanceLedgerEntries is exported', () => {
    expect(typeof buildFinanceLedgerEntries).toBe('function');
  });

});

describe('filterFinanceLedgerEntries', () => {

  it('filterFinanceLedgerEntries is exported', () => {
    expect(typeof filterFinanceLedgerEntries).toBe('function');
  });

});

describe('sortFinanceLedgerEntries', () => {

  it('sortFinanceLedgerEntries is exported', () => {
    expect(typeof sortFinanceLedgerEntries).toBe('function');
  });

});

describe('paginateFinanceLedgerEntries', () => {

  it('paginateFinanceLedgerEntries is exported', () => {
    expect(typeof paginateFinanceLedgerEntries).toBe('function');
  });

});

describe('collectLedgerCategories', () => {

  it('collectLedgerCategories is exported', () => {
    expect(typeof collectLedgerCategories).toBe('function');
  });

});
