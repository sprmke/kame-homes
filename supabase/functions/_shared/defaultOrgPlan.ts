/**
 * Assign platform_settings.default_plan_code to a new org when configured.
 * Only auto-enrolls zero-PHP subscription plans (Free tier). Paid defaults still
 * require checkout — avoids granting paid entitlements without payment.
 */

import { createServiceClient } from './orgAuth.ts';
import { createOrgSubscription } from './planEntitlements.ts';
import { getPlatformSettingsSnapshot } from './platformSettingsCache.ts';

export async function assignDefaultOrgPlanIfConfigured(input: {
  organizationId: string;
  propertyIds: string[];
  assignedByUserId: string;
}): Promise<void> {
  const propertyIds = input.propertyIds.filter(Boolean);
  if (propertyIds.length === 0) return;

  const settings = await getPlatformSettingsSnapshot();
  const planCode = settings.defaultPlanCode;
  if (!planCode) return;

  const sb = createServiceClient();
  const { data: plan, error } = await sb
    .from('pricing_plans')
    .select('id, code, pricing_model, price_php')
    .eq('code', planCode)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !plan) {
    console.warn('[defaultOrgPlan] plan not found for code', planCode);
    return;
  }
  if (plan.pricing_model === 'commission') return;

  const pricePhp = Number(plan.price_php ?? 0);
  if (!Number.isFinite(pricePhp) || pricePhp > 0) {
    console.warn('[defaultOrgPlan] skipping auto-assign for paid plan — use checkout', plan.code);
    return;
  }

  try {
    await createOrgSubscription(
      input.organizationId,
      plan.id as string,
      propertyIds,
      input.assignedByUserId
    );
  } catch (err) {
    console.warn('[defaultOrgPlan] assign failed:', (err as Error).message);
  }
}
