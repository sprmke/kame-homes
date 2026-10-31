import { Building2, Landmark, Link2, Users } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import { superAdminPlatformPropertiesSummaryFromList } from '@/features/dashboard/super-admin/lib/superAdminPlatformPropertiesFilters';
import type { PlatformProperty } from '@/features/dashboard/super-admin/types/platformProperty';

type Props = {
  properties: PlatformProperty[];
};

export function SuperAdminPlatformPropertiesSummaryCards({ properties }: Props) {
  const summary = superAdminPlatformPropertiesSummaryFromList(properties);

  return (
    <section
      aria-label="Platform property summary"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
    >
      <AdminMetricCard
        title="Total properties"
        value={String(summary.total)}
        icon={Building2}
        iconClassName="text-sky-600 dark:text-sky-400"
        iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
      />
      <AdminMetricCard
        title="Active"
        value={String(summary.active)}
        icon={Landmark}
        iconClassName="text-emerald-600 dark:text-emerald-400"
        iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
      />
      <AdminMetricCard
        title="Linked developments"
        value={String(summary.linkedDevelopments)}
        icon={Link2}
        iconClassName="text-violet-600 dark:text-violet-400"
        iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
      />
      <AdminMetricCard
        title="Organizations"
        value={String(summary.organizations)}
        icon={Users}
        iconClassName="text-amber-600 dark:text-amber-400"
        iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
      />
    </section>
  );
}
