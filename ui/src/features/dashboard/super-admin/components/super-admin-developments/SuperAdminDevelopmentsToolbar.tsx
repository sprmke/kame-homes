import { Filter, Landmark, Search } from 'lucide-react';

import { AdminListPerPageSelect } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { SuperAdminListViewToggle } from '@/features/dashboard/super-admin/components/shared/SuperAdminListViewToggle';
import {
  DEVELOPMENT_STATUSES,
  DEVELOPMENT_TYPES,
} from '@/features/dashboard/super-admin/lib/developmentSettingsConstants';
import type {
  SuperAdminDevelopmentsFilters,
  SuperAdminDevelopmentsViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminDevelopmentsFilters';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Props = {
  filters: SuperAdminDevelopmentsFilters;
  viewMode: SuperAdminDevelopmentsViewMode;
  hideTableView?: boolean;
  limit: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: SuperAdminDevelopmentsFilters['status']) => void;
  onTypeChange: (value: string) => void;
  onViewModeChange: (mode: SuperAdminDevelopmentsViewMode) => void;
  onLimitChange: (limit: number) => void;
};

export function SuperAdminDevelopmentsToolbar({
  filters,
  viewMode,
  hideTableView = false,
  limit,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onViewModeChange,
  onLimitChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="relative min-w-[min(100%,16rem)] flex-1 sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={filters.search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search developments…"
            className="h-10 pl-9"
            aria-label="Search developments"
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(value) =>
            onStatusChange(value as SuperAdminDevelopmentsFilters['status'])
          }
        >
          <SelectTrigger className="h-10 w-[min(100%,9.5rem)] shrink-0 sm:w-[9.5rem]">
            <Filter className="size-4 shrink-0 opacity-70" aria-hidden />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {DEVELOPMENT_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.type} onValueChange={onTypeChange}>
          <SelectTrigger className="h-10 w-[min(100%,9.5rem)] shrink-0 sm:w-[9.5rem]">
            <Landmark className="size-4 shrink-0 opacity-70" aria-hidden />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {DEVELOPMENT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

export function SuperAdminDevelopmentsResultsMeta({
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
