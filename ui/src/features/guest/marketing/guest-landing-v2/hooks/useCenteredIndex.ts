import { useEffect, useState, type RefObject } from 'react';

/**
 * Index of the element currently crossing the viewport's vertical middle. Drives the
 * sticky phone in the stay journey: the step you are reading picks the screen.
 */
export function useCenteredIndex(refs: RefObject<HTMLElement | null>[]): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const elements = refs.map((ref) => ref.current).filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((entry) => entry.isIntersecting);
        if (!hit) return;
        const next = elements.indexOf(hit.target as HTMLElement);
        if (next !== -1) setIndex(next);
      },
      { rootMargin: '-48% 0px -48% 0px', threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // The ref list is a fixed-length array created once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return index;
}
