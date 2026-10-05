import { useCallback, useMemo, useState } from 'react';

import { galleryIndicesToMount } from '@/features/guest/marketing/shared/lib/galleryWindow';

/** Slide state for listing card galleries that only mounts what the guest can see next. */
export function useGalleryWindow(count: number) {
  const [current, setCurrent] = useState(0);
  const [visited, setVisited] = useState<ReadonlySet<number>>(() => new Set([0]));
  const [warm, setWarm] = useState(false);

  const goTo = useCallback(
    (next: number) => {
      if (count <= 0) return;
      const index = ((next % count) + count) % count;
      setCurrent(index);
      setVisited((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
    },
    [count]
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);
  const markIntent = useCallback(() => setWarm(true), []);

  const mounted = useMemo(
    () => galleryIndicesToMount(count, current, visited, warm),
    [count, current, visited, warm]
  );

  return {
    current,
    next,
    prev,
    goTo,
    markIntent,
    isMounted: (index: number) => mounted.has(index),
  };
}
