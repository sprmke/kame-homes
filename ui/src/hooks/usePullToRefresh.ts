import { useCallback, useEffect, useRef, useState } from 'react';

const PULL_THRESHOLD_PX = 72;
const MAX_PULL_PX = 96;
const RESISTANCE = 0.5;
const ATTACH_RETRY_MS = 250;
const ATTACH_RETRIES = 12;

type Options = {
  /** Refresh handler; the indicator stays until the promise settles. */
  onRefresh: () => Promise<unknown> | unknown;
  /** Defaults to a `[data-pull-to-refresh]` port, then the admin shell's scrollports, then `main`. */
  getScrollElement?: () => HTMLElement | null;
  /** Force on (tests / preview). Defaults to standalone display mode. */
  enabled?: boolean;
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Touch pull-to-refresh for list screens. Installed iOS apps have no browser
 * chrome, so without this the only way to refresh is to leave the screen.
 *
 * Only intercepts a downward drag when the scrollport is already at the top, so
 * normal scrolling and momentum are untouched. `overscroll-behavior: contain`
 * on the scrollport keeps the shell from rubber-banding underneath.
 */
export function usePullToRefresh({ onRefresh, getScrollElement, enabled }: Options) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await onRefreshRef.current();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      setPullDistance(0);
    }
  }, []);

  useEffect(() => {
    if (enabled === false) return;
    if (enabled === undefined && !isStandalone()) return;

    let disposed = false;
    let detach: (() => void) | null = null;
    let attempts = 0;

    const attach = () => {
      if (disposed) return;
      const el = getScrollElement
        ? getScrollElement()
        : document.querySelector<HTMLElement>(
            '[data-pull-to-refresh], [data-admin-content-scroll], main'
          );
      // The list (and its scrollport) can mount after this page's effect.
      if (!el) {
        if (attempts++ < ATTACH_RETRIES) window.setTimeout(attach, ATTACH_RETRY_MS);
        return;
      }

      let startY = 0;
      let pulling = false;
      let distance = 0;

      const onTouchStart = (event: TouchEvent) => {
        if (refreshingRef.current || event.touches.length !== 1) return;
        if (el.scrollTop > 0) return;
        // Never claim the gesture on a port that does not scroll (an outer
        // `overflow-hidden` shell). Doing so would swallow the inner list's drag.
        if (el.scrollHeight <= el.clientHeight + 4) return;
        startY = event.touches[0].clientY;
        pulling = true;
        distance = 0;
      };

      const onTouchMove = (event: TouchEvent) => {
        if (!pulling) return;
        const dy = event.touches[0].clientY - startY;
        if (dy <= 0) {
          if (distance > 0) {
            distance = 0;
            setPullDistance(0);
          }
          return;
        }
        // Only take over the gesture at the top of the list.
        if (el.scrollTop > 0) {
          pulling = false;
          setPullDistance(0);
          return;
        }
        event.preventDefault();
        distance = Math.min(MAX_PULL_PX, dy * RESISTANCE);
        setPullDistance(distance);
      };

      const onTouchEnd = () => {
        if (!pulling) return;
        pulling = false;
        const shouldRefresh = distance >= PULL_THRESHOLD_PX;
        distance = 0;
        if (shouldRefresh) void refresh();
        else setPullDistance(0);
      };

      el.addEventListener('touchstart', onTouchStart, { passive: true });
      el.addEventListener('touchmove', onTouchMove, { passive: false });
      el.addEventListener('touchend', onTouchEnd, { passive: true });
      el.addEventListener('touchcancel', onTouchEnd, { passive: true });
      detach = () => {
        el.removeEventListener('touchstart', onTouchStart);
        el.removeEventListener('touchmove', onTouchMove);
        el.removeEventListener('touchend', onTouchEnd);
        el.removeEventListener('touchcancel', onTouchEnd);
      };
    };

    attach();
    return () => {
      disposed = true;
      detach?.();
    };
  }, [enabled, getScrollElement, refresh]);

  return { pullDistance, refreshing, refresh };
}

export const PULL_TO_REFRESH_THRESHOLD_PX = PULL_THRESHOLD_PX;
