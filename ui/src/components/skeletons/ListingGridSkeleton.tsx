import {
  listingMapCanvasClass,
  listingMapMinHeightClass,
} from '@/features/guest/marketing/shared/lib/listingMapLayout';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ListingGridSkeletonProps = {
  count?: number;
  columnsClassName?: string;
  imageAspectClassName?: string;
};

export function ListingGridSkeleton({
  count = 8,
  columnsClassName = 'grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  imageAspectClassName = 'aspect-square',
}: ListingGridSkeletonProps) {
  return (
    <div className={cn('grid', columnsClassName)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className={cn('w-full rounded-xl', imageAspectClassName)} />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

type ListingRowSkeletonProps = {
  count?: number;
  maxWidthClassName?: string;
};

/** Mirrors `PropertyListItem`'s real card shape: stacked image on mobile, side-by-side from `md:`. */
export function ListingRowSkeleton({
  count = 6,
  maxWidthClassName = 'max-w-3xl',
}: ListingRowSkeletonProps) {
  return (
    <div className={cn('mx-auto space-y-4', maxWidthClassName)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="border-border bg-card flex flex-col overflow-hidden rounded-2xl border shadow-sm md:flex-row"
        >
          <Skeleton className="aspect-[16/10] w-full shrink-0 rounded-none md:aspect-[4/3] md:w-80 lg:w-96" />
          <div className="flex flex-1 flex-col gap-4 p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-2/3 rounded-md" />
              </div>
              <Skeleton className="h-7 w-16 shrink-0 rounded-lg" />
            </div>
            <Skeleton className="h-3.5 w-1/2" />
            <div className="flex flex-wrap items-center gap-4">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="border-border mt-auto flex items-center justify-between gap-3 border-t pt-4">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type ListingCardListSkeletonProps = {
  count?: number;
  maxWidthClassName?: string;
  imageAspectClassName?: string;
};

/**
 * Single-column vertical card skeleton for list views whose real component just
 * renders the same card used in grid mode (e.g. `DevelopmentCard`, `ParkingSlotCard`)
 * in one column, rather than `PropertyListItem`'s wide row layout.
 */
export function ListingCardListSkeleton({
  count = 6,
  maxWidthClassName = 'max-w-3xl',
  imageAspectClassName = 'aspect-[16/9]',
}: ListingCardListSkeletonProps) {
  return (
    <div className={cn('mx-auto space-y-4', maxWidthClassName)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm">
          <Skeleton className={cn('w-full rounded-none', imageAspectClassName)} />
          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-10 shrink-0" />
            </div>
            <Skeleton className="h-3 w-1/2" />
            <div className="flex items-center justify-between gap-3 pt-1">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type ListingLocationRowsSkeletonProps = {
  sectionCount?: number;
  cardsPerSection?: number;
  cardWidthClassName?: string;
  imageAspectClassName?: string;
};

export function ListingLocationRowsSkeleton({
  sectionCount = 3,
  cardsPerSection = 6,
  cardWidthClassName = 'w-[240px] sm:w-[260px]',
  imageAspectClassName = 'aspect-square',
}: ListingLocationRowsSkeletonProps) {
  return (
    <div className="min-w-0 space-y-10 sm:space-y-12" aria-hidden>
      {Array.from({ length: sectionCount }).map((_, s) => (
        <div key={s} className="min-w-0 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-40 rounded-md" />
            <div className="hidden items-center gap-2 sm:flex">
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-11 w-11 rounded-full" />
            </div>
          </div>
          <div className="flex min-w-0 gap-4 overflow-x-hidden pb-1">
            {Array.from({ length: cardsPerSection }).map((_, i) => (
              <div key={i} className={cn('shrink-0 space-y-2', cardWidthClassName)}>
                <Skeleton className={cn('w-full rounded-xl', imageAspectClassName)} />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListingMapSkeleton() {
  return (
    <div
      className={cn(
        'bg-muted animate-pulse rounded-xl',
        listingMapCanvasClass,
        listingMapMinHeightClass
      )}
      aria-hidden
    />
  );
}
