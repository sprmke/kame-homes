import { Skeleton } from '@/components/ui/skeleton';

/** Suspense fallback for a lazy-loaded route rendered inside an already-mounted shell (sidebar/nav stay put). */
export function SectionLoadingFallback() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-4 sm:p-6">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

/** Suspense fallback for the top-level route tree — used before any shell has mounted. */
export function PageLoadingFallback() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <div className="border-muted-foreground/20 border-t-primary h-8 w-8 animate-spin rounded-full border-4" />
    </div>
  );
}
