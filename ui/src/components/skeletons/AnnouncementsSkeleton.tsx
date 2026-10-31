import { StatCardSkeleton } from '@/components/shared/StatCard';
import { Skeleton } from '@/components/ui/skeleton';

/** Host announcements: stat cards, then the feed card (or one detail card). */
export function HostAnnouncementsBodySkeleton({ detail = false }: { detail?: boolean } = {}) {
  return (
    <div
      className="flex flex-col gap-4 sm:gap-5"
      role="status"
      aria-live="polite"
      aria-label="Loading announcements"
    >
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="surface-card overflow-hidden" aria-hidden>
        {detail ? null : (
          <div className="border-border/50 flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="size-8 shrink-0 rounded-full" />
          </div>
        )}
        <div className="divide-border/50 divide-y">
          {Array.from({ length: detail ? 1 : 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5">
              <Skeleton className="h-10 w-0.5 shrink-0 rounded-full sm:h-11" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5 max-w-xs" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                {detail ? <Skeleton className="h-3 w-3/5" /> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
