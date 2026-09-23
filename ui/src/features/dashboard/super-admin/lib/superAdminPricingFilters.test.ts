import { describe, expect, it } from 'vitest';

import { superAdminPricingPlansHasActiveFilters, superAdminPricingPlansSummaryFromList, superAdminOrgSubscriptionsHasActiveFilters } from '@/features/dashboard/super-admin/lib/superAdminPricingFilters';

describe('superAdminPricingPlansHasActiveFilters', () => {

  it('superAdminPricingPlansHasActiveFilters is exported', () => {
    expect(typeof superAdminPricingPlansHasActiveFilters).toBe('function');
  });

});

describe('superAdminPricingPlansSummaryFromList', () => {

  it('superAdminPricingPlansSummaryFromList is exported', () => {
    expect(typeof superAdminPricingPlansSummaryFromList).toBe('function');
  });

});

describe('superAdminOrgSubscriptionsHasActiveFilters', () => {

  it('superAdminOrgSubscriptionsHasActiveFilters is exported', () => {
    expect(typeof superAdminOrgSubscriptionsHasActiveFilters).toBe('function');
  });

});
