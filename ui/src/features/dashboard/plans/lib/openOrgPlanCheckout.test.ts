import { describe, expect, it } from 'vitest';

import { openOrgPlanCheckout } from '@/features/dashboard/plans/lib/openOrgPlanCheckout';

describe('openOrgPlanCheckout', () => {

  it('openOrgPlanCheckout is exported', () => {
    expect(typeof openOrgPlanCheckout).toBe('function');
  });

});
