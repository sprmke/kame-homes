import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { ContextualActionBar } from '@/components/mobile/ContextualActionBar';
import { ListingGridSkeleton } from '@/components/skeletons/ListingGridSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Properties / parkings / developments browse: hero + filters sidebar + toolbar + grid. */
export function PublicListingBrowseSkeleton() {
  return (
    <div
      role="status"
      className="bg-background min-h-screen pb-16"
      aria-busy="true"
      aria-label="Loading listings"
    >
      <Skeleton className="h-48 w-full rounded-none sm:h-56" />
      <div className="flex min-w-0">
        <aside className="border-border hidden w-72 shrink-0 border-r p-4 lg:block">
          <div className="space-y-5">
            {['Price', 'Type', 'Bedrooms', 'Amenities', 'Sort'].map((label) => (
              <div key={label} className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium">{label}</p>
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24 rounded-full" />
              <Skeleton className="h-10 w-24 rounded-full" />
            </div>
            <Skeleton className="h-10 w-[8.5rem] rounded-full" />
          </div>
          <div className="px-4 pb-6 sm:px-6">
            <ListingGridSkeleton
              count={6}
              columnsClassName="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function OverviewStatSkeleton() {
  return (
    <div className="flex min-w-0 items-center gap-2 md:gap-3">
      <Skeleton className="size-7 shrink-0 rounded-full md:size-10" />
      <Skeleton className="h-4 w-16 max-w-full rounded-full" />
    </div>
  );
}

function CheckInTimeSkeleton() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div>
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
    </div>
  );
}

function AmenityRowSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="size-10 shrink-0 rounded-lg" />
      <Skeleton className="h-4 w-28 max-w-full rounded-full" />
    </div>
  );
}

type PropertyDetailPageSkeletonProps = {
  /** Phone reserve dock. Off in the page editor, where a fixed bar would leave the preview frame. */
  reserveBar?: boolean;
  /** Booking column: `auto` follows the listing container (`@5xl`). */
  bookingColumn?: 'auto' | 'show' | 'hide';
  /** Page editor frame: no public nav offset. */
  framed?: boolean;
};

/**
 * Public property detail. Mirrors gallery, title + type pill, stats card,
 * host card, and the check-in card with the cancellation note on the right.
 */
export function PropertyDetailPageSkeleton({
  reserveBar = true,
  bookingColumn = 'auto',
  framed = false,
}: PropertyDetailPageSkeletonProps = {}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading property"
      className={cn(
        '@container bg-background min-h-screen w-full min-w-0',
        framed ? 'pt-4' : 'public-page-top',
        !framed && bottomTabBarOffsetClassName(),
        framed && (bookingColumn === 'hide' ? 'pb-24' : 'pb-4')
      )}
    >
      <div className="@xl:px-6 @5xl:px-8 container mx-auto px-4">
        <Skeleton className="@xl:h-[400px] @3xl:h-[500px] h-[200px] w-full rounded-2xl" />
      </div>

      <div className="@xl:px-6 @5xl:px-8 @xl:py-8 container mx-auto px-4 py-5">
        <div
          className={cn(
            '@xl:gap-8 grid grid-cols-1 gap-6',
            bookingColumn !== 'hide' && '@5xl:grid-cols-3 @5xl:gap-12'
          )}
        >
          <div
            className={cn(
              '@xl:space-y-10 min-w-0 space-y-7',
              bookingColumn !== 'hide' && '@5xl:col-span-2'
            )}
          >
            <div className="@xl:space-y-6 space-y-4">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <Skeleton className="h-7 w-48 max-w-[70%] rounded-md sm:h-8 sm:w-72" />
                  <Skeleton className="@xl:h-7 @xl:w-[4.5rem] h-5 w-16 shrink-0 rounded-full" />
                </div>
                <Skeleton className="h-5 w-full max-w-md rounded-full" />
              </div>

              <div className="border-border bg-card @md:gap-4 @md:px-4 @md:py-3 @2xl:grid-cols-4 @2xl:px-6 grid grid-cols-2 gap-2 rounded-2xl border px-3 py-2.5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <OverviewStatSkeleton key={index} />
                ))}
              </div>

              <div className="border-border bg-card @md:gap-4 @md:p-4 flex min-w-0 items-center gap-3 rounded-2xl border p-3">
                <Skeleton className="size-11 shrink-0 rounded-full sm:size-12" />
                <Skeleton className="h-4 w-40 max-w-[50%] rounded-full" />
                <Skeleton className="ml-auto h-9 w-[6.5rem] shrink-0 rounded-lg md:h-10" />
              </div>

              <div className="bg-muted/50 @md:flex-row @md:items-center flex flex-col gap-4 rounded-2xl p-4">
                <div className="@md:shrink-0 flex min-w-0 flex-wrap items-center gap-4">
                  <CheckInTimeSkeleton />
                  <div className="bg-border h-px w-full sm:h-8 sm:w-px" />
                  <CheckInTimeSkeleton />
                </div>
                <div className="bg-border @md:h-8 @md:w-px @md:shrink-0 h-px w-full" />
                <div className="@md:flex-1 flex min-w-0 items-start gap-3">
                  <Skeleton className="mt-0.5 size-5 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-5 w-56 max-w-full rounded-full" />
                    <Skeleton className="h-5 w-full rounded-full" />
                    <Skeleton className="@md:hidden h-5 w-3/5 rounded-full" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-foreground @xl:text-xl text-lg font-semibold">
                  About this place
                </h2>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full rounded-full" />
                  <Skeleton className="h-4 w-full rounded-full" />
                  <Skeleton className="h-4 w-4/5 rounded-full" />
                  <Skeleton className="h-4 w-2/3 rounded-full" />
                </div>
              </div>
            </div>

            <div>
              <hr className="border-border @xl:mb-10 mb-7" />
              <div className="space-y-6">
                <h2 className="text-foreground @xl:text-xl text-lg font-semibold">
                  What this place offers
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <AmenityRowSkeleton key={index} />
                  ))}
                </div>
                <Skeleton className="h-10 w-full rounded-xl sm:w-44" />
              </div>
            </div>

            <div>
              <hr className="border-border @xl:mb-10 mb-7" />
              <div className="space-y-4">
                <h2 className="text-foreground @xl:text-xl text-lg font-semibold">
                  Where you&apos;ll be
                </h2>
                <Skeleton className="h-[300px] w-full rounded-2xl sm:h-[400px]" />
              </div>
            </div>
          </div>

          <div
            className={cn(
              'min-w-0',
              bookingColumn === 'show' && 'block',
              bookingColumn === 'hide' && 'hidden',
              bookingColumn === 'auto' && '@5xl:block hidden'
            )}
          >
            <div className="border-border bg-card overflow-hidden rounded-2xl border shadow-xl">
              <div className="border-border border-b p-6">
                <Skeleton className="h-8 w-36 rounded-md" />
              </div>
              <div className="space-y-4 p-6">
                <Skeleton className="h-[4.25rem] w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {reserveBar ? (
        <ContextualActionBar className="lg:hidden">
          <div className="flex w-full items-center justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-3.5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-11 w-28 shrink-0 rounded-full" />
          </div>
        </ContextualActionBar>
      ) : null}
    </div>
  );
}

/** Public parking detail: gallery, title/meta, description, booking card. */
export function ParkingDetailPageSkeleton() {
  return (
    <div
      role="status"
      className="@container bg-background public-page-top min-h-screen w-full min-w-0 pb-20"
      aria-busy="true"
      aria-label="Loading parking"
    >
      <div className="@xl:px-6 @5xl:px-8 container mx-auto px-4">
        <Skeleton className="@xl:h-[400px] @3xl:h-[500px] h-[280px] w-full rounded-2xl" />
      </div>

      <div className="@xl:px-6 @5xl:px-8 @xl:py-8 container mx-auto px-4 py-5">
        <div className="@5xl:grid-cols-3 @5xl:gap-12 grid grid-cols-1 gap-8">
          <div className="@5xl:col-span-2 @xl:space-y-10 min-w-0 space-y-7">
            <div className="space-y-4">
              <Skeleton className="h-8 w-2/3 rounded-lg" />
              <Skeleton className="h-4 w-1/3 rounded-full" />
              <div className="flex flex-wrap gap-4">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            </div>

            <hr className="border-border" />

            <div className="space-y-3">
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="h-4 w-2/3 rounded-full" />
            </div>
          </div>

          <div className="@5xl:block hidden">
            <div className="border-border space-y-5 rounded-2xl border p-6 shadow-sm">
              <Skeleton className="h-7 w-32 rounded-lg" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Development detail / sub-pages: hero band + content sections. */
export function DevelopmentDetailPageSkeleton() {
  return (
    <div
      role="status"
      className="min-w-0 space-y-6 pb-10"
      aria-busy="true"
      aria-label="Loading development"
    >
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

/** Marketing landing / for-hosts: centered hero, then alternating feature sections. */
export function PublicLandingPageSkeleton() {
  return (
    <div
      role="status"
      className="bg-background min-h-screen pb-20"
      aria-busy="true"
      aria-label="Loading page"
    >
      <section className="pt-[calc(var(--public-nav-h)+2rem)] md:pt-[calc(var(--public-nav-h)+4rem)]">
        <div className="container mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <Skeleton className="mx-auto h-7 w-36 rounded-full" />
          <div className="mt-5 space-y-3">
            <Skeleton className="mx-auto h-10 w-full max-w-3xl rounded-lg sm:h-14" />
            <Skeleton className="mx-auto h-10 w-3/4 max-w-2xl rounded-lg sm:h-14" />
          </div>
          <div className="mx-auto mt-6 max-w-3xl space-y-2">
            <Skeleton className="mx-auto h-4 w-full" />
            <Skeleton className="mx-auto h-4 w-5/6" />
          </div>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Skeleton className="h-12 w-40 rounded-full" />
            <Skeleton className="h-12 w-44 rounded-full" />
          </div>
          <Skeleton className="mx-auto mt-10 aspect-[16/9] w-full max-w-4xl rounded-2xl" />
        </div>
      </section>

      <div className="mx-auto mt-16 max-w-6xl space-y-16 px-4 sm:px-6 lg:px-8">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'grid items-center gap-8 lg:grid-cols-2 lg:gap-12',
              index % 2 === 1 && 'lg:[&>*:first-child]:order-2'
            )}
          >
            <div className="space-y-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-2/3 max-w-md" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GuestAccountGateSkeleton() {
  return (
    <div
      role="status"
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
      role="status"
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
