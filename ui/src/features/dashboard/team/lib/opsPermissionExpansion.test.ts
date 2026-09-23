import { describe, expect, it } from 'vitest';

import { expandOpsPhase4PermissionIds } from '@/features/dashboard/team/lib/opsPermissionExpansion';

describe('expandOpsPhase4PermissionIds', () => {

  it('expandOpsPhase4PermissionIds is exported', () => {
    expect(typeof expandOpsPhase4PermissionIds).toBe('function');
  });

});
