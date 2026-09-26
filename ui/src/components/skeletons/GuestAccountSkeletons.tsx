import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function GuestProfileFormSkeleton({
  embedded = false,
  className,
}: {
  embedded?: boolean;
  className?: string;
} = {}) {
  if (embedded) {
    return (
      <div className={cn('space-y-4', className)} aria-busy="true" aria-label="Loading profile">
        <div className="flex justify-center px-1 pb-1 pt-2">
          <Skeleton className="size-24 rounded-full sm:size-28" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={cn('h-10 w-full rounded-md', i === 2 && 'h-[88px]')} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('grid grid-cols-1 gap-6 sm:grid-cols-[auto,1fr] sm:gap-8', className)}
      aria-busy="true"
      aria-label="Loading profile"
    >
      <Skeleton className="mx-auto size-28 shrink-0 rounded-full sm:mx-0 sm:size-32" />
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-[120px] w-full rounded-md" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function GuestVoucherRowSkeleton() {
  return (
    <div className="border-border bg-card rounded-xl border px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32 max-w-full" />
        </div>
        <Skeleton className="h-5 w-14 rounded-md" />
      </div>
    </div>
  );
}

export function GuestVouchersPageSkeleton({ rows = 4 }: { rows?: number } = {}) {
  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      aria-busy="true"
      aria-label="Loading vouchers"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <GuestVoucherRowSkeleton key={i} />
      ))}
    </div>
  );
}
