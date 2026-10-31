import { Skeleton } from '@/components/ui/skeleton';

function ManageCardSkeleton() {
  return (
    <div className="border-border/40 bg-muted/15 flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2.5">
      <Skeleton className="size-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32 max-w-full" />
        <Skeleton className="h-3 w-24 max-w-full" />
      </div>
      <Skeleton className="h-11 w-[5.5rem] shrink-0 rounded-lg" />
    </div>
  );
}

type Props = {
  /** Manage summary rows inside the bottom section (default 2). */
  manageRows?: number;
  ariaLabel?: string;
};

export function TelegramNotificationModuleSkeleton({
  manageRows = 2,
  ariaLabel = 'Loading notification settings',
}: Props) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label={ariaLabel}>
      <div className="border-border/60 bg-card rounded-xl border px-3 py-2 sm:px-4">
        <div className="flex min-h-[44px] items-center justify-between gap-3">
          <Skeleton className="h-4 w-48 max-w-[70%]" />
          <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
        </div>
      </div>

      <div className="border-border/60 bg-card @container space-y-3 rounded-xl border px-3 py-4 sm:px-4">
        <Skeleton className="h-4 w-36" />
        <div className="@lg:grid-cols-2 @lg:items-end @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] grid grid-cols-1 gap-3">
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <Skeleton className="@lg:col-span-2 @lg:w-28 @lg:justify-self-end @2xl:col-span-1 h-11 w-full rounded-lg" />
        </div>
      </div>

      <div className="border-border/60 bg-card space-y-3 rounded-xl border px-3 py-4 sm:px-4">
        <Skeleton className="h-4 w-40" />
        <div className="space-y-2">
          {Array.from({ length: manageRows }).map((_, index) => (
            <ManageCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
