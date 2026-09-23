import { describe, expect, it } from 'vitest';

import { priceTone, round50, pesoCompact, peso, signedPeso, monthToneCounts, buildMonthDrivers, buildDayFactorLines, previewChip } from '@/features/dashboard/pricing/lib/smartPricingPreviewExplain';

describe('priceTone', () => {

  it('priceTone is exported', () => {
    expect(typeof priceTone).toBe('function');
  });

});

describe('round50', () => {

  it('round50 is exported', () => {
    expect(typeof round50).toBe('function');
  });

});

describe('pesoCompact', () => {

  it('pesoCompact is exported', () => {
    expect(typeof pesoCompact).toBe('function');
  });

});

describe('peso', () => {

  it('peso is exported', () => {
    expect(typeof peso).toBe('function');
  });

});

describe('signedPeso', () => {

  it('signedPeso is exported', () => {
    expect(typeof signedPeso).toBe('function');
  });

});

describe('monthToneCounts', () => {

  it('monthToneCounts is exported', () => {
    expect(typeof monthToneCounts).toBe('function');
  });

});

describe('buildMonthDrivers', () => {

  it('buildMonthDrivers is exported', () => {
    expect(typeof buildMonthDrivers).toBe('function');
  });

});

describe('buildDayFactorLines', () => {

  it('buildDayFactorLines is exported', () => {
    expect(typeof buildDayFactorLines).toBe('function');
  });

});

describe('previewChip', () => {

  it('previewChip is exported', () => {
    expect(typeof previewChip).toBe('function');
  });

});
