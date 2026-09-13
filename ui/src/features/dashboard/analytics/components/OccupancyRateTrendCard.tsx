import { useState } from 'react';

import { TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { AnalyticsTrendPoint } from '@/features/dashboard/analytics/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import {
  SegmentedControl,
  cardHeaderSegmentedListClassName,
  cardHeaderSegmentedTriggerClassName,
} from '@/components/ui/sliding-tabs';
import { useIsBelowMd } from '@/hooks/useMediaQuery';
import {
  CHART_HEIGHT_CLASS,
  CHART_INCOME_COLOR,
  CHART_INFO_COLOR,
  defaultChartMargin,
  formatChartMoneyAxis,
} from '@/lib/charts/chartStyles';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type Metric = 'occupancy' | 'revenue';

type Props = {
  trend: AnalyticsTrendPoint[];
  title?: string;
  className?: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-08-13` -> `Aug 13`; `2026-08` -> `Aug`. Falls back to the raw value. */
function formatBucketTick(value: string): string {
  const parts = value.split('-').map(Number);
  if (parts.length >= 2 && parts[1] >= 1 && parts[1] <= 12) {
    const month = MONTHS[parts[1] - 1];
    return parts.length >= 3 && parts[2] ? `${month} ${parts[2]}` : month;
  }
  return value;
}

function TrendTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ payload: AnalyticsTrendPoint }>;
  metric: Metric;
}) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  return (
    <div className="border-border bg-card rounded-lg border px-3 py-2 shadow-lg">
      <p className="text-foreground text-sm font-semibold">{formatBucketTick(point.bucketStart)}</p>
      {metric === 'occupancy' ? (
        <p className="text-sm" style={{ color: CHART_INFO_COLOR }}>
          {point.occupancyRate}% booked
        </p>
      ) : (
        <p className="text-sm" style={{ color: CHART_INCOME_COLOR }}>
          {formatMoney(point.revenue)}
        </p>
      )}
    </div>
  );
}

export function OccupancyRateTrendCard({ trend, title = 'Occupancy & revenue', className }: Props) {
  const [metric, setMetric] = useState<Metric>('occupancy');
  const isBelowMd = useIsBelowMd();
  const stroke = metric === 'occupancy' ? CHART_INFO_COLOR : CHART_INCOME_COLOR;

  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: unknown }) => (
    <TrendTooltip
      active={active}
      payload={payload as Array<{ payload: AnalyticsTrendPoint }>}
      metric={metric}
    />
  );

  const xAxis = (
    <XAxis
      dataKey="bucketStart"
      tickFormatter={formatBucketTick}
      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isBelowMd ? 10 : 12 }}
      tickLine={false}
      axisLine={false}
      minTickGap={isBelowMd ? 24 : 16}
    />
  );

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
    >
      <AdminSurfaceCardHeader
        icon={TrendingUp}
        title={title}
        iconClassName="bg-muted/80"
        action={
          <SegmentedControl
            value={metric}
            onChange={setMetric}
            size="dense"
            equalSegments
            listClassName={cardHeaderSegmentedListClassName}
            triggerClassName={cn(cardHeaderSegmentedTriggerClassName, 'capitalize')}
            aria-label="Chart metric"
            options={[
              { value: 'occupancy', label: 'occupancy' },
              { value: 'revenue', label: 'revenue' },
            ]}
          />
        }
      />

      <div className={cn(CHART_HEIGHT_CLASS, 'min-h-0 flex-1')}>
        <ResponsiveContainer width="100%" height="100%">
          {metric === 'occupancy' ? (
            <BarChart data={trend} margin={defaultChartMargin(isBelowMd)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              {xAxis}
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isBelowMd ? 10 : 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
                width={36}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                content={renderTooltip}
              />
              <Bar dataKey="occupancyRate" fill={stroke} radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          ) : (
            <AreaChart data={trend} margin={defaultChartMargin(isBelowMd)}>
              <defs>
                <linearGradient id="analyticsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={stroke} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              {xAxis}
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isBelowMd ? 10 : 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatChartMoneyAxis(Number(value))}
                width={44}
              />
              <Tooltip content={renderTooltip} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={stroke}
                strokeWidth={2}
                fill="url(#analyticsRevenueFill)"
                fillOpacity={1}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}
