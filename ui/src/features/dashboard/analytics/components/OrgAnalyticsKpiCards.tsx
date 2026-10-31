import { CalendarCheck, DollarSign, Percent, AlertTriangle } from 'lucide-react';

import { MetricInfoDot } from '@/features/dashboard/analytics/components/MetricInfoDot';
import type { OrgAnalyticsSummary } from '@/features/dashboard/analytics/lib/types';

import { StatCard, StatCardGrid } from '@/components/shared/StatCard';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  portfolio: OrgAnalyticsSummary['portfolio'];
};

export function OrgAnalyticsKpiCards({ portfolio }: Props) {
  const parkingCount = portfolio.parkingCount ?? 0;
  const propertyCount = portfolio.propertyCount;
  const listingCount = portfolio.listingCount ?? propertyCount + parkingCount;
  const attentionCount = portfolio.attentionCount ?? 0;

  return (
    <section aria-label="Portfolio metrics">
      <StatCardGrid>
        <StatCard
          title="Revenue"
          value={formatMoney(portfolio.totalRevenue)}
          change={portfolio.totalRevenueChangePct ?? undefined}
          icon={DollarSign}
        />
        <StatCard
          title="Bookings"
          titleAdornment={<MetricInfoDot metric="reservations" label="Bookings" />}
          value={String(portfolio.totalReservations)}
          change={portfolio.totalReservationsChangePct ?? undefined}
          icon={CalendarCheck}
        />
        <StatCard
          title="Occupancy"
          titleAdornment={<MetricInfoDot metric="occupancy" label="Occupancy" />}
          value={`${portfolio.avgOccupancy}%`}
          change={portfolio.avgOccupancyChangePts ?? undefined}
          changeIsPoints
          icon={Percent}
        />
        <StatCard
          title="Needs attention"
          value={String(attentionCount)}
          icon={AlertTriangle}
          iconClassName={attentionCount > 0 ? 'text-amber-700 dark:text-amber-300' : undefined}
          iconBgClassName={attentionCount > 0 ? 'bg-amber-100 dark:bg-amber-950/50' : undefined}
          footer={
            <p className="text-muted-foreground text-[11px] tabular-nums sm:text-xs">
              of {listingCount} {listingCount === 1 ? 'listing' : 'listings'}
            </p>
          }
        />
      </StatCardGrid>
    </section>
  );
}
