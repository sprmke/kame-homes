import { Building2, Calendar, DollarSign, Layers, Percent } from 'lucide-react';

import { DashboardTrendStatCard } from '@/features/dashboard/property/components/DashboardTrendStatCard';
import type { DashboardStats } from '@/features/dashboard/property/lib/types';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  stats: DashboardStats;
};

export function OrgDashboardStatCards({ stats }: Props) {
  const { kpis, propertyCount, parkingCount } = stats;
  const hasParking = parkingCount > 0;
  const listingCount = propertyCount + parkingCount;

  return (
    <section aria-label="Key metrics">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
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
        <DashboardTrendStatCard
          title="Total Bookings"
          value={String(kpis.checkInsInPeriod.value)}
          change={kpis.checkInsInPeriod.changePercent}
          icon={Calendar}
        />
        <DashboardTrendStatCard
          title="Occupancy Rate"
          value={`${kpis.occupancyRate.value}%`}
          change={kpis.occupancyRate.changePoints}
          changeIsPoints
          icon={Percent}
        />
        {hasParking ? (
          <DashboardTrendStatCard
            title="Total Listings"
            value={String(listingCount)}
            icon={Layers}
            footer={
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums sm:text-xs">
                <span>{propertyCount} properties</span>
                <span aria-hidden>·</span>
                <span>{parkingCount} parking</span>
              </p>
            }
          />
        ) : (
          <DashboardTrendStatCard
            title="Total Properties"
            value={String(propertyCount)}
            icon={Building2}
          />
        )}
      </div>
    </section>
  );
}
