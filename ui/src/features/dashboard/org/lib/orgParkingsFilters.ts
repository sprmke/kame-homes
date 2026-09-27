import { orgParkingSearchHaystack } from '@/features/dashboard/org/lib/orgParkingDisplay';
import type { Parking } from '@/features/dashboard/org/types';

export type OrgParkingsViewMode = 'table' | 'grid' | 'list';

export type OrgParkingsFilters = {
  search: string;
  status: 'all' | 'ACTIVE' | 'INACTIVE';
  type: 'all' | string;
};

export function filterOrgParkings(parkings: Parking[], filters: OrgParkingsFilters): Parking[] {
  const query = filters.search.trim().toLowerCase();

  return parkings.filter((parking) => {
    const matchesSearch = !query || orgParkingSearchHaystack(parking).includes(query);
    const matchesStatus = filters.status === 'all' || parking.status === filters.status;
    const matchesType =
      filters.type === 'all' ||
      parking.parkingType.trim().toLowerCase() === filters.type.trim().toLowerCase();
    return matchesSearch && matchesStatus && matchesType;
  });
}

export function orgParkingsHasActiveFilters(filters: OrgParkingsFilters): boolean {
  return filters.search.trim().length > 0 || filters.status !== 'all' || filters.type !== 'all';
}
