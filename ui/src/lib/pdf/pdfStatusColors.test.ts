import { describe, expect, it } from 'vitest';

import { pdfToneTextColor, pdfStatusTextColor, pdfIncomeTextColor, pdfExpenseTextColor, pdfEstimateTextColor, pdfMaintenanceStatusColor } from '@/lib/pdf/pdfStatusColors';

describe('pdfToneTextColor', () => {

  it('pdfToneTextColor is exported', () => {
    expect(typeof pdfToneTextColor).toBe('function');
  });

});

describe('pdfStatusTextColor', () => {

  it('pdfStatusTextColor is exported', () => {
    expect(typeof pdfStatusTextColor).toBe('function');
  });

});

describe('pdfIncomeTextColor', () => {

  it('pdfIncomeTextColor is exported', () => {
    expect(typeof pdfIncomeTextColor).toBe('function');
  });

});

describe('pdfExpenseTextColor', () => {

  it('pdfExpenseTextColor is exported', () => {
    expect(typeof pdfExpenseTextColor).toBe('function');
  });

});

describe('pdfEstimateTextColor', () => {

  it('pdfEstimateTextColor is exported', () => {
    expect(typeof pdfEstimateTextColor).toBe('function');
  });

});

describe('pdfMaintenanceStatusColor', () => {

  it('pdfMaintenanceStatusColor is exported', () => {
    expect(typeof pdfMaintenanceStatusColor).toBe('function');
  });

});
