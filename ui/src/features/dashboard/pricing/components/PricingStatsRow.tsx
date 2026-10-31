import { Calendar, DollarSign, Tag, TrendingUp, Wand2 } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';

import { cn } from '@/lib/utils';
import { formatMoneyCompact } from '@/utils/format/currency';

type Props = {
  weekdayRate: number;
  weekendRate: number;
  customDatesCount: number;
  enabledFeesTotal: number;
  /** Applied Smart Pricing nights in the current view — shows a 5th card when > 0. */
  smartDatesCount?: number;
};

export function PricingStatsRow({
  weekdayRate,
  weekendRate,
  customDatesCount,
  enabledFeesTotal,
  smartDatesCount = 0,
}: Props) {
  const weekendPremium = Math.round(((weekendRate - weekdayRate) / weekdayRate) * 100);
  const showSmart = smartDatesCount > 0;

  return (
    <section
      aria-label="Pricing summary"
      className={cn(
        'grid grid-cols-2 gap-2.5 sm:gap-3 lg:gap-4',
        showSmart ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
      )}
    >
      <AdminMetricCard
        title="Base Rate"
        value={formatMoneyCompact(weekdayRate)}
        icon={DollarSign}
      />
      <AdminMetricCard title="Weekend Premium" value={`+${weekendPremium}%`} icon={TrendingUp} />
      <AdminMetricCard title="Custom Dates" value={String(customDatesCount)} icon={Calendar} />
      <AdminMetricCard title="Fixed Fees" value={formatMoneyCompact(enabledFeesTotal)} icon={Tag} />
      {showSmart ? (
        <AdminMetricCard title="Smart Pricing" value={String(smartDatesCount)} icon={Wand2} />
      ) : null}
    </section>
  );
}
