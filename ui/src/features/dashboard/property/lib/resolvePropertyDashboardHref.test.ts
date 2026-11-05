import { describe, expect, it } from 'vitest';

import { resolvePropertyDashboardHref } from '@/features/dashboard/property/lib/resolvePropertyDashboardHref';

describe('resolvePropertyDashboardHref', () => {
  it('rewrites analytics onto the property with the period query', () => {
    expect(
      resolvePropertyDashboardHref(
        '/analytics?from=2026-11-01&to=2026-11-30',
        'example-org',
        'example-property'
      )
    ).toBe('/org/example-org/property/example-property/analytics?from=2026-11-01&to=2026-11-30');
  });

  it('leaves an already scoped path alone', () => {
    expect(
      resolvePropertyDashboardHref(
        '/org/example-org/property/example-property/bookings',
        'other',
        'other'
      )
    ).toBe('/org/example-org/property/example-property/bookings');
  });
});
