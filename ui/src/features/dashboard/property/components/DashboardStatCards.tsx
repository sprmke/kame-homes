import type { ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { BedDouble, DollarSign, FileText, Percent } from 'lucide-react';

import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { DashboardTrendStatCard } from '@/features/dashboard/property/components/DashboardTrendStatCard';
import type { DashboardStats } from '@/features/dashboard/property/lib/types';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  stats: DashboardStats;
};

function TrendCardLink({ to, children }: { to?: string; children: ReactNode }) {
  if (!to) return <>{children}</>;
  return (
    <Link to={to} className="block min-w-0">
      {children}
    </Link>
  );
}

export function DashboardStatCards({ stats }: Props) {
  const { orgSlug, propertySlug } = useOrgContext();
  const { trendWindow, kpis } = stats;
  const bookingsHref = `${propertySectionPath(orgSlug, propertySlug, 'bookings')}?from=${trendWindow.from}&to=${trendWindow.to}`;

  return (
    <section aria-label="Key metrics">
      <div className="native-stagger grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        <DashboardTrendStatCard
          title="Total Revenue"
          value={formatMoney(kpis.netProfit.value)}
          change={kpis.netProfit.changePercent}
          icon={DollarSign}
          valueClassName={cn(
            kpis.netProfit.value >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          )}
        />
        <TrendCardLink to={bookingsHref}>
          <DashboardTrendStatCard
            title="Total Bookings"
            value={`${kpis.nightsBooked.value} / ${kpis.nightsBooked.periodDays}`}
            change={kpis.totalBookings.changePercent}
            icon={FileText}
          />
        </TrendCardLink>
        <DashboardTrendStatCard
          title="Occupancy Rate"
          value={`${kpis.occupancyRate.value}%`}
          change={kpis.occupancyRate.changePoints}
          changeLabel="vs last period"
          changeIsPoints
          icon={Percent}
        />
        <DashboardTrendStatCard
          title="Average Nightly Rate"
          value={formatMoney(kpis.avgNightlyRate.value)}
          change={kpis.avgNightlyRate.changePercent}
          icon={BedDouble}
        />
      </div>
    </section>
  );
}
