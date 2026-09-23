import { describe, expect, it } from 'vitest';

import { formatPricingPlanHostPrice } from '@/features/dashboard/super-admin/lib/pricingPlanDisplay';

describe('formatPricingPlanHostPrice', () => {

  it('formatPricingPlanHostPrice is exported', () => {
    expect(typeof formatPricingPlanHostPrice).toBe('function');
  });

});
