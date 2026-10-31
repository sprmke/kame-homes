import { useCallback, useEffect, useMemo, useState } from 'react';

const DEFAULT_PAGE_SIZE = 12;

export function useContextPickerListWindow<T>(
  items: T[],
  resetKey: string,
  pageSize = DEFAULT_PAGE_SIZE
) {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [resetKey, pageSize]);

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  const hasMore = visibleCount < items.length;
  const remaining = Math.max(items.length - visibleCount, 0);

  const loadMore = useCallback(() => {
    setVisibleCount((current) => Math.min(current + pageSize, items.length));
  }, [items.length, pageSize]);

  return {
    visibleItems,
    hasMore,
    remaining,
    total: items.length,
    loadMore,
  };
}
