import { useEffect, useRef, useState } from 'react';

/**
 * Returns `value`, but holds each shown value for at least `minMs`. A value that flips away and
 * back inside the window is never shown. `isUrgent` values skip the wait. Pass a stable function.
 */
export function useDwellValue<T>(value: T, minMs: number, isUrgent?: (next: T) => boolean): T {
  const [shown, setShown] = useState(value);
  const shownAtRef = useRef(0);

  useEffect(() => {
    if (Object.is(value, shown)) return;
    const wait = isUrgent?.(value)
      ? 0
      : Math.max(0, minMs - (performance.now() - shownAtRef.current));
    const timer = window.setTimeout(() => {
      shownAtRef.current = performance.now();
      setShown(value);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [value, shown, minMs, isUrgent]);

  return shown;
}
