import { describe, expect, it } from 'vitest';

import {
  activityRefineFilterCount,
  clearActivityFilters,
  hasActivityFilters,
} from '@/features/dashboard/activity/lib/activityFilterUtils';

describe('activityFilterUtils', () => {
  it('counts refine groups', () => {
    expect(activityRefineFilterCount({ scope: 'org', category: ['booking'] })).toBe(1);
    expect(
      activityRefineFilterCount({
        scope: 'org',
        category: ['booking'],
        severity: 'destructive',
        dateFrom: '2026-01-01',
      })
    ).toBe(3);
  });

  it('detects active filters including search', () => {
    expect(hasActivityFilters({ scope: 'property', q: 'maria' })).toBe(true);
    expect(hasActivityFilters({ scope: 'property' })).toBe(false);
  });

  it('clearActivityFilters keeps scope only', () => {
    expect(
      clearActivityFilters({
        scope: 'org',
        category: ['team'],
        q: 'x',
        dateFrom: '2026-01-01',
      })
    ).toEqual({ scope: 'org' });
  });
});
