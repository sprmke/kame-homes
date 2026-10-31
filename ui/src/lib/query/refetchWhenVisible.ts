/** Pause TanStack Query polling while the tab is hidden. */
export function refetchIntervalWhenVisibleMs(intervalMs: number): () => number | false {
  return () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return false;
    }
    return intervalMs;
  };
}
