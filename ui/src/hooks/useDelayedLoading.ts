import { useEffect, useRef, useState } from 'react';

const DEFAULT_SHOW_AFTER_MS = 180;
const DEFAULT_MIN_VISIBLE_MS = 300;

/**
 * Debounces a loading flag so a fast response never flashes a skeleton, and a shown
 * skeleton never strobes. Once `true` for at least `showAfterMs`, it stays `true` for
 * at least `minVisibleMs` even if `isLoading` flips back to `false` sooner.
 */
export function useDelayedLoading(
  isLoading: boolean,
  { showAfterMs = DEFAULT_SHOW_AFTER_MS, minVisibleMs = DEFAULT_MIN_VISIBLE_MS } = {}
): boolean {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    let showTimer: number | undefined;
    let hideTimer: number | undefined;

    if (isLoading) {
      showTimer = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, showAfterMs);
    } else {
      const shownAt = shownAtRef.current;
      if (shownAt == null) {
        setVisible(false);
      } else {
        const elapsed = Date.now() - shownAt;
        const remaining = Math.max(minVisibleMs - elapsed, 0);
        hideTimer = window.setTimeout(() => {
          shownAtRef.current = null;
          setVisible(false);
        }, remaining);
      }
    }

    return () => {
      if (showTimer !== undefined) window.clearTimeout(showTimer);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    };
  }, [isLoading, showAfterMs, minVisibleMs]);

  return visible;
}
