import { OrgListingToolbar } from '@/features/dashboard/org/components/OrgListingToolbar';
import type {
  OrgPropertiesFilters,
  OrgPropertiesViewMode,
} from '@/features/dashboard/org/lib/orgPropertiesFilters';
import {
  ORG_PROPERTY_STATUSES,
  ORG_PROPERTY_TYPES,
} from '@/features/dashboard/org/lib/orgPropertyDisplay';

type Props = {
  filters: OrgPropertiesFilters;
  viewMode: OrgPropertiesViewMode;
  limit: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: OrgPropertiesFilters['status']) => void;
  onTypeChange: (value: string) => void;
  onViewModeChange: (mode: OrgPropertiesViewMode) => void;
  onLimitChange: (limit: number) => void;
  hideTableView?: boolean;
};

const STATUS_OPTIONS = [
  { value: 'all' as const, label: 'All status' },
  ...ORG_PROPERTY_STATUSES.map((status) => ({
    value: status.value,
    label: status.label,
  })),
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  ...ORG_PROPERTY_TYPES.map((type) => ({ value: type.value, label: type.label })),
];

export function OrgPropertiesToolbar({
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
        searchPlaceholder: 'Search properties…',
        searchAriaLabel: 'Search properties',
        filterAriaLabel: 'Refine properties',
        toolbarAriaLabel: 'Property filters',
        viewAriaLabel: 'Choose property view',
        moreFiltersAriaLabel: 'More property filters',
      }}
      onSearchChange={onSearchChange}
      onStatusChange={onStatusChange}
      onTypeChange={onTypeChange}
      onViewModeChange={onViewModeChange}
      onLimitChange={onLimitChange}
    />
  );
}
