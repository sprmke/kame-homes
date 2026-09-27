import { OrgListingToolbar } from '@/features/dashboard/org/components/OrgListingToolbar';
import {
  ORG_PARKING_STATUSES,
  ORG_PARKING_TYPES,
} from '@/features/dashboard/org/lib/orgParkingDisplay';
import type {
  OrgParkingsFilters,
  OrgParkingsViewMode,
} from '@/features/dashboard/org/lib/orgParkingsFilters';

type Props = {
  filters: OrgParkingsFilters;
  viewMode: OrgParkingsViewMode;
  limit: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: OrgParkingsFilters['status']) => void;
  onTypeChange: (value: string) => void;
  onViewModeChange: (mode: OrgParkingsViewMode) => void;
  onLimitChange: (limit: number) => void;
  hideTableView?: boolean;
};

const STATUS_OPTIONS = [
  { value: 'all' as const, label: 'All status' },
  ...ORG_PARKING_STATUSES.map((status) => ({
    value: status.value,
    label: status.label,
  })),
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  ...ORG_PARKING_TYPES.map((type) => ({ value: type.value, label: type.label })),
];

export function OrgParkingsToolbar({
  filters,
  viewMode,
  limit,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onViewModeChange,
  onLimitChange,
  hideTableView = false,
}: Props) {
  return (
    <OrgListingToolbar
      search={filters.search}
      status={filters.status}
      type={filters.type}
      statusOptions={STATUS_OPTIONS}
      typeOptions={TYPE_OPTIONS}
      viewMode={viewMode}
      limit={limit}
      hideTableView={hideTableView}
      labels={{
        searchPlaceholder: 'Search parkings…',
        searchAriaLabel: 'Search parkings',
        filterAriaLabel: 'Refine parkings',
        toolbarAriaLabel: 'Parking filters',
        viewAriaLabel: 'Choose parking view',
        moreFiltersAriaLabel: 'More parking filters',
      }}
      onSearchChange={onSearchChange}
      onStatusChange={onStatusChange}
      onTypeChange={onTypeChange}
      onViewModeChange={onViewModeChange}
      onLimitChange={onLimitChange}
    />
  );
}
