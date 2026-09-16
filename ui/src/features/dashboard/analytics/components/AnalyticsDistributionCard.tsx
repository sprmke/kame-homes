import { useMemo } from 'react';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { fillDistributionRange } from '@/features/dashboard/analytics/lib/analyticsDistributionRange';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { useIsBelowMd } from '@/hooks/useMediaQuery';
import { chartAxisTick, defaultChartMargin } from '@/lib/charts/chartStyles';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  sectionLabel: string;
  data: Array<{ bucket: string; count: number }>;
  bucketOrder: readonly string[];
  dataKeyLabel: string;
  color: string;
  className?: string;
};

function MiniBarChart({
  data,
  dataKeyLabel,
  color,
  isBelowMd,
}: {
  data: Array<{ bucket: string; count: number }>;
  dataKeyLabel: string;
  color: string;
  isBelowMd: boolean;
}) {
  const hasSignal = data.some((entry) => entry.count > 0);

  return (
    <div className="relative h-[170px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ ...defaultChartMargin(isBelowMd), top: 8 }}
          barCategoryGap="18%"
        >
          <XAxis
            dataKey="bucket"
            tick={chartAxisTick(isBelowMd)}
            tickLine={false}
            axisLine={false}
            interval={0}
            tickMargin={6}
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
                  <p className="text-sm" style={{ color }}>
                    {point.count} {dataKeyLabel}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
      {!hasSignal ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
          <p className="text-muted-foreground text-center text-xs">No data for this range yet</p>
        </div>
      ) : null}
    </div>
  );
}

export function AnalyticsDistributionCard({
  icon,
  title,
  sectionLabel,
  data,
  bucketOrder,
  dataKeyLabel,
  color,
  className,
}: Props) {
  const isBelowMd = useIsBelowMd();
  const chartData = useMemo(() => fillDistributionRange(data, bucketOrder), [data, bucketOrder]);

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
    >
      <AdminSurfaceCardHeader icon={icon} title={title} iconClassName="bg-muted/80" />
      <p className="text-muted-foreground mb-2 text-xs font-medium">{sectionLabel}</p>
      <MiniBarChart
        data={chartData}
        dataKeyLabel={dataKeyLabel}
        color={color}
        isBelowMd={isBelowMd}
      />
    </section>
  );
}
