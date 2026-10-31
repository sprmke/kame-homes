import { CreditCard, Layers, Sparkles, Star } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import { superAdminPricingPlansSummaryFromList } from '@/features/dashboard/super-admin/lib/superAdminPricingFilters';
import type { PricingPlan } from '@/features/dashboard/super-admin/types/pricingPlan';

type Props = {
  plans: PricingPlan[];
};

export function SuperAdminPricingSummaryCards({ plans }: Props) {
  const summary = superAdminPricingPlansSummaryFromList(plans);

  return (
    <section
      aria-label="Pricing plan summary"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
    >
      <AdminMetricCard
        title="Total plans"
        value={String(summary.total)}
        icon={Layers}
        iconClassName="text-sky-600 dark:text-sky-400"
        iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
      />
      <AdminMetricCard
        title="Host tiers"
        value={String(summary.subscriptionTiers)}
        icon={CreditCard}
        iconClassName="text-emerald-600 dark:text-emerald-400"
        iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
      />
      <AdminMetricCard
        title="Active plans"
        value={String(summary.activePlans)}
        icon={Sparkles}
        iconClassName="text-amber-600 dark:text-amber-400"
        iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
      />
      <AdminMetricCard
        title="Default plan"
        value={summary.defaultPlanName}
        icon={Star}
        iconClassName="text-violet-600 dark:text-violet-400"
        iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
      />
    </section>
  );
}
