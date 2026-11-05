import { describe, expect, it } from 'vitest';

import { resolvePropertyDashboardHref } from '@/features/dashboard/property/lib/resolvePropertyDashboardHref';

describe('resolvePropertyDashboardHref', () => {
  it('rewrites analytics onto the property with the period query', () => {
    expect(
      resolvePropertyDashboardHref(
        '/analytics?from=2026-11-01&to=2026-11-30',
        'kame-homes',
        'kame-home'
      )
    ).toBe('/org/kame-homes/property/kame-home/analytics?from=2026-11-01&to=2026-11-30');
  });

  it('leaves an already scoped path alone', () => {
    expect(
      resolvePropertyDashboardHref('/org/kame-homes/property/kame-home/bookings', 'other', 'other')
    ).toBe('/org/kame-homes/property/kame-home/bookings');
  });
});
