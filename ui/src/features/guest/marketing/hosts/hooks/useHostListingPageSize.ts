import { useEffect, useState, type RefObject } from 'react';

import {
  HOST_LISTING_MAX_ROWS,
  hostListingPageSize,
} from '@/features/guest/marketing/hosts/lib/hostListingGrid';

export function useHostListingPageSize(
  containerRef: RefObject<HTMLElement | null>,
  maxRows = HOST_LISTING_MAX_ROWS
): number {
  const [pageSize, setPageSize] = useState(() => hostListingPageSize(1024, maxRows));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setPageSize(hostListingPageSize(el.clientWidth, maxRows));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [containerRef, maxRows]);

  return pageSize;
}
