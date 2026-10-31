import { Building2, Car, Landmark } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import { superAdminDevelopmentsSummaryFromList } from '@/features/dashboard/super-admin/lib/superAdminDevelopmentsFilters';
import type { Development } from '@/features/dashboard/super-admin/types/development';

type Props = {
  developments: Development[];
};

export function SuperAdminDevelopmentsSummaryCards({ developments }: Props) {
  const summary = superAdminDevelopmentsSummaryFromList(developments);

  return (
    <section
      aria-label="Development summary"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
    >
      <AdminMetricCard
        title="Total developments"
        value={String(summary.total)}
        icon={Landmark}
        iconClassName="text-sky-600 dark:text-sky-400"
        iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
      />
      <AdminMetricCard
        title="Active"
        value={String(summary.active)}
        icon={Building2}
        iconClassName="text-emerald-600 dark:text-emerald-400"
        iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
      />
      <AdminMetricCard
        title="Linked properties"
        value={String(summary.linkedProperties)}
        icon={Building2}
        iconClassName="text-violet-600 dark:text-violet-400"
        iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
      />
      <AdminMetricCard
        title="Linked parking"
        value={String(summary.linkedParking)}
        icon={Car}
        iconClassName="text-amber-600 dark:text-amber-400"
        iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
      />
    </section>
  );
}
