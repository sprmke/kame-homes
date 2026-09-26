import { AdminMetricCardSkeleton } from '@/features/dashboard/bookings/components/AdminMetricCard';

import { ListRowsSkeleton } from '@/components/skeletons/AdminSkeletons';
import { cn } from '@/lib/utils';

type Props = {
  /** When set, shows header + metric skeleton row before the list rows. */
  metricCount?: number;
  /** Override the metric skeleton grid classes when the card count needs a different layout. */
  metricGridClassName?: string;
  className?: string;
};

export function SuperAdminPageLoading({ metricCount = 0, metricGridClassName, className }: Props) {
  return (
    <div className={cn('space-y-3 sm:space-y-4', className)} aria-busy="true" aria-label="Loading">
      {metricCount > 0 ? (
        <div className={metricGridClassName ?? 'grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4'}>
          {Array.from({ length: metricCount }).map((_, index) => (
            <AdminMetricCardSkeleton key={index} />
          ))}
        </div>
      ) : null}
      <ListRowsSkeleton rows={6} />
    </div>
  );
}
