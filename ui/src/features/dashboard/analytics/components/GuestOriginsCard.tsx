import { useMemo } from 'react';

import { MapPin } from 'lucide-react';

import { collapseTopGuestOrigins } from '@/features/dashboard/analytics/lib/guestOriginsDisplay';
import type { AnalyticsDistributions } from '@/features/dashboard/analytics/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { CHART_INFO_COLOR } from '@/lib/charts/chartStyles';
import { cn } from '@/lib/utils';

type Props = {
  guestOrigins: AnalyticsDistributions['guestOrigins'];
  className?: string;
};

export function GuestOriginsCard({ guestOrigins, className }: Props) {
  const topOrigins = useMemo(() => collapseTopGuestOrigins(guestOrigins), [guestOrigins]);

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
    >
      <AdminSurfaceCardHeader icon={MapPin} title="Guest origins" iconClassName="bg-muted/80" />

      {topOrigins.length === 0 ? (
        <div className="border-border/60 relative flex min-h-[188px] flex-1 items-center justify-center rounded-lg border border-dashed px-4">
          <p className="text-muted-foreground text-center text-xs">
            No guest origins for this range yet
          </p>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col justify-center gap-2.5">
          {topOrigins.map((origin) => (
            <li
              key={origin.origin}
              className="grid grid-cols-[minmax(0,9.5rem)_1fr_2.75rem] items-center gap-2 sm:grid-cols-[minmax(0,12rem)_1fr_2.75rem]"
            >
              <span className="truncate text-sm" title={origin.origin}>
                {origin.origin}
              </span>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(origin.pct, 2)}%`,
                    backgroundColor: CHART_INFO_COLOR,
                  }}
                />
              </div>
              <span className="text-muted-foreground text-right text-xs tabular-nums">
                {origin.pct}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
