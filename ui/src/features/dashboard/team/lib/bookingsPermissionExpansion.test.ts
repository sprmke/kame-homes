import { describe, expect, it } from 'vitest';

import { expandBookingsPhase3PermissionIds } from '@/features/dashboard/team/lib/bookingsPermissionExpansion';

describe('expandBookingsPhase3PermissionIds', () => {

  it('expandBookingsPhase3PermissionIds is exported', () => {
    expect(typeof expandBookingsPhase3PermissionIds).toBe('function');
  });

});
