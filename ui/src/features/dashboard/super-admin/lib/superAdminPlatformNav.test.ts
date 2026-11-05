import { describe, expect, it } from 'vitest';

import { SUPER_ADMIN_NAV_GROUPS } from '@/features/dashboard/super-admin/lib/superAdminPlatformNav';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

describe('superAdminPlatformNav', () => {
  it('includes feature availability under Platform', () => {
    const platform = SUPER_ADMIN_NAV_GROUPS.find((group) => group.label === 'Platform');
    const item = platform?.items.find(
      (entry) => entry.href === superAdminPaths.featureAvailability
    );
    expect(item?.label).toBe('Feature availability');
  });
});
