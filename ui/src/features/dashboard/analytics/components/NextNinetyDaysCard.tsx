import { Link, useParams } from 'react-router-dom';

import { CalendarClock } from 'lucide-react';

import { MetricInfoDot } from '@/features/dashboard/analytics/components/MetricInfoDot';
import type { AnalyticsForward, AnalyticsPickup } from '@/features/dashboard/analytics/lib/types';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  forward: AnalyticsForward;
  pickup: AnalyticsPickup;
  className?: string;
};

export function NextNinetyDaysCard({ forward, pickup, className }: Props) {
  const { orgSlug = '', propertySlug = '' } = useParams<{
    orgSlug: string;
    propertySlug: string;
  }>();
  const clamped = Math.max(0, Math.min(100, forward.occupancyOnBooks));
  const openNights = Math.max(0, forward.nightsAvailable - forward.nightsBooked);

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
    >
      <AdminSurfaceCardHeader
        icon={CalendarClock}
        title="Next 90 days"
        iconClassName="bg-muted/80"
      />

      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-end justify-between gap-3">
            <div className="flex items-center gap-0.5">
              <p className="text-muted-foreground text-xs font-medium">Booked nights</p>
              <MetricInfoDot metric="occupancyOnBooks" label="booked nights" />
            </div>
            <p className="text-foreground text-2xl font-bold tabular-nums">{clamped}%</p>
          </div>
          <div className="bg-muted mt-2 h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-500"
              style={{ width: `${clamped}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {forward.nightsBooked} of {forward.nightsAvailable} nights reserved
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-0.5">
              <p className="text-muted-foreground text-xs font-medium">Confirmed revenue</p>
              <MetricInfoDot metric="revenueOnBooks" label="confirmed revenue" />
            </div>
            <p className="text-foreground mt-1 text-lg font-bold tabular-nums sm:text-xl">
              {formatMoney(forward.revenueOnBooks)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium">Open nights</p>
            <p className="text-foreground mt-1 text-lg font-bold tabular-nums sm:text-xl">
              {openNights}
            </p>
            {openNights > 0 ? (
              <Link
                to={propertySectionPath(orgSlug, propertySlug, 'pricing')}
                className="text-primary mt-0.5 inline-flex min-h-[44px] items-center text-xs font-medium hover:underline lg:min-h-0"
              >
                Adjust pricing
              </Link>
            ) : (
              <p className="text-muted-foreground mt-1 text-xs">All nights booked</p>
            )}
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          <span className="text-foreground font-medium tabular-nums">{pickup.last7Days}</span>
          {' new in the last 7 days · '}
          <span className="tabular-nums">{pickup.last30Days}</span>
          {' in the last 30'}
        </p>
      </div>
    </section>
  );
}
