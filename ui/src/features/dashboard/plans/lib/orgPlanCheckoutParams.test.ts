import { describe, expect, it } from 'vitest';

import { parseOrgPlanCheckoutReturn } from '@/features/dashboard/plans/lib/orgPlanCheckoutParams';

describe('parseOrgPlanCheckoutReturn', () => {

  it('parseOrgPlanCheckoutReturn is exported', () => {
    expect(typeof parseOrgPlanCheckoutReturn).toBe('function');
  });

});
