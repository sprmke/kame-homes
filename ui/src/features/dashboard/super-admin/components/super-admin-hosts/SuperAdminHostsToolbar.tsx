import { Search } from 'lucide-react';

import { AdminListPerPageSelect } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { SuperAdminListViewToggle } from '@/features/dashboard/super-admin/components/shared/SuperAdminListViewToggle';
import type {
  SuperAdminHostsFilters,
  SuperAdminHostsViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminHostsFilters';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = {
  filters: SuperAdminHostsFilters;
  viewMode: SuperAdminHostsViewMode;
  hideTableView?: boolean;
  limit: number;
  onSearchChange: (value: string) => void;
  onViewModeChange: (mode: SuperAdminHostsViewMode) => void;
  onLimitChange: (limit: number) => void;
};

export function SuperAdminHostsToolbar({
  filters,
  viewMode,
  hideTableView = false,
  limit,
  onSearchChange,
  onViewModeChange,
  onLimitChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={filters.search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search hosts…"
          className="h-10 pl-9"
          aria-label="Search hosts"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <AdminListPerPageSelect limit={limit} onChange={onLimitChange} />
        <SuperAdminListViewToggle
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          hideTableView={hideTableView}
        />
      </div>
    </div>
  );
}

export function SuperAdminHostsResultsMeta({
  visibleCount,
  totalCount,
}: {
  visibleCount: number;
  totalCount: number;
}) {
  if (totalCount === 0) return null;
  return (
    <p className={cn('text-muted-foreground text-xs sm:text-sm')}>
      Showing {visibleCount} of {totalCount}
    </p>
  );
}
