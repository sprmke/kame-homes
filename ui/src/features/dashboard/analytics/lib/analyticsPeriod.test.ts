import { describe, expect, it } from 'vitest';

import { defaultAnalyticsPeriod, resolveAnalyticsPeriod, writeAnalyticsPeriodParams, inclusiveDayCount } from '@/features/dashboard/analytics/lib/analyticsPeriod';

describe('defaultAnalyticsPeriod', () => {

  it('defaultAnalyticsPeriod is exported', () => {
    expect(typeof defaultAnalyticsPeriod).toBe('function');
  });

});

describe('resolveAnalyticsPeriod', () => {

  it('resolveAnalyticsPeriod is exported', () => {
    expect(typeof resolveAnalyticsPeriod).toBe('function');
  });

});

describe('writeAnalyticsPeriodParams', () => {

  it('writeAnalyticsPeriodParams is exported', () => {
    expect(typeof writeAnalyticsPeriodParams).toBe('function');
  });

});

describe('inclusiveDayCount', () => {

  it('inclusiveDayCount is exported', () => {
    expect(typeof inclusiveDayCount).toBe('function');
  });

});
