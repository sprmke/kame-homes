import type { HeroSearchValues } from '@/features/guest/marketing/guest-landing/components/HeroSearch';

import type { ParkingSlot } from '../types';

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

const PARKING_PRICE_RANGES: Record<string, { min: number; max: number | null }> = {
  budget: { min: 0, max: 200 },
  mid: { min: 200, max: 350 },
  premium: { min: 350, max: null },
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

export function uniqueTowersFromInsideSlots(slots: ParkingSlot[]): string[] {
  return [
    ...new Set(slots.filter((s) => s.type === 'inside_tower' && s.isAvailable).map((s) => s.tower)),
  ].sort((a, b) => a.localeCompare(b));
}

export function showsTowerFilter(filters: ParkingFilterState): boolean {
  return filters.locations.includes('inside_tower');
}

function slotMatchesLocation(slot: ParkingSlot, filters: ParkingFilterState): boolean {
  const hasFilter = filters.locations.length > 0 || filters.motorcycle;
  if (!hasFilter) return true;
  if (slot.type === 'motorcycle') return filters.motorcycle;
  if (slot.type === 'inside_tower') return filters.locations.includes('inside_tower');
  if (slot.type === 'outside_tower') return filters.locations.includes('outside_tower');
  return false;
}

function matchesPriceRange(rate: number | undefined, rangeId: string | null): boolean {
  if (!rangeId) return true;
  const range = PARKING_PRICE_RANGES[rangeId];
  if (!range) return true;
  const value = rate ?? 0;
  if (range.max === null) return value >= range.min;
  return value >= range.min && value < range.max;
}

export function filterParkingSlots(
  slots: ParkingSlot[],
  filters: ParkingFilterState,
  _searchValues: HeroSearchValues
): ParkingSlot[] {
  return slots.filter((slot) => {
    if (!slot.isAvailable) return false;
    if (!slotMatchesLocation(slot, filters)) return false;
    if (filters.towers.length > 0 && !filters.towers.includes(slot.tower)) return false;
    if (!matchesPriceRange(slot.ratePerNight, filters.priceRange)) return false;
    return true;
  });
}

export function sortParkingSlots(slots: ParkingSlot[], _sortBy: ParkingSortKey): ParkingSlot[] {
  const arr = [...slots];
  return arr.sort(
    (a, b) => a.tower.localeCompare(b.tower) || (a.ratePerNight ?? 0) - (b.ratePerNight ?? 0)
  );
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
