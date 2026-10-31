import { useCallback, useRef } from 'react';

/**
 * True when the connection is too constrained to spend on a speculative
 * fetch the user hasn't asked for yet (production-readiness doc 01, Phase
 * 1.4's "never prefetch on a metered/slow connection" rule).
 */
function shouldSkipPrefetchForConnection(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (connection?.saveData) return true;
  return connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g';
}

/**
 * Intent-based chunk prefetch (production-readiness doc 01, Phase 1.4).
 *
 * Returns event handlers to spread onto a single nav `<Link>`/button so
 * hovering, focusing, or touching it warms the target route's lazy chunk
 * before the click — the network round-trip happens during the "am I really
 * clicking this" pause instead of after.
 *
 * Deliberately conservative:
 *  - Fires the loader at most once per component instance (a ref guard),
 *    so re-renders or repeated hovers never re-trigger the import.
 *  - Skips entirely on a metered/slow connection.
 *  - Never throws — a prefetch is an optimization, not a requirement; if the
 *    dynamic import rejects (offline, stale deploy), the real navigation's
 *    own Suspense/error boundary handles it when the user actually clicks.
 *
 * Usage:
 *   const prefetch = usePrefetchOnIntent(() => import('@/features/.../SomePage'));
 *   <Link {...prefetch} to="/some-path">Some page</Link>
 *
 * For a *list* of links (e.g. mapped nav items), a hook cannot be called
 * once per array item — use `prefetchChunkOnce` instead, which tracks its
 * "already fired" state in a module-level Set keyed by an explicit id
 * (typically the href) rather than a per-component ref.
 */
export function usePrefetchOnIntent(loader: () => Promise<unknown>) {
  const firedRef = useRef(false);

  const trigger = useCallback(() => {
    if (firedRef.current) return;
    if (shouldSkipPrefetchForConnection()) return;

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

const firedPrefetchKeys = new Set<string>();

/**
 * Non-hook variant for prefetching inside a `.map()` loop (e.g. sidebar nav
 * items), where calling `usePrefetchOnIntent` per item would violate the
 * Rules of Hooks (a hook count that varies with array length). Tracks fired
 * keys in a module-level `Set` shared across the whole app session rather
 * than per-component state — correct here since "has this chunk already
 * been requested" is a global fact, not something scoped to one render.
 *
 * Same connection-aware, never-throws guarantees as `usePrefetchOnIntent`.
 */
export function prefetchChunkOnce(key: string, loader: () => Promise<unknown>): void {
  if (firedPrefetchKeys.has(key)) return;
  if (shouldSkipPrefetchForConnection()) return;

  firedPrefetchKeys.add(key);
  loader().catch(() => {
    firedPrefetchKeys.delete(key);
  });
}
