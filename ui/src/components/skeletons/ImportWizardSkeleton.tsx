import { ListRowsSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Skeleton } from '@/components/ui/skeleton';

/** Import wizard commit step while batch write runs. */
export function ImportCommitStepSkeleton({ rowCount = 5 }: { rowCount?: number } = {}) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Importing bookings">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="surface-card p-3">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <ListRowsSkeleton rows={rowCount} label="Importing rows" />
    </div>
  );
}
