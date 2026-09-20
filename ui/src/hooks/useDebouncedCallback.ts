import { useCallback, useEffect, useRef } from 'react';

type DebouncedCallback<Args extends unknown[]> = ((...args: Args) => void) & {
  /** Runs the pending call immediately, if one is scheduled. */
  flush: () => void;
  /** Discards the pending call without running it. */
  cancel: () => void;
};

/**
 * Debounces a callback: only the last call within `delayMs` actually runs.
 * Exposes `flush`/`cancel` for autosave-on-blur/unmount/route-change and cleans up
 * a pending timer on unmount so it never calls back into an unmounted component.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number
): DebouncedCallback<Args> {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const timerRef = useRef<number | null>(null);
  const argsRef = useRef<Args | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    argsRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current === null || argsRef.current === null) return;
    const args = argsRef.current;
    cancel();
    callbackRef.current(...args);
  }, [cancel]);

  const debounced = useCallback(
    (...args: Args) => {
      argsRef.current = args;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const pending = argsRef.current;
        argsRef.current = null;
        if (pending) callbackRef.current(...pending);
      }, delayMs);
    },
    [delayMs]
  ) as DebouncedCallback<Args>;

  debounced.flush = flush;
  debounced.cancel = cancel;

  return debounced;
}
