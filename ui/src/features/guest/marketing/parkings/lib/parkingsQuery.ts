import {
  locationsFromLegacyTypeParam,
  type ParkingFilterState,
  type ParkingLocationFilter,
  type ParkingSortKey,
} from '@/features/guest/marketing/developments/lib/parkingSlotFilters';
import type { ParkingSlot, ParkingType } from '@/features/guest/marketing/developments/types';
import type { ParkingListEntry } from '@/features/guest/marketing/parkings/lib/parkingListEntries';
import {
  parseCsvParam,
  parseOptionalNumber,
  parseOptionalYmd,
  parsePositiveInt,
  parseSortAllowlist,
  setCsvOrDelete,
  setIfNotDefault,
  setOrDelete,
} from '@/features/guest/marketing/shared/lib/listingQueryParams';
import { normalizeCityPlace } from '@/features/guest/marketing/shared/lib/locationSlug';
import { resolveListingCoverImage } from '@/features/guest/marketing/shared/lib/mockListingImages';

export const PARKINGS_SORTS = ['tower'] as const;

export type ParkingsListingQuery = {
  where: string;
  locations: ParkingLocationFilter[];
  motorcycle: boolean;
  towers: string[];
  minPrice: number | null;
  maxPrice: number | null;
  checkIn: string;
  checkOut: string;
  /** Guest coordinates for a Nearby search; scopes results to the nearby radius. */
  lat: number | null;
  lng: number | null;
  swLat: number | null;
  swLng: number | null;
  neLat: number | null;
  neLng: number | null;
  /** Place group slug for `/parkings/in/:location`. */
  locationSlug: string;
  /** Exact development slug for `/developments/:slug/parking`. */
  developmentSlug: string;
  sort: ParkingSortKey;
  page: number;
  pageSize: number;
};

export const DEFAULT_PARKINGS_QUERY: ParkingsListingQuery = {
  where: '',
  locations: [],
  motorcycle: false,
  towers: [],
  minPrice: null,
  maxPrice: null,
  checkIn: '',
  checkOut: '',
  lat: null,
  lng: null,
  swLat: null,
  swLng: null,
  neLat: null,
  neLng: null,
  locationSlug: '',
  developmentSlug: '',
  sort: 'tower',
  page: 1,
  pageSize: 24,
};

export type ParkingFacetLocation = {
  location: 'inside_tower' | 'outside_tower' | 'motorcycle';
  count: number;
};

export type ParkingFacetTower = { tower: string; count: number };

export type ParkingsFacets = {
  locations: ParkingFacetLocation[];
  towers: ParkingFacetTower[];
  price: { min: number; max: number };
};

export const EMPTY_PARKINGS_FACETS: ParkingsFacets = {
  locations: [],
  towers: [],
  price: { min: 0, max: 0 },
};

export type PublicParkingListItem = {
  id: string;
  slug: string;
  name: string;
  parkingType: ParkingType;
  tower?: string;
  level?: string;
  slotLabel: string;
  ratePerNight: number;
  features: string[];
  coverImage?: string;
  residenceName?: string;
  city?: string;
  developmentSlug?: string;
  developmentName?: string;
  latitude?: number | null;
  longitude?: number | null;
};

const PARKING_LOCATION_FILTER_SLUGS = new Set(['inside_tower', 'outside_tower', 'motorcycle']);

/** True when `location` holds parking slot-type filters (not a geographic Where query). */
export function isParkingLocationFilterParam(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  const parts = parseCsvParam(raw);
  if (parts.length === 0) return false;
  return parts.every((part) => PARKING_LOCATION_FILTER_SLUGS.has(part));
}

function parseLocationFilters(sp: URLSearchParams): {
  locations: ParkingLocationFilter[];
  motorcycle: boolean;
} {
  const fromLocation = parseCsvParam(sp.get('location'));
  const legacy = locationsFromLegacyTypeParam(sp.get('type'));

  if (fromLocation.length > 0) {
    return {
      locations: fromLocation.filter(
        (value): value is ParkingLocationFilter =>
          value === 'inside_tower' || value === 'outside_tower'
      ),
      motorcycle: fromLocation.includes('motorcycle'),
    };
  }

  return {
    locations: legacy.locations,
    motorcycle: legacy.motorcycle,
  };
}

function writeLocationParams(query: ParkingsListingQuery, params: URLSearchParams): void {
  const values: string[] = [...query.locations];
  if (query.motorcycle) values.push('motorcycle');
  setCsvOrDelete(params, 'location', values);
  params.delete('type');
}

export function parseParkingsQuery(sp: URLSearchParams): ParkingsListingQuery {
  const { locations, motorcycle } = parseLocationFilters(sp);

  return {
    where: (sp.get('where') ?? '').trim(),
    locations,
    motorcycle,
    towers: parseCsvParam(sp.get('towers')),
    minPrice: parseOptionalNumber(sp.get('minPrice')),
    maxPrice: parseOptionalNumber(sp.get('maxPrice')),
    checkIn: parseOptionalYmd(sp.get('checkIn')),
    checkOut: parseOptionalYmd(sp.get('checkOut')),
    lat: parseOptionalNumber(sp.get('lat')),
    lng: parseOptionalNumber(sp.get('lng')),
    swLat: parseOptionalNumber(sp.get('swLat')),
    swLng: parseOptionalNumber(sp.get('swLng')),
    neLat: parseOptionalNumber(sp.get('neLat')),
    neLng: parseOptionalNumber(sp.get('neLng')),
    locationSlug: (sp.get('locationSlug') ?? '').trim().toLowerCase(),
    developmentSlug: (sp.get('developmentSlug') ?? '').trim().toLowerCase(),
    sort: parseSortAllowlist(sp.get('sort'), PARKINGS_SORTS, DEFAULT_PARKINGS_QUERY.sort),
    page: parsePositiveInt(sp.get('page'), 1),
    pageSize: Math.min(
      Math.max(parsePositiveInt(sp.get('pageSize'), DEFAULT_PARKINGS_QUERY.pageSize), 1),
      48
    ),
  };
}

export function writeParkingsQuery(
  query: ParkingsListingQuery,
  current?: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(current ?? undefined);
  const keys = [
    'where',
    'location',
    'type',
    'towers',
    'minPrice',
    'maxPrice',
    'checkIn',
    'checkOut',
    'lat',
    'lng',
    'swLat',
    'swLng',
    'neLat',
    'neLng',
    'locationSlug',
    'developmentSlug',
    'sort',
    'page',
    'pageSize',
  ] as const;
  for (const key of keys) next.delete(key);

  setOrDelete(next, 'where', query.where || null);
  writeLocationParams(query, next);
  setCsvOrDelete(next, 'towers', query.towers);
  setIfNotDefault(next, 'minPrice', query.minPrice, null);
  setIfNotDefault(next, 'maxPrice', query.maxPrice, null);
  setOrDelete(next, 'checkIn', query.checkIn || null);
  setOrDelete(next, 'checkOut', query.checkOut || null);
  setIfNotDefault(next, 'lat', query.lat, null);
  setIfNotDefault(next, 'lng', query.lng, null);
  setIfNotDefault(next, 'swLat', query.swLat, null);
  setIfNotDefault(next, 'swLng', query.swLng, null);
  setIfNotDefault(next, 'neLat', query.neLat, null);
  setIfNotDefault(next, 'neLng', query.neLng, null);
  setOrDelete(next, 'locationSlug', query.locationSlug || null);
  setOrDelete(next, 'developmentSlug', query.developmentSlug || null);
  setIfNotDefault(next, 'sort', query.sort, DEFAULT_PARKINGS_QUERY.sort);
  setIfNotDefault(next, 'page', query.page, 1);
  setIfNotDefault(next, 'pageSize', query.pageSize, DEFAULT_PARKINGS_QUERY.pageSize);
  return next;
}

export function parkingsQueryToFilterState(query: ParkingsListingQuery): ParkingFilterState {
  let priceRange: string | null = null;
  if (query.minPrice === 0 && query.maxPrice === 200) priceRange = 'budget';
  else if (query.minPrice === 200 && query.maxPrice === 350) priceRange = 'mid';
  else if (query.minPrice === 350 && query.maxPrice == null) priceRange = 'premium';
  else if (query.minPrice != null || query.maxPrice != null) priceRange = 'custom';

  return {
    locations: query.locations,
    motorcycle: query.motorcycle,
    towers: query.towers,
    priceRange: priceRange === 'custom' ? null : priceRange,
  };
}

export function filterStateToParkingsQuery(
  filters: ParkingFilterState,
  base: ParkingsListingQuery
): ParkingsListingQuery {
  let minPrice = base.minPrice;
  let maxPrice = base.maxPrice;

  if (filters.priceRange === 'budget') {
    minPrice = 0;
    maxPrice = 200;
  } else if (filters.priceRange === 'mid') {
    minPrice = 200;
    maxPrice = 350;
  } else if (filters.priceRange === 'premium') {
    minPrice = 350;
    maxPrice = null;
  } else if (filters.priceRange == null && (base.minPrice != null || base.maxPrice != null)) {
    minPrice = null;
    maxPrice = null;
  }

  return {
    ...base,
    locations: filters.locations,
    motorcycle: filters.motorcycle,
    towers: filters.towers,
    minPrice,
    maxPrice,
    page: 1,
  };
}

export function countActiveParkingsQueryFilters(query: ParkingsListingQuery): number {
  return (
    query.locations.length +
    (query.motorcycle ? 1 : 0) +
    (query.locations.includes('inside_tower') ? query.towers.length : 0) +
    (query.minPrice != null || query.maxPrice != null ? 1 : 0) +
    (query.checkIn && query.checkOut ? 1 : 0)
  );
}

export function clearParkingsFilters(query: ParkingsListingQuery): ParkingsListingQuery {
  return {
    ...query,
    locations: [],
    motorcycle: false,
    towers: [],
    minPrice: null,
    maxPrice: null,
    page: 1,
  };
}

export function toParkingListEntry(item: PublicParkingListItem): ParkingListEntry {
  const slot: ParkingSlot = {
    id: item.id,
    developmentId: item.developmentSlug ?? item.id,
    slotLabel: item.slotLabel,
    type: item.parkingType,
    tower: item.tower ?? '',
    level: item.level ?? '',
    isAvailable: true,
    ratePerNight: item.ratePerNight,
    features: item.features,
    imageUrl: resolveListingCoverImage(undefined, item.coverImage, 'parking', item.slug),
  };

  return {
    slot,
    developmentSlug: item.developmentSlug ?? '',
    developmentName: item.developmentName ?? item.residenceName ?? '',
    city: normalizeCityPlace(item.city),
    detailSlug: item.slug,
  };
}
