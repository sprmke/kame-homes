import { useCallback, useRef } from 'react';

/**
 * Intent-based chunk prefetch (production-readiness doc 01, Phase 1.4).
 *
 * Returns event handlers to spread onto a nav `<Link>`/button so hovering,
 * focusing, or touching it warms the target route's lazy chunk before the
 * click — the network round-trip happens during the "am I really clicking
 * this" pause instead of after.
 *
 * Deliberately conservative:
 *  - Fires the loader at most once per component instance (a ref guard),
 *    so re-renders or repeated hovers never re-trigger the import.
 *  - Skips entirely on a metered/slow connection (`navigator.connection`),
 *    since the reason a user is on 2G is exactly the reason not to spend
 *    their data budget on a page they haven't asked for yet.
 *  - Never throws — a prefetch is an optimization, not a requirement; if the
 *    dynamic import rejects (offline, stale deploy), the real navigation's
 *    own Suspense/error boundary handles it when the user actually clicks.
 *
 * Usage:
 *   const prefetch = usePrefetchOnIntent(() => import('@/features/.../SomePage'));
 *   <Link {...prefetch} to="/some-path">Some page</Link>
 */
export function usePrefetchOnIntent(loader: () => Promise<unknown>) {
  const firedRef = useRef(false);

  const trigger = useCallback(() => {
    if (firedRef.current) return;

    if (typeof navigator !== 'undefined') {
      const connection = (
        navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }
      ).connection;
      if (connection?.saveData) return;
      if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return;
    }

    firedRef.current = true;
    loader().catch(() => {
      // Swallow — the real navigation retries via its own Suspense boundary.
      // Allow a future hover to try again in case this was a transient blip.
      firedRef.current = false;
    });
  }, [loader]);

  return {
    onMouseEnter: trigger,
    onFocus: trigger,
    onTouchStart: trigger,
  };
}
