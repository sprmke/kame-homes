import { useMemo } from 'react';

import { PieChart as PieChartIcon } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { prettyChannelLabel } from '@/features/dashboard/analytics/lib/channelLabels';
import type { AnalyticsDistributions } from '@/features/dashboard/analytics/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { cn } from '@/lib/utils';

type Props = {
  channelMix: AnalyticsDistributions['channelMix'];
  compact?: boolean;
  className?: string;
};

const CHANNEL_COLORS = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
  '#ef4444',
  '#14b8a6',
];

export function ChannelMixCard({ channelMix, compact = false, className }: Props) {
  const total = useMemo(() => channelMix.reduce((sum, item) => sum + item.count, 0), [channelMix]);

  const chartData = useMemo(
    () =>
      [...channelMix]
        .sort((a, b) => b.count - a.count)
        .map((entry, index) => ({
          ...entry,
          label: prettyChannelLabel(entry.channel),
          pct: total > 0 ? Math.round((entry.count / total) * 100) : 0,
          color: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
        })),
    [channelMix, total]
  );

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
      aria-label="Booking sources"
    >
      <AdminSurfaceCardHeader
        icon={PieChartIcon}
        title="Where bookings come from"
        description={compact ? undefined : 'Reservations by source in the selected period'}
        iconClassName="bg-muted/80"
      />

      <div
        className={cn(
          'relative flex flex-1 items-center justify-center',
          compact ? 'min-h-[160px] sm:min-h-[180px]' : 'min-h-[220px] sm:min-h-[260px]'
        )}
      >
        {chartData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius="58%"
                  outerRadius="88%"
                  paddingAngle={2.5}
                  dataKey="count"
                  nameKey="label"
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.channel} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
              <p className="truncate text-center text-base font-bold tabular-nums tracking-tight sm:text-2xl">
                {total}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px] font-medium sm:text-xs">
                {total === 1 ? 'booking' : 'bookings'}
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="border-muted size-[160px] rounded-full border-[18px] sm:size-[200px] sm:border-[22px]"
              aria-hidden
            />
            <p className="text-muted-foreground text-sm">No bookings in this period</p>
          </div>
        )}
      </div>

      {chartData.length > 0 ? (
        <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
          {chartData.map((item) => (
            <li key={item.channel} className="flex items-center gap-1.5 text-xs">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span className="text-foreground font-medium">{item.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {item.pct}% ({item.count})
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
