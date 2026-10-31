import { useEffect, useState } from 'react';

import { findPrimaryShowcaseSection } from '@/features/guest/marketing/showcase/lib/showcaseScroll';

export function useScrollSpy(sectionIds: string[], rootMargin = '-40% 0px -45% 0px') {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? '');

  useEffect(() => {
    if (sectionIds.length === 0) return;
    const elements = sectionIds
      .map((id) => findPrimaryShowcaseSection(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (top?.target?.id) setActiveId(top.target.id);
      },
      { rootMargin, threshold: [0.1, 0.25, 0.5] }
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [sectionIds.join('|'), rootMargin]);

  return activeId;
}
