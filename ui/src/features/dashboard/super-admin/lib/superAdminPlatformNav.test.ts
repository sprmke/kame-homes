import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/super-admin/lib/superAdminPlatformNav';

describe('superAdminPlatformNav', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
