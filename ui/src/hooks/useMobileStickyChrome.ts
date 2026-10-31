import { useEffect, useRef, useState, type RefObject } from 'react';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { resolveMobileHeroScrollTarget } from '@/hooks/useMobileHeroCollapseProgress';

/** Scroll slack (px) before unpinning — avoids flicker at the threshold. */
export const MOBILE_STICKY_CHROME_HYSTERESIS_PX = 10;

/**
 * True when the sentinel's top edge has scrolled to (or past) the scrollport top.
 * Uses hysteresis on unpin so small scroll jitter does not toggle state.
 */
export function useMobileStickyChrome(
  sentinelRef: RefObject<HTMLElement | null>,
  enabled = true,
  hysteresisPx = MOBILE_STICKY_CHROME_HYSTERESIS_PX
): { pinned: boolean } {
  const reducedMotion = usePrefersReducedMotion();
  const [pinned, setPinned] = useState(false);
  const pinnedRef = useRef(false);

  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);

  useEffect(() => {
    if (!enabled) {
      setPinned(false);
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    let scrollTarget: HTMLElement | null = null;
    let frame = 0;

    const readPinned = () => {
      const el = sentinelRef.current;
      const root = scrollTarget;
      if (!el || !root) return;

      /*
       * Fill-main pages (Settings / Notifications / Inbox): hero sits *above*
       * the inner `data-admin-content-scroll`, so the sentinel is never inside
       * the scrollport. The hero is already parked in layout — do not pin a
       * duplicate fixed bar (and do not treat "sentinel above root" as pinned).
       */
      if (!root.contains(el)) {
        if (pinnedRef.current) {
          pinnedRef.current = false;
          setPinned(false);
        }
        return;
      }

      const rootTop = root.getBoundingClientRect().top;
      const relativeTop = el.getBoundingClientRect().top - rootTop;

      if (pinnedRef.current) {
        if (relativeTop > hysteresisPx) {
          pinnedRef.current = false;
          setPinned(false);
        }
      } else if (relativeTop <= 0) {
        pinnedRef.current = true;
        setPinned(true);
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        readPinned();
      });
    };

    const bind = () => {
      const nextTarget = resolveMobileHeroScrollTarget(sentinel);
      if (nextTarget === scrollTarget) return;
      scrollTarget?.removeEventListener('scroll', onScroll);
      scrollTarget = nextTarget;
      scrollTarget?.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    };

    bind();
    const ro = new ResizeObserver(() => bind());
    const pageRoot = sentinel.closest('[data-admin-mobile-page]');
    if (pageRoot) ro.observe(pageRoot);
    ro.observe(sentinel);

    if (reducedMotion) {
      readPinned();
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      scrollTarget?.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [enabled, hysteresisPx, reducedMotion, sentinelRef]);

  return { pinned };
}
