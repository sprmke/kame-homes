import { BarChart3, BedDouble, CalendarCheck, Percent } from 'lucide-react';

import { MetricInfoDot } from '@/features/dashboard/analytics/components/MetricInfoDot';
import { inclusiveDayCount } from '@/features/dashboard/analytics/lib/analyticsPeriod';
import type { AnalyticsMetricKey } from '@/features/dashboard/analytics/lib/metricGlossary';
import type {
  AnalyticsKpi,
  AnalyticsKpis,
  AnalyticsPeriod,
} from '@/features/dashboard/analytics/lib/types';

import { StatCard } from '@/components/shared/StatCard';
import { formatMoney } from '@/utils/format/currency';

import type { LucideIcon } from 'lucide-react';

type Props = {
  kpis: AnalyticsKpis;
  period: AnalyticsPeriod;
};

type MetricRow = {
  key: AnalyticsMetricKey;
  title: string;
  icon: LucideIcon;
  value: (k: AnalyticsKpis) => string;
  kpi: (k: AnalyticsKpis) => AnalyticsKpi;
  changeIsPoints?: boolean;
};

const METRICS: MetricRow[] = [
  {
    key: 'occupancy',
    title: 'Occupancy',
    icon: Percent,
    value: (k) => `${k.occupancyRate.value}%`,
    kpi: (k) => k.occupancyRate,
    changeIsPoints: true,
  },
  {
    key: 'adr',
    title: 'Avg nightly rate',
    icon: BedDouble,
    value: (k) => formatMoney(k.adr.value),
    kpi: (k) => k.adr,
  },
  {
    key: 'revpar',
    title: 'Revenue per night',
    icon: BarChart3,
    value: (k) => formatMoney(k.revpar.value),
    kpi: (k) => k.revpar,
  },
  {
    key: 'reservations',
    title: 'Bookings',
    icon: CalendarCheck,
    value: (k) => String(k.reservations.value),
    kpi: (k) => k.reservations,
  },
];

export function AnalyticsKpiStrip({ kpis, period }: Props) {
  const nightsAvailable = inclusiveDayCount(period.from, period.to);

  return (
    <section aria-label="Key metrics">
      <div className="native-stagger grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        {METRICS.map((metric) => (
          <StatCard
            key={metric.key}
            title={metric.title}
            titleAdornment={<MetricInfoDot metric={metric.key} label={metric.title} />}
            value={metric.value(kpis)}
            change={metric.kpi(kpis).changePctVsPrior ?? undefined}
            changeLabel="vs last period"
            changeIsPoints={metric.changeIsPoints}
            icon={metric.icon}
            footer={
              metric.key === 'occupancy' && nightsAvailable > 0 ? (
                <p className="text-muted-foreground text-xs tabular-nums">
                  {kpis.nightsBooked.value} of {nightsAvailable} nights
                </p>
              ) : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}
