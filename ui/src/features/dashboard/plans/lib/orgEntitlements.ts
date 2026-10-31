import type { OrgPlanResponse } from '@/features/dashboard/plans/lib/orgPlanApi';
import type { PlanFeatures } from '@/features/dashboard/plans/lib/planFeatures';

/** Derive org-wide feature flags from org-plan payload (subscription tier or Free default). */
export function deriveOrgEntitlementsFromPlan(
  data: OrgPlanResponse | undefined
): PlanFeatures | undefined {
  if (!data?.plans.length) return undefined;

  const subscription = data.subscription;
  if (subscription) {
    const subscribedPlan = data.plans.find((plan) => plan.id === subscription.planId);
    if (subscribedPlan) return subscribedPlan.features;
  }

  const freePlan =
    data.plans.find((plan) => plan.isDefault) ?? data.plans.find((plan) => plan.code === 'free');
  return freePlan?.features;
}
