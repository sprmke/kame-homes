import { describe, expect, it } from 'vitest';

import { formatChartMoneyAxis, defaultChartMargin, chartAxisTick, CHART_INCOME_COLOR, CHART_EXPENSE_COLOR, CHART_INFO_COLOR, CHART_HEIGHT_CLASS } from '@/lib/charts/chartStyles';

describe('formatChartMoneyAxis', () => {

  it('formatChartMoneyAxis is exported', () => {
    expect(typeof formatChartMoneyAxis).toBe('function');
  });

});

describe('defaultChartMargin', () => {

  it('defaultChartMargin is exported', () => {
    expect(typeof defaultChartMargin).toBe('function');
  });

});

describe('chartAxisTick', () => {

  it('chartAxisTick is exported', () => {
    expect(typeof chartAxisTick).toBe('function');
  });

});

describe('CHART_INCOME_COLOR', () => {
  it('is defined', () => {
    expect(CHART_INCOME_COLOR).toBeDefined();
  });
});

describe('CHART_EXPENSE_COLOR', () => {
  it('is defined', () => {
    expect(CHART_EXPENSE_COLOR).toBeDefined();
  });
});

describe('CHART_INFO_COLOR', () => {
  it('is defined', () => {
    expect(CHART_INFO_COLOR).toBeDefined();
  });
});

describe('CHART_HEIGHT_CLASS', () => {
  it('is defined', () => {
    expect(CHART_HEIGHT_CLASS).toBeDefined();
  });
});
