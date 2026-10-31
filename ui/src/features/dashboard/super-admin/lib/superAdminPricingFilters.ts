import type { SuperAdminListViewMode } from '@/features/dashboard/super-admin/lib/superAdminListViewMode';
import type { PricingPlan } from '@/features/dashboard/super-admin/types/pricingPlan';

export type SuperAdminPricingPlansViewMode = SuperAdminListViewMode;
export type SuperAdminOrgSubscriptionsViewMode = SuperAdminListViewMode;

export type SuperAdminPricingPlansFilters = {
  search: string;
  status: 'all' | 'active' | 'inactive';
};

export type SuperAdminOrgSubscriptionsFilters = {
  search: string;
  planCode: 'all' | string;
};

export const DEFAULT_SUPER_ADMIN_PRICING_PLANS_FILTERS: SuperAdminPricingPlansFilters = {
  search: '',
  status: 'all',
};

export const DEFAULT_SUPER_ADMIN_ORG_SUBSCRIPTIONS_FILTERS: SuperAdminOrgSubscriptionsFilters = {
  search: '',
  planCode: 'all',
};

export function superAdminPricingPlansHasActiveFilters(
  filters: SuperAdminPricingPlansFilters
): boolean {
  return filters.search.trim() !== '' || filters.status !== 'all';
}

export function superAdminPricingPlansSummaryFromList(plans: PricingPlan[]) {
  const hostLadder = plans.filter(
    (plan) => plan.pricingModel === 'subscription' && plan.code !== 'business_plus'
  );
  const activePlans = plans.filter((plan) => plan.isActive).length;
  const defaultPlan = plans.find((plan) => plan.isDefault);

  return {
    total: plans.length,
    subscriptionTiers: hostLadder.length,
    activePlans,
    defaultPlanName: defaultPlan?.name ?? '-',
  };
}

export function superAdminOrgSubscriptionsHasActiveFilters(
  filters: SuperAdminOrgSubscriptionsFilters
): boolean {
  return filters.search.trim() !== '' || filters.planCode !== 'all';
}
