import { describe, expect, it } from 'vitest';

import { financeBasisLabel, financePeriodRangeLabel, financePresetLabel } from '@/features/dashboard/finance/lib/financeFilterLabels';

describe('financeBasisLabel', () => {

  it('financeBasisLabel is exported', () => {
    expect(typeof financeBasisLabel).toBe('function');
  });

});

describe('financePeriodRangeLabel', () => {

  it('financePeriodRangeLabel is exported', () => {
    expect(typeof financePeriodRangeLabel).toBe('function');
  });

});

describe('financePresetLabel', () => {

  it('financePresetLabel is exported', () => {
    expect(typeof financePresetLabel).toBe('function');
  });

});
