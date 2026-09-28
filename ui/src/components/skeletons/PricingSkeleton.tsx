import { BookingsCalendarSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardCompactChrome } from '@/features/dashboard/lib/dashboardChromeContext';
import { pricingCalendarFormGridClassName } from '@/features/dashboard/pricing/lib/pricingCalendarLayout';

/** Pricing page data region: stats row + calendar grid + rates sidebar (desktop). */
export function PricingPageBodySkeleton() {
  const compactChrome = useDashboardCompactChrome();

  return (
    <div className="space-y-3 sm:space-y-4" aria-busy="true" aria-label="Loading pricing">
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-14 min-w-[5.5rem] flex-1 rounded-xl sm:w-32 sm:flex-none"
          />
        ))}
      </div>
      <div className={pricingCalendarFormGridClassName(compactChrome)}>
        <BookingsCalendarSkeleton gridOnly />
        <div className="hidden space-y-3 lg:block">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="min-h-[8rem] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
