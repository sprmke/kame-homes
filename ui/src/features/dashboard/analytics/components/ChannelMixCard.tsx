import { useMemo } from 'react';

import { PieChart as PieChartIcon } from 'lucide-react';

import {
  AnalyticsDonutChart,
  analyticsDonutColor,
} from '@/features/dashboard/analytics/components/AnalyticsDonutChart';
import { prettyChannelLabel } from '@/features/dashboard/analytics/lib/channelLabels';
import type { AnalyticsDistributions } from '@/features/dashboard/analytics/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { cn } from '@/lib/utils';

type Props = {
  channelMix: AnalyticsDistributions['channelMix'];
  compact?: boolean;
  className?: string;
};

export function ChannelMixCard({ channelMix, compact = false, className }: Props) {
  const total = useMemo(() => channelMix.reduce((sum, item) => sum + item.count, 0), [channelMix]);

  const slices = useMemo(
    () =>
      [...channelMix]
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count)
        .map((entry, index) => ({
          key: entry.channel,
          label: prettyChannelLabel(entry.channel),
          count: entry.count,
          color: analyticsDonutColor(index),
        })),
    [channelMix]
  );

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-visible p-3 sm:p-4',
        className
      )}
      aria-label="Booking sources"
    >
      <AdminSurfaceCardHeader
        icon={PieChartIcon}
        title="Where bookings come from"
        iconClassName="bg-muted/80"
      />

      <AnalyticsDonutChart
        slices={slices}
        centerValue={total}
        centerLabel={total === 1 ? 'booking' : 'bookings'}
        emptyMessage="No bookings in this period"
        compact={compact}
      />
    </section>
  );
}
