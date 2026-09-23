import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/team/lib/orgPermissionCatalog';

describe('orgPermissionCatalog', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
