import { useEffect } from 'react';

/**
 * On phone/tablet layouts, force list pages that support table|grid onto grid
 * (same idea as `useAdminMobileCardViewGuard` for table|card|kanban).
 */
export function useAdminMobileGridViewGuard(
  isMobileLayout: boolean,
  viewMode: 'table' | 'grid',
  setViewMode: (mode: 'table' | 'grid') => void
) {
  useEffect(() => {
    if (!isMobileLayout) return;
    if (viewMode === 'table') setViewMode('grid');
  }, [isMobileLayout, viewMode, setViewMode]);
}
