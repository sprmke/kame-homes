import { useEffect, useState } from 'react';

/**
 * Tracks which of a list of refs is currently crossing the vertical middle of the viewport.
 * Drives the sticky feature showcase: the story you are reading picks the demo on the left.
 */
export function useActiveIndex(refs: React.RefObject<HTMLElement | null>[]): number {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const elements = refs.map((ref) => ref.current).filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = elements.indexOf(visible.target as HTMLElement);
        if (index !== -1) setActiveIndex(index);
      },
      // A narrow band across the viewport middle — only the story in the centre is "active".
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // refs identity is stable for the life of the showcase (fixed-length array of useRef).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return activeIndex;
}
