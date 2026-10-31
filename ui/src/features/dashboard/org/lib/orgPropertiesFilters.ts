import { orgPropertySearchHaystack } from '@/features/dashboard/org/lib/orgPropertyDisplay';
import type { Property } from '@/features/dashboard/org/types';

export type OrgPropertiesViewMode = 'table' | 'grid' | 'list';

export type OrgPropertiesFilters = {
  search: string;
  status: 'all' | 'ACTIVE' | 'INACTIVE';
  type: 'all' | string;
};

export function filterOrgProperties(
  properties: Property[],
  filters: OrgPropertiesFilters
): Property[] {
  const query = filters.search.trim().toLowerCase();

  return properties.filter((property) => {
    const matchesSearch = !query || orgPropertySearchHaystack(property).includes(query);
    const matchesStatus = filters.status === 'all' || property.status === filters.status;
    const matchesType =
      filters.type === 'all' ||
      property.type.trim().toUpperCase() === filters.type.trim().toUpperCase();
    return matchesSearch && matchesStatus && matchesType;
  });
}

export function orgPropertiesHasActiveFilters(filters: OrgPropertiesFilters): boolean {
  return filters.search.trim().length > 0 || filters.status !== 'all' || filters.type !== 'all';
}
