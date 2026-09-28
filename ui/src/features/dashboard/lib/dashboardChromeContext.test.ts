import { describe, expect, it } from 'vitest';

import { resolveDashboardCompactChrome } from '@/features/dashboard/lib/dashboardChromeContext';

describe('resolveDashboardCompactChrome', () => {
  it('is compact in AI mode when the canvas is open on desktop', () => {
    expect(resolveDashboardCompactChrome(true, true, true, false)).toBe(true);
  });

  it('is not compact in AI mode when the canvas is closed', () => {
    expect(resolveDashboardCompactChrome(true, false, true, false)).toBe(false);
  });

  it('is compact in advanced mode below xl on desktop', () => {
    expect(resolveDashboardCompactChrome(false, false, true, true)).toBe(true);
  });

  it('is not compact on phone layouts', () => {
    expect(resolveDashboardCompactChrome(false, false, false, true)).toBe(false);
  });
});
