import { Building2, CheckCircle2, CircleDashed, Home } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import type { OrgSubscriptionsSummary } from '@/features/dashboard/super-admin/hooks/usePricingPlans';

type Props = {
  summary: OrgSubscriptionsSummary | null;
};

export function SuperAdminOrgSubscriptionsSummaryCards({ summary }: Props) {
  const totals = summary ?? {
    total: 0,
    assigned: 0,
    unassigned: 0,
    activeSubscriptions: 0,
    properties: 0,
  };

  return (
    <section
      aria-label="Org subscription summary"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
    >
      <AdminMetricCard
        title="Organizations"
        value={String(totals.total)}
        icon={Building2}
        iconClassName="text-sky-600 dark:text-sky-400"
        iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
      />
      <AdminMetricCard
        title="Assigned"
        value={String(totals.assigned)}
        icon={CheckCircle2}
        iconClassName="text-emerald-600 dark:text-emerald-400"
        iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
      />
      <AdminMetricCard
        title="Unassigned"
        value={String(totals.unassigned)}
        icon={CircleDashed}
        iconClassName="text-amber-600 dark:text-amber-400"
        iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
      />
      <AdminMetricCard
        title="Properties"
        value={String(totals.properties)}
        icon={Home}
        iconClassName="text-violet-600 dark:text-violet-400"
        iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
      />
    </section>
  );
}
