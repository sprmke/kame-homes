import {
  orgPropertyLifecycleState,
  orgPropertySearchHaystack,
} from '@/features/dashboard/org/lib/orgPropertyDisplay';
import type { PropertyLifecycleState } from '@/features/dashboard/org/lib/propertyLifecycle';
import type { Property } from '@/features/dashboard/org/types';

export type OrgPropertiesViewMode = 'table' | 'grid' | 'list';

export type OrgPropertiesFilters = {
  search: string;
  status: 'all' | PropertyLifecycleState;
  type: 'all' | string;
};

export function filterOrgProperties(
  properties: Property[],
  filters: OrgPropertiesFilters
): Property[] {
  const query = filters.search.trim().toLowerCase();

  return properties.filter((property) => {
    const matchesSearch = !query || orgPropertySearchHaystack(property).includes(query);
    // "All status" hides archived listings; pick Archived to see them.
    const state = orgPropertyLifecycleState(property);
    const matchesStatus =
      filters.status === 'all' ? state !== 'archived' : state === filters.status;
    const matchesType =
      filters.type === 'all' ||
      property.type.trim().toUpperCase() === filters.type.trim().toUpperCase();
    return matchesSearch && matchesStatus && matchesType;
  });
}

export function orgPropertiesHasActiveFilters(filters: OrgPropertiesFilters): boolean {
  return filters.search.trim().length > 0 || filters.status !== 'all' || filters.type !== 'all';
}
