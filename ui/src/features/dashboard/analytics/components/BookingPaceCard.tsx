import { useMemo, useState } from 'react';

import { CalendarPlus } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { AnalyticsPaceMonth } from '@/features/dashboard/analytics/lib/types';

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
  chartAxisTick,
  defaultChartMargin,
  formatChartMoneyAxis,
} from '@/lib/charts/chartStyles';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type Metric = 'reservations' | 'revenue';

type Props = {
  pace: AnalyticsPaceMonth[];
  className?: string;
};

type ChartPoint = {
  label: string;
  fullLabel: string;
  current: number;
  lastYear: number;
};

function formatBucketLabel(bucketStart: string, compact: boolean): string {
  const parts = bucketStart.split('-').map(Number);
  if (parts.length < 2) return bucketStart;
  const date = new Date(parts[0], parts[1] - 1, parts[2] || 1);
  if (compact) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function integerYTicks(maxValue: number): number[] {
  const top = Math.max(1, Math.ceil(maxValue));
  if (top <= 5) return Array.from({ length: top + 1 }, (_, i) => i);
  const step = Math.ceil(top / 4);
  const ticks: number[] = [0];
  for (let value = step; value < top; value += step) ticks.push(value);
  if (ticks[ticks.length - 1] !== top) ticks.push(top);
  return ticks;
}

function ActivityTooltip({
  active,
  payload,
  metric,
  stroke,
  showLastYear,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint; dataKey?: string | number; value?: number | string }>;
  metric: Metric;
  stroke: string;
  showLastYear: boolean;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const fmt = (v: number) =>
    metric === 'revenue'
      ? formatMoney(v)
      : `${Math.round(v)} ${Math.round(v) === 1 ? 'booking' : 'bookings'}`;
  return (
    <div className="border-border bg-card rounded-lg border px-3 py-2 shadow-lg">
      <p className="text-foreground text-sm font-semibold">{point.fullLabel}</p>
      <p className="text-sm" style={{ color: stroke }}>
        {fmt(point.current)}
      </p>
      {showLastYear ? (
        <p className="text-muted-foreground text-sm">Last year: {fmt(point.lastYear)}</p>
      ) : null}
    </div>
  );
}

export function BookingPaceCard({ pace, className }: Props) {
  const [metric, setMetric] = useState<Metric>('reservations');
  const isBelowMd = useIsBelowMd();
  const stroke = metric === 'reservations' ? CHART_INFO_COLOR : CHART_INCOME_COLOR;
  const lastYearStroke = 'hsl(var(--muted-foreground))';
  const gradientId = metric === 'reservations' ? 'newBookingsFill' : 'newBookingsRevenueFill';

  const chartData = useMemo((): ChartPoint[] => {
    return pace.map((bucket) => ({
      label: formatBucketLabel(bucket.monthStart, true),
      fullLabel: formatBucketLabel(bucket.monthStart, false),
      current: metric === 'reservations' ? bucket.reservations : bucket.revenue,
      lastYear: metric === 'reservations' ? bucket.reservationsLastYear : bucket.revenueLastYear,
    }));
  }, [pace, metric]);

  const showLastYear = useMemo(() => chartData.some((point) => point.lastYear > 0), [chartData]);

  const yMax = useMemo(() => {
    return chartData.reduce(
      (max, point) => Math.max(max, point.current, showLastYear ? point.lastYear : 0),
      0
    );
  }, [chartData, showLastYear]);

  const reservationTicks = useMemo(() => integerYTicks(yMax), [yMax]);
  const hasSignal = yMax > 0;

  if (!hasSignal) {
    return (
      <section
        className={cn(
          'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
          className
        )}
        aria-label="New bookings"
      >
        <AdminSurfaceCardHeader
          icon={CalendarPlus}
          title="New bookings"
          iconClassName="bg-muted/80"
        />
        <div className="border-border/60 flex flex-1 items-center justify-center rounded-lg border border-dashed px-4 py-10">
          <p className="text-muted-foreground text-center text-xs">No new bookings in this range</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
      aria-label="New bookings"
    >
      <AdminSurfaceCardHeader
        icon={CalendarPlus}
        title="New bookings"
        iconClassName="bg-muted/80"
        action={
          <SegmentedControl
            value={metric}
            onChange={setMetric}
            size="dense"
            equalSegments
            listClassName={cardHeaderSegmentedListClassName}
            triggerClassName={cn(cardHeaderSegmentedTriggerClassName, 'capitalize')}
            aria-label="New bookings metric"
            options={[
              { value: 'reservations', label: 'bookings' },
              { value: 'revenue', label: 'revenue' },
            ]}
          />
        }
      />

      <div className={CHART_HEIGHT_CLASS}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={defaultChartMargin(isBelowMd)}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={stroke} stopOpacity={0.28} />
                <stop offset="95%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={chartAxisTick(isBelowMd)}
              tickLine={false}
              axisLine={false}
              minTickGap={isBelowMd ? 36 : 28}
              interval="preserveStartEnd"
            />
            {metric === 'reservations' ? (
              <YAxis
                domain={[0, Math.max(1, Math.ceil(yMax))]}
                ticks={reservationTicks}
                allowDecimals={false}
                tick={chartAxisTick(isBelowMd)}
                tickLine={false}
                axisLine={false}
                width={28}
              />
            ) : (
              <YAxis
                domain={[0, 'auto']}
                tick={chartAxisTick(isBelowMd)}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatChartMoneyAxis(Number(value))}
                width={44}
              />
            )}
            <Tooltip
              content={({ active, payload }) => (
                <ActivityTooltip
                  active={active}
                  payload={
                    payload as Array<{
                      payload?: ChartPoint;
                      dataKey?: string | number;
                      value?: number | string;
                    }>
                  }
                  metric={metric}
                  stroke={stroke}
                  showLastYear={showLastYear}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey="current"
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              fillOpacity={1}
              dot={false}
              activeDot={{ r: 4 }}
            />
            {showLastYear ? (
              <Area
                type="monotone"
                dataKey="lastYear"
                stroke={lastYearStroke}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
                dot={false}
                activeDot={{ r: 3 }}
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        <li className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: stroke }}
            aria-hidden
          />
          <span className="text-muted-foreground">This period</span>
        </li>
        {showLastYear ? (
          <li className="flex items-center gap-1.5">
            <span
              className="border-muted-foreground/70 size-2.5 shrink-0 rounded-full border border-dashed bg-transparent"
              aria-hidden
            />
            <span className="text-muted-foreground">Last year</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
