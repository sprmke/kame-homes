import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function GuestFormBrandHeaderSkeleton({ title }: { title?: string }) {
  return (
    <div className="relative space-y-6 pt-10 md:pt-14">
      <div className="absolute left-0 right-0 top-[-3.25rem] mx-auto flex justify-center md:top-[-4.25rem]">
        <Skeleton className="size-[88px] rounded-full md:size-[120px]" />
      </div>
      <div className="space-y-2 text-center">
        <Skeleton className="mx-auto h-3 w-36 max-w-[80%] rounded-full" />
        {title ? (
          <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
            {title}
          </h2>
        ) : (
          <Skeleton className="mx-auto h-8 w-48 max-w-[80%] rounded-lg" />
        )}
      </div>
    </div>
  );
}

/** Mirrors `GuestFormStepper`'s real `stepperDesktopWidthClass` breakpoints. */
function stepperSkeletonWidthClass(stepCount: number): string {
  if (stepCount <= 3) return 'max-w-md';
  if (stepCount === 4) return 'max-w-lg';
  return 'max-w-xl';
}

/**
 * Mirrors `GuestFormStepper`'s real markup — a bare `<nav>` (no card chrome), a
 * mobile progress bar, and a desktop step track using the same `trackInset` math.
 */
function GuestFormStepperSkeleton({ stepCount = 4 }: { stepCount?: number }) {
  const inset = `calc(100% / ${stepCount * 2})`;
  return (
    <nav className="w-full" aria-hidden>
      <div className="space-y-2.5 sm:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-1 w-full rounded-full" />
      </div>
      <div
        className={cn(
          'relative mx-auto hidden w-full pb-0.5 sm:flex',
          stepperSkeletonWidthClass(stepCount)
        )}
      >
        {stepCount > 1 ? (
          <div
            className="bg-border pointer-events-none absolute top-[1.125rem] h-0.5 -translate-y-1/2 rounded-full"
            style={{ left: inset, right: inset }}
            aria-hidden
          />
        ) : null}
        {Array.from({ length: stepCount }).map((_, i) => (
          <div key={i} className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-1">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-2.5 w-10" />
          </div>
        ))}
      </div>
    </nav>
  );
}

function GuestFormFieldSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

function GuestFormStepPanelSkeleton({
  fieldCount = 4,
  twoColumn = true,
}: {
  fieldCount?: number;
  twoColumn?: boolean;
}) {
  return (
    <div className="border-border/80 bg-card space-y-5 rounded-xl border px-4 py-5 shadow-sm sm:px-6 sm:py-6">
      <header className="border-separator flex items-center gap-3 border-b pb-4">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full max-w-md" />
        </div>
      </header>
      <div className={cn('grid gap-4', twoColumn && 'grid-cols-1 md:grid-cols-2 md:[&>*]:min-w-0')}>
        {Array.from({ length: fieldCount }).map((_, i) => (
          <GuestFormFieldSkeleton key={i} />
        ))}
      </div>
      <div className="border-separator flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-11 w-full rounded-xl sm:w-28" />
        <Skeleton className="h-11 w-full rounded-xl sm:w-32" />
      </div>
    </div>
  );
}

export function GuestFormPageSkeleton({
  title,
  embed = false,
}: {
  title?: string;
  /** Matches GuestForm's `embed?.compactChrome`: no brand header, tighter padding — for use inside GuestBookingFormModal. */
  embed?: boolean;
}) {
  return (
    <div
      className={cn('relative', embed ? 'space-y-4 p-0 sm:p-1' : 'space-y-6 p-4 sm:p-6 lg:p-8')}
      aria-busy="true"
      aria-label="Loading form"
    >
      {embed ? null : <GuestFormBrandHeaderSkeleton title={title} />}
      <GuestFormStepperSkeleton />
      <GuestFormStepPanelSkeleton fieldCount={4} />
    </div>
  );
}

export function PropertyCalendarBodySkeleton({
  dayCount = 35,
  gapClassName = 'gap-1.5',
}: {
  dayCount?: number;
  gapClassName?: string;
}) {
  return (
    <div className="w-full" aria-busy="true" aria-label="Loading calendar">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-6 w-36 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center py-1.5">
            <Skeleton className="h-2.5 w-6 rounded-full" />
          </div>
        ))}
      </div>

      <div className={cn('grid grid-cols-7', gapClassName)}>
        {Array.from({ length: dayCount }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function CalendarPageSkeleton() {
  return (
    <div
      className="relative min-w-0 space-y-6 p-4 sm:space-y-8 sm:p-6 lg:p-8"
      aria-busy="true"
      aria-label="Loading availability"
    >
      <GuestFormBrandHeaderSkeleton title="Check Availability" />
      <div className="mx-auto flex w-full max-w-[33rem] flex-col gap-6">
        <PropertyCalendarBodySkeleton />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Mirrors `SdFormReviewSection`'s real shape: star-rating card, feedback textarea, photo grid, submit button. */
function SdFormReviewSectionSkeleton() {
  return (
    <div className="space-y-6">
      <div className="border-primary/10 from-primary/[0.04] via-card to-muted/15 flex flex-col items-center gap-4 rounded-xl border bg-gradient-to-b px-4 py-6 sm:px-6">
        <Skeleton className="h-3 w-16" />
        <div className="flex items-center justify-center gap-1.5 sm:gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="size-8 rounded-full sm:size-9" />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-[120px] w-full rounded-xl" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-3.5 w-14" />
        <div className="grid grid-cols-3 gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      </div>

      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}

/** Mirrors `SdFormPage`'s step-1 shape: 3-step stepper, bordered greeting header, review section. */
export function SdFormPageSkeleton({ title }: { title: string }) {
  return (
    <div
      className="relative space-y-6 p-4 sm:p-6 lg:p-8"
      aria-busy="true"
      aria-label="Loading form"
    >
      <GuestFormBrandHeaderSkeleton title={title} />
      <GuestFormStepperSkeleton stepCount={3} />

      <div className="border-separator space-y-4 border-b px-5 pb-5">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-5/6" />
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>

      <div className="px-5 sm:px-6">
        <SdFormReviewSectionSkeleton />
      </div>
    </div>
  );
}

/** Mirrors `GuestReviewPage`'s 'review' phase: no stepper, narrower max-w-xl shell, plain centered greeting. */
export function GuestReviewPageSkeleton({ title }: { title: string }) {
  return (
    <div
      className="relative mx-auto w-full max-w-xl space-y-6 p-4 sm:p-6 lg:p-8"
      aria-busy="true"
      aria-label="Loading form"
    >
      <GuestFormBrandHeaderSkeleton title={title} />
      <div className="space-y-2 px-1 text-center sm:px-2">
        <Skeleton className="mx-auto h-3.5 w-full max-w-md" />
        <Skeleton className="mx-auto h-3.5 w-2/3 max-w-md" />
      </div>
      <SdFormReviewSectionSkeleton />
    </div>
  );
}

/** Mirrors `.form-section`'s real card chrome — icon + title header with a border-b divider. */
function PayParkingSectionShellSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border/50 bg-card space-y-5 rounded-xl border px-4 py-5 sm:px-5 sm:py-6">
      <div className="border-border mb-4 flex items-center gap-3 border-b pb-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-4 w-32" />
      </div>
      {children}
    </div>
  );
}

/** Mirrors `PayParkingPage`'s real stack: Booking Info, Parking Details, Vehicle Info cards. */
export function PayParkingPageSkeleton({ title }: { title: string }) {
  return (
    <div
      className="relative space-y-6 p-4 sm:p-6 lg:p-8"
      aria-busy="true"
      aria-label="Loading form"
    >
      <GuestFormBrandHeaderSkeleton title={title} />

      <PayParkingSectionShellSkeleton>
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-56" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </PayParkingSectionShellSkeleton>

      <PayParkingSectionShellSkeleton>
        <div className="border-primary/25 bg-primary/5 space-y-2 rounded-lg border-2 px-4 py-4">
          <Skeleton className="h-3.5 w-48" />
          <div className="border-primary/15 flex items-center justify-between gap-4 border-t pt-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        </div>
      </PayParkingSectionShellSkeleton>

      <PayParkingSectionShellSkeleton>
        <Skeleton className="h-11 w-full rounded-lg" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <GuestFormFieldSkeleton key={i} />
          ))}
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </PayParkingSectionShellSkeleton>
    </div>
  );
}

/**
 * First viewport of Showcase and Stay Guide: header, full-bleed hero, then
 * stacked sections that become a two-column block on desktop.
 */
export function PublicFullBleedPageSkeleton({ label = 'Loading page' }: { label?: string } = {}) {
  return (
    <div
      className="bg-background min-h-[100dvh]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <div className="hidden items-center gap-4 lg:flex">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
        <Skeleton className="size-9 rounded-full lg:hidden" />
      </div>
      <Skeleton className="mx-4 min-h-[62dvh] rounded-2xl sm:mx-6 lg:mx-8 lg:min-h-[70dvh]" />
      <div className="mx-auto max-w-4xl space-y-10 px-5 py-10 lg:max-w-6xl lg:px-8 lg:py-14">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-2/3 max-w-md" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          <div className="space-y-3 py-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="mt-4 h-11 w-36 rounded-xl" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Mirrors `ParkingRequestStatusPage`: brand header + stay summary + status body
 * (same shell rhythm as the request form).
 */
export function ParkingRequestStatusPageSkeleton() {
  return (
    <div
      className="relative space-y-5 p-4 sm:p-6 lg:p-8"
      aria-busy="true"
      aria-label="Loading parking request"
    >
      <GuestFormBrandHeaderSkeleton title="Parking request" />
      <div className="bg-muted/40 flex items-start gap-3 rounded-xl px-3 py-3">
        <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <div className="space-y-5">
        <div className="space-y-2.5">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-8" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-1.5 flex-1 rounded-full" />
            <Skeleton className="h-1.5 flex-1 rounded-full" />
            <Skeleton className="h-1.5 flex-1 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mx-auto h-28 w-28 rounded-full" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}
