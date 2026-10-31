import { Building2, Car, Users } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import type { HostsSummary } from '@/features/dashboard/super-admin/types/host';

type Props = {
  summary: HostsSummary;
};

export function SuperAdminHostsSummaryCards({ summary }: Props) {
  return (
    <section
      aria-label="Host summary"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
    >
      <AdminMetricCard
        title="Total hosts"
        value={String(summary.total)}
        icon={Users}
        iconClassName="text-sky-600 dark:text-sky-400"
        iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
      />
      <AdminMetricCard
        title="Organizations"
        value={String(summary.totalOrgs)}
        icon={Building2}
        iconClassName="text-emerald-600 dark:text-emerald-400"
        iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
      />
      <AdminMetricCard
        title="Properties"
        value={String(summary.totalProperties)}
        icon={Building2}
        iconClassName="text-violet-600 dark:text-violet-400"
        iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
      />
      <AdminMetricCard
        title="Parking slots"
        value={String(summary.totalParking)}
        icon={Car}
        iconClassName="text-amber-600 dark:text-amber-400"
        iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
      />
    </section>
  );
}
