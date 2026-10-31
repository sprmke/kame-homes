import { discountedPlanPricePhp } from '@/features/dashboard/plans/lib/planPricing';
import type { PricingPlan } from '@/features/dashboard/super-admin/types/pricingPlan';

import { formatMoneyCompact } from '@/utils/format/currency';

/** Host-facing checkout price label for super-admin plan lists. */
export function formatPricingPlanHostPrice(plan: PricingPlan): string {
  const list = Math.max(0, Math.floor(plan.pricePhp ?? 0));
  if (list <= 0) return formatMoneyCompact(0);

  const effective = discountedPlanPricePhp(list, plan.discountPercent);
  if (plan.discountPercent > 0 && effective < list) {
    return `${formatMoneyCompact(effective)} · ${Math.floor(plan.discountPercent)}% off`;
  }

  return formatMoneyCompact(list);
}
