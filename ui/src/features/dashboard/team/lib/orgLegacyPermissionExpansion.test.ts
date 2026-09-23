import { describe, expect, it } from 'vitest';

import { expandLegacyOrgPermissionIds } from '@/features/dashboard/team/lib/orgLegacyPermissionExpansion';

describe('expandLegacyOrgPermissionIds', () => {

  it('expandLegacyOrgPermissionIds is exported', () => {
    expect(typeof expandLegacyOrgPermissionIds).toBe('function');
  });

});
