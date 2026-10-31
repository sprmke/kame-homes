import { useMemo, useState } from 'react';

import { TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { DashboardTrendPoint } from '@/features/dashboard/property/lib/types';

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

type ChartMetric = 'revenue' | 'bookings';

const EMPTY_REVENUE_AXIS_TICKS = [0, 1000, 2000, 3000, 4000] as const;
const EMPTY_REVENUE_AXIS_MAX = EMPTY_REVENUE_AXIS_TICKS.at(-1)!;

type Props = {
  data: DashboardTrendPoint[];
  isLoading?: boolean;
  className?: string;
};

function OrgTrendTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardTrendPoint; value: number }>;
  metric: ChartMetric;
}) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  return (
    <div className="border-border bg-card rounded-lg border px-3 py-2 shadow-lg">
      <p className="text-foreground text-sm font-semibold">{point.label}</p>
      {metric === 'revenue' ? (
        <p className="text-sm text-teal-700 dark:text-teal-300">{formatMoney(point.revenue)}</p>
      ) : (
        <p className="text-sm text-sky-600 dark:text-sky-400">
          {point.bookings} booking{point.bookings === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}

export function OrgRevenueBookingsChart({ data, isLoading, className }: Props) {
  const [metric, setMetric] = useState<ChartMetric>('revenue');
  const isBelowMd = useIsBelowMd();
  const stroke = metric === 'revenue' ? CHART_INCOME_COLOR : CHART_INFO_COLOR;
  const gradientId = metric === 'revenue' ? 'orgRevenueFill' : 'orgBookingsFill';

  const hasRevenueData = useMemo(() => data.some((point) => point.revenue > 0), [data]);
  const useEmptyRevenueAxis = metric === 'revenue' && !hasRevenueData;

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
    >
      <AdminSurfaceCardHeader
        icon={TrendingUp}
        title="Revenue Overview"
        description="Revenue & bookings over time"
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
              { value: 'revenue', label: 'revenue' },
              { value: 'bookings', label: 'bookings' },
            ]}
          />
        }
      />

      <div
        className={cn(
          CHART_HEIGHT_CLASS,
          'min-h-0 flex-1',
          isLoading && 'animate-pulse opacity-60'
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={defaultChartMargin(isBelowMd)}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={stroke} stopOpacity={0.3} />
                <stop offset="95%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isBelowMd ? 10 : 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isBelowMd ? 10 : 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) =>
                metric === 'revenue'
                  ? formatChartMoneyAxis(Number(value))
                  : String(Math.round(Number(value)))
              }
              domain={useEmptyRevenueAxis ? [0, EMPTY_REVENUE_AXIS_MAX] : undefined}
              ticks={useEmptyRevenueAxis ? [...EMPTY_REVENUE_AXIS_TICKS] : undefined}
              allowDecimals={metric === 'bookings'}
            />
            <Tooltip
              content={({ active, payload }) => (
                <OrgTrendTooltip
                  active={active}
                  payload={payload as Array<{ payload: DashboardTrendPoint; value: number }>}
                  metric={metric}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              fillOpacity={1}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
