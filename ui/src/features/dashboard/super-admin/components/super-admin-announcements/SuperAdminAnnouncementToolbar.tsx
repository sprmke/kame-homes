import { Filter, Search } from 'lucide-react';

import { AdminListPerPageSelect } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { SuperAdminListViewToggle } from '@/features/dashboard/super-admin/components/shared/SuperAdminListViewToggle';
import {
  ANNOUNCEMENT_SEVERITY_LABELS,
  type SuperAdminAnnouncementFilters,
  type SuperAdminAnnouncementViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminAnnouncementFilters';

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
  filters: SuperAdminAnnouncementFilters;
  viewMode: SuperAdminAnnouncementViewMode;
  hideTableView?: boolean;
  limit: number;
  onSearchChange: (value: string) => void;
  onSeverityChange: (value: SuperAdminAnnouncementFilters['severity']) => void;
  onStatusChange: (value: SuperAdminAnnouncementFilters['status']) => void;
  onViewModeChange: (mode: SuperAdminAnnouncementViewMode) => void;
  onLimitChange: (limit: number) => void;
};

export function SuperAdminAnnouncementToolbar({
  filters,
  viewMode,
  hideTableView = false,
  limit,
  onSearchChange,
  onSeverityChange,
  onStatusChange,
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
            placeholder="Search announcements…"
            className="h-10 pl-9"
            aria-label="Search announcements"
          />
        </div>

        <Select
          value={filters.severity}
          onValueChange={(value) =>
            onSeverityChange(value as SuperAdminAnnouncementFilters['severity'])
          }
        >
          <SelectTrigger
            className="h-10 w-[min(100%,10.5rem)] shrink-0 sm:w-[10.5rem]"
            aria-label="Filter by severity"
          >
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {Object.entries(ANNOUNCEMENT_SEVERITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) =>
            onStatusChange(value as SuperAdminAnnouncementFilters['status'])
          }
        >
          <SelectTrigger
            className="h-10 w-[min(100%,9.5rem)] shrink-0 sm:w-[9.5rem]"
            aria-label="Filter by status"
          >
            <Filter className="size-4 shrink-0 opacity-70" aria-hidden />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
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

export function SuperAdminAnnouncementResultsMeta({
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
