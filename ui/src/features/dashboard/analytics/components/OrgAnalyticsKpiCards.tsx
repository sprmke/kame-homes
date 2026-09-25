import { Building2, Calendar, DollarSign, Percent } from 'lucide-react';

import type { OrgAnalyticsSummary } from '@/features/dashboard/analytics/lib/types';

import { StatCard } from '@/components/shared/StatCard';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  portfolio: OrgAnalyticsSummary['portfolio'];
};

export function OrgAnalyticsKpiCards({ portfolio }: Props) {
  return (
    <section aria-label="Portfolio metrics">
      <div className="native-stagger grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          title="Portfolio Revenue"
          value={formatMoney(portfolio.totalRevenue)}
          icon={DollarSign}
        />
        <StatCard title="Avg Occupancy" value={`${portfolio.avgOccupancy}%`} icon={Percent} />
        <StatCard
          title="Total Reservations"
          value={String(portfolio.totalReservations)}
          icon={Calendar}
        />
        <StatCard title="Properties" value={String(portfolio.propertyCount)} icon={Building2} />
      </div>
    </section>
  );
}
