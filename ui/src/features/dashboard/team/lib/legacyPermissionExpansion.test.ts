import { describe, expect, it } from 'vitest';

import { expandLegacyPropertyPermissionIds } from '@/features/dashboard/team/lib/legacyPermissionExpansion';

describe('expandLegacyPropertyPermissionIds', () => {

  it('expandLegacyPropertyPermissionIds is exported', () => {
    expect(typeof expandLegacyPropertyPermissionIds).toBe('function');
  });

});
