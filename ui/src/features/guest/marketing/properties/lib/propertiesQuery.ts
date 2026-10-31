import type { Property } from '@/features/guest/marketing/properties/components/PropertyCard';
import {
  parseCsvParam,
  parseNonNegInt,
  parseOptionalNumber,
  parseOptionalYmd,
  parsePositiveInt,
  parseSortAllowlist,
  setCsvOrDelete,
  setIfNotDefault,
  setOrDelete,
} from '@/features/guest/marketing/shared/lib/listingQueryParams';
import { resolveListingImages } from '@/features/guest/marketing/shared/lib/mockListingImages';

export const PROPERTIES_SORTS = ['recommended', 'rating', 'reviews', 'newest'] as const;

export type PropertiesSort = (typeof PROPERTIES_SORTS)[number];

export type PropertiesListingQuery = {
  where: string;
  type: string[];
  minPrice: number | null;
  maxPrice: number | null;
  bedrooms: number | null;
  amenities: string[];
  development: string[];
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  /** Guest coordinates for a Nearby search; scopes results to the nearby radius. */
  lat: number | null;
  lng: number | null;
  /** Map viewport — when set, API returns capped in-bounds markers (page ignored). */
  swLat: number | null;
  swLng: number | null;
  neLat: number | null;
  neLng: number | null;
  /** Place group slug for `/properties/in/:location` (server-side place filter). */
  locationSlug: string;
  sort: PropertiesSort;
  page: number;
  pageSize: number;
};

export const DEFAULT_PROPERTIES_QUERY: PropertiesListingQuery = {
  where: '',
  type: [],
  minPrice: null,
  maxPrice: null,
  bedrooms: null,
  amenities: [],
  development: [],
  checkIn: '',
  checkOut: '',
  adults: 0,
  children: 0,
  lat: null,
  lng: null,
  swLat: null,
  swLng: null,
  neLat: null,
  neLng: null,
  locationSlug: '',
  sort: 'recommended',
  page: 1,
  pageSize: 24,
};

export type PropertyFacetType = { type: string; label: string; count: number };
export type PropertyFacetBedroom = { value: number; count: number };
export type PropertyFacetAmenity = { id: string; label: string; count: number };
export type PropertyFacetDevelopment = { slug: string; name: string; count: number };

export type PropertiesFacets = {
  types: PropertyFacetType[];
  price: { min: number; max: number };
  bedrooms: PropertyFacetBedroom[];
  amenities: PropertyFacetAmenity[];
  developments: PropertyFacetDevelopment[];
};

export const EMPTY_PROPERTIES_FACETS: PropertiesFacets = {
  types: [],
  price: { min: 0, max: 0 },
  bedrooms: [],
  amenities: [],
  developments: [],
};

/** List-item shape sized for PropertyCard / PropertyListItem. */
export type PublicPropertyListItem = {
  id: string;
  slug: string;
  name: string;
  type: string;
  location: string;
  price: number;
  rating: number | null;
  reviews: number;
  images: string[];
  guests: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  isSuperhost?: boolean;
  isNew?: boolean;
  developmentSlug?: string;
  developmentName?: string;
  tower?: string;
  unitNumber?: string;
  createdAt?: string;
  latitude?: number | null;
  longitude?: number | null;
};

function parseBedrooms(raw: string | null): number | null {
  if (raw == null || raw === '' || raw === 'Any') return null;
  if (raw === '5+') return 5;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

export function parsePropertiesQuery(sp: URLSearchParams): PropertiesListingQuery {
  const guestsLegacy = parseNonNegInt(sp.get('guests'), 0);
  const adultsRaw = sp.get('adults');
  const childrenRaw = sp.get('children');
  let adults = parseNonNegInt(adultsRaw, 0);
  const children = parseNonNegInt(childrenRaw, 0);
  // Legacy collapsed guests → adults when adults/children absent
  if (adultsRaw == null && childrenRaw == null && guestsLegacy > 0) {
    adults = guestsLegacy;
  }

  return {
    where: (sp.get('where') ?? '').trim(),
    type: parseCsvParam(sp.get('type')),
    minPrice: parseOptionalNumber(sp.get('minPrice')),
    maxPrice: parseOptionalNumber(sp.get('maxPrice')),
    bedrooms: parseBedrooms(sp.get('bedrooms')),
    amenities: parseCsvParam(sp.get('amenities')),
    development: parseCsvParam(sp.get('development')),
    checkIn: parseOptionalYmd(sp.get('checkIn')),
    checkOut: parseOptionalYmd(sp.get('checkOut')),
    adults,
    children,
    lat: parseOptionalNumber(sp.get('lat')),
    lng: parseOptionalNumber(sp.get('lng')),
    swLat: parseOptionalNumber(sp.get('swLat')),
    swLng: parseOptionalNumber(sp.get('swLng')),
    neLat: parseOptionalNumber(sp.get('neLat')),
    neLng: parseOptionalNumber(sp.get('neLng')),
    locationSlug: (sp.get('locationSlug') ?? '').trim().toLowerCase(),
    sort: parseSortAllowlist(sp.get('sort'), PROPERTIES_SORTS, DEFAULT_PROPERTIES_QUERY.sort),
    page: parsePositiveInt(sp.get('page'), 1),
    pageSize: Math.min(
      Math.max(parsePositiveInt(sp.get('pageSize'), DEFAULT_PROPERTIES_QUERY.pageSize), 1),
      48
    ),
  };
}

export function writePropertiesQuery(
  query: PropertiesListingQuery,
  current?: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(current ?? undefined);
  const keys = [
    'where',
    'type',
    'minPrice',
    'maxPrice',
    'bedrooms',
    'amenities',
    'development',
    'checkIn',
    'checkOut',
    'adults',
    'children',
    'guests',
    'lat',
    'lng',
    'swLat',
    'swLng',
    'neLat',
    'neLng',
    'locationSlug',
    'sort',
    'page',
    'pageSize',
  ] as const;
  for (const key of keys) next.delete(key);

  setOrDelete(next, 'where', query.where || null);
  setCsvOrDelete(next, 'type', query.type);
  setIfNotDefault(next, 'minPrice', query.minPrice, null);
  setIfNotDefault(next, 'maxPrice', query.maxPrice, null);
  setIfNotDefault(next, 'bedrooms', query.bedrooms, null);
  setCsvOrDelete(next, 'amenities', query.amenities);
  setCsvOrDelete(next, 'development', query.development);
  setOrDelete(next, 'checkIn', query.checkIn || null);
  setOrDelete(next, 'checkOut', query.checkOut || null);
  setIfNotDefault(next, 'adults', query.adults, 0);
  setIfNotDefault(next, 'children', query.children, 0);
  setIfNotDefault(next, 'lat', query.lat, null);
  setIfNotDefault(next, 'lng', query.lng, null);
  setIfNotDefault(next, 'swLat', query.swLat, null);
  setIfNotDefault(next, 'swLng', query.swLng, null);
  setIfNotDefault(next, 'neLat', query.neLat, null);
  setIfNotDefault(next, 'neLng', query.neLng, null);
  setOrDelete(next, 'locationSlug', query.locationSlug || null);
  setIfNotDefault(next, 'sort', query.sort, DEFAULT_PROPERTIES_QUERY.sort);
  setIfNotDefault(next, 'page', query.page, 1);
  setIfNotDefault(next, 'pageSize', query.pageSize, DEFAULT_PROPERTIES_QUERY.pageSize);
  return next;
}

export function countActivePropertyFilters(query: PropertiesListingQuery): number {
  return (
    query.type.length +
    (query.minPrice != null || query.maxPrice != null ? 1 : 0) +
    (query.bedrooms != null ? 1 : 0) +
    query.amenities.length +
    query.development.length +
    (query.checkIn && query.checkOut ? 1 : 0) +
    (query.adults > 0 || query.children > 0 ? 1 : 0)
  );
}

export function clearPropertyFilters(query: PropertiesListingQuery): PropertiesListingQuery {
  return {
    ...query,
    type: [],
    minPrice: null,
    maxPrice: null,
    bedrooms: null,
    amenities: [],
    development: [],
    page: 1,
  };
}

export function toPropertyCard(item: PublicPropertyListItem): Property {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    location: item.location,
    price: item.price,
    rating: item.rating,
    reviews: item.reviews,
    images: resolveListingImages(item.images, 'property', item.slug),
    type: item.type,
    guests: item.guests,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    amenities: item.amenities,
    isSuperhost: item.isSuperhost,
    isNew: item.isNew,
    developmentSlug: item.developmentSlug,
    developmentName: item.developmentName,
    tower: item.tower,
    unitNumber: item.unitNumber,
    latitude: item.latitude,
    longitude: item.longitude,
  };
}
