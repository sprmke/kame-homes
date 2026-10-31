import { Calendar, DollarSign, TrendingUp } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';

import { formatMoneyCompact } from '@/utils/format/currency';

type Props = {
  weekdayRate: number;
  weekendRate: number;
  customDatesCount: number;
};

export function ParkingPricingStatsRow({ weekdayRate, weekendRate, customDatesCount }: Props) {
  const weekendPremium =
    weekdayRate > 0 ? Math.round(((weekendRate - weekdayRate) / weekdayRate) * 100) : 0;

  return (
    <section
      aria-label="Pricing summary"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4"
    >
      <AdminMetricCard
        title="Base Rate"
        value={formatMoneyCompact(weekdayRate)}
        icon={DollarSign}
      />
      <AdminMetricCard title="Weekend Premium" value={`+${weekendPremium}%`} icon={TrendingUp} />
      <AdminMetricCard title="Custom Dates" value={String(customDatesCount)} icon={Calendar} />
    </section>
  );
}
