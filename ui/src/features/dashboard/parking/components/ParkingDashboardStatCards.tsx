import { Car, DollarSign, FileText, Percent } from 'lucide-react';

import { DashboardTrendStatCard } from '@/features/dashboard/property/components/DashboardTrendStatCard';
import type { DashboardStats } from '@/features/dashboard/property/lib/types';

import { MetricHint } from '@/components/help/MetricHint';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  stats: DashboardStats;
  reservationsHref?: string;
};

export function ParkingDashboardStatCards({ stats, reservationsHref }: Props) {
  const { kpis } = stats;

  return (
    <section aria-label="Key metrics">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        <DashboardTrendStatCard
          title="Total Revenue"
          titleAdornment={<MetricHint metric="parkingNetIncome" label="Total Revenue" />}
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
          title="Total Reservations"
          titleAdornment={<MetricHint metric="parkingNightsBooked" label="Total Reservations" />}
          value={`${kpis.nightsBooked.value} / ${kpis.nightsBooked.periodDays}`}
          change={kpis.totalBookings.changePercent}
          icon={FileText}
          to={reservationsHref}
        />
        <DashboardTrendStatCard
          title="Occupancy Rate"
          titleAdornment={<MetricHint metric="parkingOccupancyRate" label="Occupancy Rate" />}
          value={`${kpis.occupancyRate.value}%`}
          change={kpis.occupancyRate.changePoints}
          changeLabel="vs last period"
          changeIsPoints
          icon={Percent}
        />
        <DashboardTrendStatCard
          title="Average Nightly Rate"
          titleAdornment={<MetricHint metric="averageNightlyRate" label="Average Nightly Rate" />}
          value={formatMoney(kpis.avgNightlyRate.value)}
          change={kpis.avgNightlyRate.changePercent}
          icon={Car}
        />
      </div>
    </section>
  );
}
