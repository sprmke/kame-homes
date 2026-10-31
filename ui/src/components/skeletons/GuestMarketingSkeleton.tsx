import { ListingGridSkeleton } from '@/components/skeletons/ListingGridSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Properties / parkings browse under a development (hero + toolbar + grid). */
export function PublicListingBrowseSkeleton() {
  return (
    <div
      className="bg-background min-h-screen pb-16"
      aria-busy="true"
      aria-label="Loading listings"
    >
      <Skeleton className="h-48 w-full rounded-none sm:h-56" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Skeleton className="h-11 w-28 rounded-full" />
            <Skeleton className="h-11 w-24 rounded-full" />
          </div>
          <Skeleton className="h-11 w-[8.5rem] rounded-full" />
        </div>
        <ListingGridSkeleton
          count={6}
          columnsClassName="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        />
      </div>
    </div>
  );
}

/** Development detail / sub-pages: hero band + content sections. */
export function DevelopmentDetailPageSkeleton() {
  return (
    <div className="min-w-0 space-y-6 pb-10" aria-busy="true" aria-label="Loading development">
      <Skeleton className="mx-auto aspect-[21/9] w-full max-w-6xl rounded-2xl sm:aspect-[2.4/1]" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-2/3 max-w-md" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-5/6 max-w-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function GuestAccountGateSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-lg space-y-4 p-4"
      aria-busy="true"
      aria-label="Loading account"
    >
      <Skeleton className="mx-auto size-20 rounded-full" />
      <Skeleton className="mx-auto h-4 w-40" />
      <div className="space-y-3 pt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PropertyChatPageSkeleton() {
  return (
    <div
      className="flex min-h-[50dvh] flex-col gap-3"
      aria-busy="true"
      aria-label="Loading messages"
    >
      <div className="flex items-center gap-3 border-b pb-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48 max-w-full" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              'h-14 max-w-[85%] rounded-2xl',
              i % 2 === 0 ? 'mr-auto w-[70%]' : 'ml-auto w-[60%]'
            )}
          />
        ))}
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}
