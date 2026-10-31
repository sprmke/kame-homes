import { AppLoader } from '@/components/branding/AppLoader';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';

/**
 * Suspense unmounts a fallback the instant its child resolves, so a fallback can only
 * control when it starts painting, not extend its own visibility — `minVisibleMs: 0`
 * disables `useDelayedLoading`'s hold-open behavior since it would never get a chance to
 * apply. `isLoading: true` is a constant because a Suspense fallback has no loading
 * state of its own to observe; it delays its OWN first paint so an already-cached chunk
 * (resolves in a handful of ms) never flashes a skeleton.
 */
function useShowAfterDelay(): boolean {
  return useDelayedLoading(true, { minVisibleMs: 0 });
}

/** Suspense fallback for a lazy-loaded route rendered inside an already-mounted shell (sidebar/nav stay put). */
export function SectionLoadingFallback() {
  const show = useShowAfterDelay();
  if (!show) return null;

  return (
    <div
      className="flex flex-1 flex-col gap-3 p-4 sm:p-6"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <Skeleton aria-hidden className="h-8 w-48 rounded-lg" />
      <Skeleton aria-hidden className="h-40 w-full rounded-xl" />
      <Skeleton aria-hidden className="h-40 w-full rounded-xl" />
    </div>
  );
}

/** Suspense fallback for the top-level route tree — used before any shell has mounted. */
export function PageLoadingFallback() {
  const show = useShowAfterDelay();
  if (!show) return null;

  return <AppLoader fullScreen />;
}
