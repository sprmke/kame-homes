import { AdminMetricCardSkeleton } from '@/features/dashboard/bookings/components/AdminMetricCard';

import { Skeleton } from '@/components/ui/skeleton';
/** Matches `BookingsSummaryCards` four stage cards. */
export function BookingsStageSummarySkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
      aria-busy="true"
      aria-label="Loading summary"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <AdminMetricCardSkeleton key={i} style={{ opacity: 1 - i * 0.05 }} />
      ))}
    </div>
  );
}

/** Horizontal kanban columns with card stacks (phone scrolls). */
export function BookingsKanbanSkeleton() {
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-busy="true"
      aria-label="Loading board"
    >
      {Array.from({ length: 5 }).map((_, col) => (
        <div
          key={col}
          className="flex w-[min(100%,17rem)] shrink-0 flex-col gap-2 sm:w-[17rem]"
          style={{ opacity: 1 - col * 0.06 }}
        >
          <div className="flex items-center justify-between gap-2 px-0.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: col % 2 === 0 ? 2 : 1 }).map((__, row) => (
              <div key={row} className="surface-card space-y-2 p-3">
                <Skeleton className="h-5 w-20 rounded-md" />
                <div className="flex items-center gap-2">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2.5 w-2/3" />
                  </div>
                </div>
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
