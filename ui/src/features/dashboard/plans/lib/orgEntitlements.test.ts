import { describe, expect, it } from 'vitest';

import { deriveOrgEntitlementsFromPlan } from '@/features/dashboard/plans/lib/orgEntitlements';

describe('deriveOrgEntitlementsFromPlan', () => {

  it('deriveOrgEntitlementsFromPlan is exported', () => {
    expect(typeof deriveOrgEntitlementsFromPlan).toBe('function');
  });

});
