import { Calendar, Car, Coins, Percent } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import { orgParkingsSummaryFromList } from '@/features/dashboard/org/lib/orgParkingCardModel';
import { formatOrgParkingCurrency } from '@/features/dashboard/org/lib/orgParkingDisplay';
import type { Parking } from '@/features/dashboard/org/types';

type Props = {
  parkings: Parking[];
};

export function OrgParkingsSummaryCards({ parkings }: Props) {
  const summary = orgParkingsSummaryFromList(parkings);

  return (
    <section
      aria-label="Parking summary"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
    >
      <AdminMetricCard title="Total parkings" value={String(summary.total)} icon={Car} />
      <AdminMetricCard
        title="Total revenue"
        value={formatOrgParkingCurrency(summary.totalRevenue)}
        icon={Coins}
      />
      <AdminMetricCard
        title="Avg monthly revenue"
        value={formatOrgParkingCurrency(summary.avgMonthlyRevenue)}
        icon={Calendar}
      />
      <AdminMetricCard title="Avg occupancy" value={`${summary.avgOccupancy}%`} icon={Percent} />
    </section>
  );
}
