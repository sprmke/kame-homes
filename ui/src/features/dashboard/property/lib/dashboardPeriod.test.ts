import { describe, expect, it } from 'vitest';

import { defaultDashboardPeriod, resolveDashboardPeriod, writeDashboardPeriodParams } from '@/features/dashboard/property/lib/dashboardPeriod';

describe('defaultDashboardPeriod', () => {

  it('defaultDashboardPeriod is exported', () => {
    expect(typeof defaultDashboardPeriod).toBe('function');
  });

});

describe('resolveDashboardPeriod', () => {

  it('resolveDashboardPeriod is exported', () => {
    expect(typeof resolveDashboardPeriod).toBe('function');
  });

});

describe('writeDashboardPeriodParams', () => {

  it('writeDashboardPeriodParams is exported', () => {
    expect(typeof writeDashboardPeriodParams).toBe('function');
  });

});
