import { describe, expect, it } from 'vitest';

import { defaultChanceForPercent, suggestPropertyVoucherCode, normalizePropertyVoucherPrizes, voucherPrizesForEditor, voucherPrizesEqual, voucherChanceSum, voucherDisplayPercents, formatVoucherOddsLabel, formatVoucherPrizeSummary, VOUCHER_PRESET_PERCENTS } from '@/features/dashboard/org/lib/propertyVoucherSettings';

describe('defaultChanceForPercent', () => {

  it('defaultChanceForPercent is exported', () => {
    expect(typeof defaultChanceForPercent).toBe('function');
  });

});

describe('suggestPropertyVoucherCode', () => {

  it('suggestPropertyVoucherCode is exported', () => {
    expect(typeof suggestPropertyVoucherCode).toBe('function');
  });

});

describe('normalizePropertyVoucherPrizes', () => {

  it('normalizePropertyVoucherPrizes is exported', () => {
    expect(typeof normalizePropertyVoucherPrizes).toBe('function');
  });

});

describe('voucherPrizesForEditor', () => {

  it('voucherPrizesForEditor is exported', () => {
    expect(typeof voucherPrizesForEditor).toBe('function');
  });

});

describe('voucherPrizesEqual', () => {

  it('voucherPrizesEqual is exported', () => {
    expect(typeof voucherPrizesEqual).toBe('function');
  });

});

describe('voucherChanceSum', () => {

  it('voucherChanceSum is exported', () => {
    expect(typeof voucherChanceSum).toBe('function');
  });

});

describe('voucherDisplayPercents', () => {

  it('voucherDisplayPercents is exported', () => {
    expect(typeof voucherDisplayPercents).toBe('function');
  });

});

describe('formatVoucherOddsLabel', () => {

  it('formatVoucherOddsLabel is exported', () => {
    expect(typeof formatVoucherOddsLabel).toBe('function');
  });

});

describe('formatVoucherPrizeSummary', () => {

  it('formatVoucherPrizeSummary is exported', () => {
    expect(typeof formatVoucherPrizeSummary).toBe('function');
  });

});

describe('VOUCHER_PRESET_PERCENTS', () => {
  it('is defined', () => {
    expect(VOUCHER_PRESET_PERCENTS).toBeDefined();
  });
});
