import { describe, expect, it } from 'vitest';

import { resolvePropertyDashboardHref } from '@/features/dashboard/property/lib/resolvePropertyDashboardHref';

describe('resolvePropertyDashboardHref', () => {

  it('resolvePropertyDashboardHref is exported', () => {
    expect(typeof resolvePropertyDashboardHref).toBe('function');
  });

});
