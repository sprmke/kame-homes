export type ParkingLocationFilter = 'inside_tower' | 'outside_tower';

export interface ParkingFilterState {
  locations: ParkingLocationFilter[];
  motorcycle: boolean;
  towers: string[];
  priceRange: string | null;
}

export const DEFAULT_PARKING_FILTERS: ParkingFilterState = {
  locations: [],
  motorcycle: false,
  towers: [],
  priceRange: null,
};

export const PARKING_PRICE_RANGE_OPTIONS = [
  { id: 'budget', label: 'Budget', display: '₱0 – ₱200' },
  { id: 'mid', label: 'Mid-range', display: '₱200 – ₱350' },
  { id: 'premium', label: 'Premium', display: '₱350+' },
] as const;

export const PARKING_LOCATION_OPTIONS: Array<{
  id: ParkingLocationFilter;
  label: string;
}> = [
  { id: 'inside_tower', label: 'Inside Tower' },
  { id: 'outside_tower', label: 'Outside Tower' },
];

export type ParkingSortKey = 'tower';

export function showsTowerFilter(filters: ParkingFilterState): boolean {
  return filters.locations.includes('inside_tower');
}

export function countActiveParkingFilters(filters: ParkingFilterState): number {
  return (
    filters.locations.length +
    (filters.motorcycle ? 1 : 0) +
    (showsTowerFilter(filters) ? filters.towers.length : 0) +
    (filters.priceRange ? 1 : 0)
  );
}

/** Map legacy `?type=` query values to location filters. */
export function locationsFromLegacyTypeParam(type: string | null | undefined): {
  locations: ParkingLocationFilter[];
  motorcycle: boolean;
} {
  const normalized = (type ?? '').trim().toLowerCase();
  if (normalized === 'inside_tower' || normalized === 'outside_tower') {
    return { locations: [normalized], motorcycle: false };
  }
  if (normalized === 'motorcycle') {
    return { locations: [], motorcycle: true };
  }
  return { locations: [], motorcycle: false };
}
