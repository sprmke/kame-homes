import { MessageCircle } from 'lucide-react';

import { MetricInfoDot } from '@/features/dashboard/analytics/components/MetricInfoDot';
import type { AnalyticsMetricKey } from '@/features/dashboard/analytics/lib/metricGlossary';
import type { AnalyticsKpis } from '@/features/dashboard/analytics/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import {
  CHART_EXPENSE_COLOR,
  CHART_INCOME_COLOR,
  CHART_INFO_COLOR,
} from '@/lib/charts/chartStyles';
import { cn } from '@/lib/utils';

type Props = {
  kpis: AnalyticsKpis;
  className?: string;
};

type SignalBar = {
  key: string;
  label: string;
  metric: AnalyticsMetricKey;
  /** Display string (e.g. `12%`, `4.2`). */
  display: string;
  /** 0–100 fill of the track. */
  fillPct: number;
  color: string;
};

function clampPct(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(100, value);
}

function buildSignals(kpis: AnalyticsKpis): SignalBar[] {
  // Server already returns rates as 0–100 (not 0–1).
  const cancellation = clampPct(kpis.cancellationRate.value);
  const rating = kpis.avgRating.value > 0 ? kpis.avgRating.value : 0;
  const response = clampPct(kpis.responseWithin24hRate.value);

  return [
    {
      key: 'cancellation',
      label: 'Cancellation',
      metric: 'cancellationRate',
      display: `${Math.round(cancellation)}%`,
      fillPct: cancellation,
      color: CHART_EXPENSE_COLOR,
    },
    {
      key: 'rating',
      label: 'Avg rating',
      metric: 'rating',
      display: rating > 0 ? rating.toFixed(1) : '—',
      fillPct: rating > 0 ? clampPct((rating / 5) * 100) : 0,
      color: CHART_INCOME_COLOR,
    },
    {
      key: 'response',
      label: '24h response',
      metric: 'responseRate',
      display: `${Math.round(response)}%`,
      fillPct: response,
      color: CHART_INFO_COLOR,
    },
  ];
}

export function AnalyticsGuestSignalsCard({ kpis, className }: Props) {
  const signals = buildSignals(kpis);

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
      aria-label="Reviews and response"
    >
      <AdminSurfaceCardHeader
        icon={MessageCircle}
        title="Reviews & response"
        iconClassName="bg-muted/80"
      />

      <ul className="flex flex-1 flex-col justify-center gap-3.5">
        {signals.map((signal) => (
          <li
            key={signal.key}
            className="grid grid-cols-[minmax(0,7.25rem)_1fr_2.5rem] items-center gap-2 sm:grid-cols-[minmax(0,8.5rem)_1fr_2.75rem]"
          >
            <div className="flex min-w-0 items-center gap-0.5">
              <span className="truncate text-sm">{signal.label}</span>
              <MetricInfoDot metric={signal.metric} label={signal.label} />
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{
                  width: `${signal.fillPct > 0 ? Math.max(signal.fillPct, 2) : 0}%`,
                  backgroundColor: signal.color,
                }}
              />
            </div>
            <span className="text-muted-foreground text-right text-xs tabular-nums">
              {signal.display}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
