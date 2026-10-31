import { Building2, Filter, Landmark, Search } from 'lucide-react';

import { AdminListPerPageSelect } from '@/features/dashboard/bookings/components/AdminListToolbar';
import {
  ORG_PROPERTY_STATUSES,
  ORG_PROPERTY_TYPES,
} from '@/features/dashboard/org/lib/orgPropertyDisplay';
import { SuperAdminListViewToggle } from '@/features/dashboard/super-admin/components/shared/SuperAdminListViewToggle';
import type {
  PlatformPropertiesDevelopmentFilter,
  SuperAdminPlatformPropertiesFilters,
  SuperAdminPlatformPropertiesViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminPlatformPropertiesFilters';

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
  filters: SuperAdminPlatformPropertiesFilters;
  viewMode: SuperAdminPlatformPropertiesViewMode;
  hideTableView?: boolean;
  limit: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: SuperAdminPlatformPropertiesFilters['status']) => void;
  onTypeChange: (value: string) => void;
  onDevelopmentChange: (value: PlatformPropertiesDevelopmentFilter) => void;
  onViewModeChange: (mode: SuperAdminPlatformPropertiesViewMode) => void;
  onLimitChange: (limit: number) => void;
};

export function SuperAdminPlatformPropertiesToolbar({
  filters,
  viewMode,
  hideTableView = false,
  limit,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onDevelopmentChange,
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
            placeholder="Search properties…"
            className="h-10 pl-9"
            aria-label="Search properties"
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(value) =>
            onStatusChange(value as SuperAdminPlatformPropertiesFilters['status'])
          }
        >
          <SelectTrigger className="h-10 w-[min(100%,9.5rem)] shrink-0 sm:w-[9.5rem]">
            <Filter className="size-4 shrink-0 opacity-70" aria-hidden />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {ORG_PROPERTY_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.type} onValueChange={onTypeChange}>
          <SelectTrigger className="h-10 w-[min(100%,9.5rem)] shrink-0 sm:w-[9.5rem]">
            <Building2 className="size-4 shrink-0 opacity-70" aria-hidden />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ORG_PROPERTY_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.development} onValueChange={onDevelopmentChange}>
          <SelectTrigger className="h-10 w-[min(100%,11rem)] shrink-0 sm:w-[11rem]">
            <Landmark className="size-4 shrink-0 opacity-70" aria-hidden />
            <SelectValue placeholder="Development" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All devs</SelectItem>
            <SelectItem value="linked">Linked</SelectItem>
            <SelectItem value="unlinked">Unlinked</SelectItem>
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

export function SuperAdminPlatformPropertiesResultsMeta({
  visibleCount,
  totalCount,
  className,
}: {
  visibleCount: number;
  totalCount: number;
  className?: string;
}) {
  if (totalCount === 0) return null;

  return (
    <p className={cn('text-muted-foreground text-xs sm:text-sm', className)}>
      Showing {visibleCount} of {totalCount}
    </p>
  );
}
