import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function ProfileFieldSkeleton({
  label,
  textarea = false,
  embedded = false,
}: {
  label: string;
  textarea?: boolean;
  embedded?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium leading-none">{label}</p>
      <Skeleton
        className={cn(
          'w-full rounded-md',
          textarea ? (embedded ? 'h-[88px]' : 'h-[120px]') : 'h-10'
        )}
      />
    </div>
  );
}

const PROFILE_FIELDS = [
  { label: 'Display name' },
  { label: 'Bio', textarea: true },
  { label: 'Phone' },
  { label: 'Location' },
];

export function GuestProfileFormSkeleton({
  embedded = false,
  className,
}: {
  embedded?: boolean;
  className?: string;
} = {}) {
  if (embedded) {
    return (
      <div
        role="status"
        className={cn('space-y-4', className)}
        aria-busy="true"
        aria-label="Loading profile"
      >
        <div className="flex justify-center px-1 pb-1 pt-2">
          <Skeleton className="size-24 rounded-full sm:size-28" />
        </div>
        <div className="space-y-4">
          {PROFILE_FIELDS.map((field) => (
            <ProfileFieldSkeleton
              key={field.label}
              label={field.label}
              textarea={field.textarea}
              embedded
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn('grid grid-cols-1 gap-6 sm:grid-cols-[auto,1fr] sm:gap-8', className)}
      aria-busy="true"
      aria-label="Loading profile"
    >
      <Skeleton className="mx-auto size-28 shrink-0 rounded-full sm:mx-0 sm:size-32" />
      <div className="space-y-3">
        {PROFILE_FIELDS.map((field) => (
          <ProfileFieldSkeleton key={field.label} label={field.label} textarea={field.textarea} />
        ))}
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

export function GuestReviewsPageSkeleton() {
  return (
    <div role="status" className="space-y-3" aria-busy="true" aria-label="Loading reviews">
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
    </div>
  );
}

export function GuestVouchersPageSkeleton({ rows = 4 }: { rows?: number } = {}) {
  return (
    <div
      role="status"
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
