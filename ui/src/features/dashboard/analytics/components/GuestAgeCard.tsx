import { useMemo } from 'react';

import { Users } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  GUEST_AGE_BUCKET_ORDER,
  fillDistributionRange,
} from '@/features/dashboard/analytics/lib/analyticsDistributionRange';
import type { AnalyticsDistributions } from '@/features/dashboard/analytics/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { useIsBelowMd } from '@/hooks/useMediaQuery';
import { CHART_INFO_COLOR, chartAxisTick, defaultChartMargin } from '@/lib/charts/chartStyles';
import { cn } from '@/lib/utils';

type Props = {
  guestAge: AnalyticsDistributions['guestAge'];
  className?: string;
};

export function GuestAgeCard({ guestAge, className }: Props) {
  const isBelowMd = useIsBelowMd();
  const chartData = useMemo(
    () => fillDistributionRange(guestAge, GUEST_AGE_BUCKET_ORDER),
    [guestAge]
  );
  const hasAgeSignal = chartData.some((entry) => entry.count > 0);

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
    >
      <AdminSurfaceCardHeader icon={Users} title="Guest age" iconClassName="bg-muted/80" />

      <div className="relative min-h-[188px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ ...defaultChartMargin(isBelowMd), top: 8, bottom: 4 }}
            barCategoryGap="18%"
          >
            <XAxis
              dataKey="bucket"
              tick={chartAxisTick(isBelowMd)}
              tickLine={false}
              axisLine={false}
              interval={0}
              tickMargin={8}
              height={36}
            />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const point = payload[0].payload as { bucket: string; count: number };
                return (
                  <div className="border-border bg-card rounded-lg border px-3 py-2 shadow-lg">
                    <p className="text-foreground text-sm font-semibold">{point.bucket}</p>
                    <p className="text-sm" style={{ color: CHART_INFO_COLOR }}>
                      {point.count} {point.count === 1 ? 'guest' : 'guests'}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" fill={CHART_INFO_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
        {!hasAgeSignal ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
            <p className="text-muted-foreground text-center text-xs">
              No age data for this range yet
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
