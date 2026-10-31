import type {
  DevelopmentsFacets,
  DevelopmentsListingQuery,
} from '@/features/guest/marketing/developments/lib/developmentsQuery';
import type {
  ParkingFilterState,
  ParkingLocationFilter,
} from '@/features/guest/marketing/developments/lib/parkingSlotFilters';
import {
  PARKING_LOCATION_OPTIONS,
  PARKING_PRICE_RANGE_OPTIONS,
} from '@/features/guest/marketing/developments/lib/parkingSlotFilters';
import type {
  PropertiesFacets,
  PropertiesListingQuery,
} from '@/features/guest/marketing/properties/lib/propertiesQuery';
import type { ListingFilterChip } from '@/features/guest/marketing/shared/components/ListingActiveFilterChips';

function formatPriceChip(min: number | null, max: number | null): string {
  if (min != null && max != null) return `₱${min.toLocaleString()}–₱${max.toLocaleString()}`;
  if (min != null) return `₱${min.toLocaleString()}+`;
  if (max != null) return `Under ₱${max.toLocaleString()}`;
  return 'Price';
}

export function buildPropertyFilterChips(
  query: PropertiesListingQuery,
  facets?: PropertiesFacets
): ListingFilterChip[] {
  const chips: ListingFilterChip[] = [];
  const typeLabel = new Map((facets?.types ?? []).map((t) => [t.type, t.label]));
  for (const type of query.type) {
    chips.push({ id: `type:${type}`, label: typeLabel.get(type) ?? type });
  }
  if (query.minPrice != null || query.maxPrice != null) {
    chips.push({ id: 'price', label: formatPriceChip(query.minPrice, query.maxPrice) });
  }
  if (query.bedrooms != null) {
    chips.push({
      id: 'bedrooms',
      label:
        query.bedrooms >= 5
          ? '5+ bedrooms'
          : `${query.bedrooms} bedroom${query.bedrooms === 1 ? '' : 's'}`,
    });
  }
  const amenityLabel = new Map((facets?.amenities ?? []).map((a) => [a.id, a.label]));
  for (const id of query.amenities) {
    chips.push({ id: `amenity:${id}`, label: amenityLabel.get(id) ?? id });
  }
  const devLabel = new Map((facets?.developments ?? []).map((d) => [d.slug, d.name]));
  for (const slug of query.development) {
    chips.push({ id: `development:${slug}`, label: devLabel.get(slug) ?? slug });
  }
  return chips;
}

export function removePropertyFilterChip(
  query: PropertiesListingQuery,
  chipId: string
): PropertiesListingQuery {
  if (chipId === 'price') return { ...query, minPrice: null, maxPrice: null, page: 1 };
  if (chipId === 'bedrooms') return { ...query, bedrooms: null, page: 1 };
  if (chipId.startsWith('type:')) {
    const type = chipId.slice(5);
    return { ...query, type: query.type.filter((t) => t !== type), page: 1 };
  }
  if (chipId.startsWith('amenity:')) {
    const id = chipId.slice(8);
    return { ...query, amenities: query.amenities.filter((a) => a !== id), page: 1 };
  }
  if (chipId.startsWith('development:')) {
    const slug = chipId.slice(12);
    return { ...query, development: query.development.filter((d) => d !== slug), page: 1 };
  }
  return query;
}

export function buildDevelopmentFilterChips(
  query: DevelopmentsListingQuery,
  facets?: DevelopmentsFacets
): ListingFilterChip[] {
  const chips: ListingFilterChip[] = [];
  const typeLabel = new Map((facets?.types ?? []).map((t) => [t.type, t.label]));
  for (const type of query.type) {
    chips.push({ id: `type:${type}`, label: typeLabel.get(type) ?? type });
  }
  for (const city of query.city) {
    chips.push({ id: `city:${city}`, label: city });
  }
  if (query.minPrice != null || query.maxPrice != null) {
    chips.push({ id: 'price', label: formatPriceChip(query.minPrice, query.maxPrice) });
  }
  for (const name of query.developer) {
    chips.push({ id: `developer:${name}`, label: name });
  }
  return chips;
}

export function removeDevelopmentFilterChip(
  query: DevelopmentsListingQuery,
  chipId: string
): DevelopmentsListingQuery {
  if (chipId === 'price') return { ...query, minPrice: null, maxPrice: null, page: 1 };
  if (chipId.startsWith('type:')) {
    const type = chipId.slice(5);
    return { ...query, type: query.type.filter((t) => t !== type), page: 1 };
  }
  if (chipId.startsWith('city:')) {
    const city = chipId.slice(5);
    return { ...query, city: query.city.filter((c) => c !== city), page: 1 };
  }
  if (chipId.startsWith('developer:')) {
    const name = chipId.slice(10);
    return { ...query, developer: query.developer.filter((d) => d !== name), page: 1 };
  }
  return query;
}

export function buildParkingFilterChips(filters: ParkingFilterState): ListingFilterChip[] {
  const chips: ListingFilterChip[] = [];
  const locationLabel = new Map(PARKING_LOCATION_OPTIONS.map((o) => [o.id, o.label]));
  for (const loc of filters.locations) {
    chips.push({ id: `location:${loc}`, label: locationLabel.get(loc) ?? loc });
  }
  if (filters.motorcycle) {
    chips.push({ id: 'motorcycle', label: 'Motorcycle' });
  }
  for (const tower of filters.towers) {
    chips.push({ id: `tower:${tower}`, label: tower });
  }
  if (filters.priceRange != null) {
    const opt = PARKING_PRICE_RANGE_OPTIONS.find((o) => o.id === filters.priceRange);
    chips.push({ id: 'price', label: opt?.label ?? 'Price' });
  }
  return chips;
}

export function removeParkingFilterChip(
  filters: ParkingFilterState,
  chipId: string
): ParkingFilterState {
  if (chipId === 'price') return { ...filters, priceRange: null };
  if (chipId === 'motorcycle') return { ...filters, motorcycle: false };
  if (chipId.startsWith('location:')) {
    const id = chipId.slice(9) as ParkingLocationFilter;
    const locations = filters.locations.filter((l) => l !== id);
    return {
      ...filters,
      locations,
      towers: locations.includes('inside_tower') ? filters.towers : [],
    };
  }
  if (chipId.startsWith('tower:')) {
    const tower = chipId.slice(6);
    return { ...filters, towers: filters.towers.filter((t) => t !== tower) };
  }
  return filters;
}

export const PROPERTY_SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'reviews', label: 'Most Reviews' },
  { value: 'newest', label: 'Newest' },
] as const;

export const DEVELOPMENT_SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'newest', label: 'Newest' },
] as const;

export const PARKING_SORT_OPTIONS = [{ value: 'tower', label: 'Tower' }] as const;
