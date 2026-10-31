import { useEffect, useRef } from 'react';

type Options = {
  enabled?: boolean;
  rootMargin?: string;
  onVisible: () => void;
};

/** Fire once when a template card enters (or nears) the viewport. */
export function useVisibleThumbnailRequest({
  enabled = true,
  rootMargin = '240px',
  onVisible,
}: Options) {
  const ref = useRef<HTMLDivElement | null>(null);
  const firedRef = useRef(false);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    firedRef.current = false;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      if (!firedRef.current) {
        firedRef.current = true;
        onVisibleRef.current();
      }
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (firedRef.current) return;
        const visible = entries.some((entry) => entry.isIntersecting);
        if (!visible) return;
        firedRef.current = true;
        onVisibleRef.current();
        observer.disconnect();
      },
      { rootMargin, threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return ref;
}
