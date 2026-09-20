import { useCallback, useEffect, useRef } from 'react';

type ThrottledCallback<Args extends unknown[]> = ((...args: Args) => void) & {
  /** Discards any scheduled trailing call. */
  cancel: () => void;
};

/**
 * Throttles a callback to at most once per animation frame (leading + trailing):
 * the first call in a frame runs immediately, later calls in the same frame collapse
 * into one trailing call on the next frame. Right for scroll/resize/drag handlers,
 * where a fixed cadence matters more than waiting for a pause (that's debounce).
 */
export function useThrottledCallback<Args extends unknown[]>(
  callback: (...args: Args) => void
): ThrottledCallback<Args> {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const rafRef = useRef<number | null>(null);
  const pendingArgsRef = useRef<Args | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingArgsRef.current = null;
  }, []);

  const throttled = useCallback((...args: Args) => {
    if (rafRef.current !== null) {
      // A frame is already scheduled — remember the latest args as the trailing call.
      pendingArgsRef.current = args;
      return;
    }

    callbackRef.current(...args);

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const pending = pendingArgsRef.current;
      pendingArgsRef.current = null;
      if (pending) callbackRef.current(...pending);
    });
  }, []) as ThrottledCallback<Args>;

  throttled.cancel = cancel;

  return throttled;
}
