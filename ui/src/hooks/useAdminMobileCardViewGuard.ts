import { useEffect } from 'react';

import type { AdminListView } from '@/features/dashboard/bookings/lib/listView';

type ViewWithTable = AdminListView | 'calendar' | 'kanban';

export function useAdminMobileCardViewGuard<T extends { view: ViewWithTable; page: number }>(
  isMobileLayout: boolean,
  query: T,
  setQuery: (next: T) => void
) {
  useEffect(() => {
    if (!isMobileLayout) return;
    if (query.view === 'table') {
      setQuery({ ...query, view: 'card', page: 1 });
    }
  }, [isMobileLayout, query, setQuery]);
}
