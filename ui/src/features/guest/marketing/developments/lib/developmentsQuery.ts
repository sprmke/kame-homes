import {
  parseCsvParam,
  parseOptionalNumber,
  parsePositiveInt,
  parseSortAllowlist,
  setCsvOrDelete,
  setIfNotDefault,
  setOrDelete,
} from '@/features/guest/marketing/shared/lib/listingQueryParams';
import {
  resolveListingCoverImage,
  resolveListingImages,
} from '@/features/guest/marketing/shared/lib/mockListingImages';

import type { Development, DevelopmentType } from '../types';

export const DEVELOPMENTS_SORTS = ['recommended', 'newest'] as const;

export type DevelopmentsSort = (typeof DEVELOPMENTS_SORTS)[number];

export type DevelopmentsListingQuery = {
  where: string;
  type: string[];
  city: string[];
  minPrice: number | null;
  maxPrice: number | null;
  developer: string[];
  /** Guest coordinates for a Nearby search; scopes results to the nearby radius. */
  lat: number | null;
  lng: number | null;
  swLat: number | null;
  swLng: number | null;
  neLat: number | null;
  neLng: number | null;
  /** Place group slug for `/developments/in/:location`. */
  locationSlug: string;
  /** Exact development slug for detail pages. */
  slug: string;
  sort: DevelopmentsSort;
  page: number;
  pageSize: number;
};

export const DEFAULT_DEVELOPMENTS_QUERY: DevelopmentsListingQuery = {
  where: '',
  type: [],
  city: [],
  minPrice: null,
  maxPrice: null,
  developer: [],
  lat: null,
  lng: null,
  swLat: null,
  swLng: null,
  neLat: null,
  neLng: null,
  locationSlug: '',
  slug: '',
  sort: 'recommended',
  page: 1,
  pageSize: 24,
};

export type DevelopmentFacetType = { type: string; label: string; count: number };
export type DevelopmentFacetCity = { city: string; count: number };
export type DevelopmentFacetDeveloper = { name: string; count: number };

export type DevelopmentsFacets = {
  types: DevelopmentFacetType[];
  cities: DevelopmentFacetCity[];
  price: { min: number; max: number };
  developers: DevelopmentFacetDeveloper[];
};

export const EMPTY_DEVELOPMENTS_FACETS: DevelopmentsFacets = {
  types: [],
  cities: [],
  price: { min: 0, max: 0 },
  developers: [],
};

export type PublicDevelopmentListItem = {
  id: string;
  slug: string;
  name: string;
  developerName: string;
  type: string;
  location: string;
  city: string;
  description: string;
  coverImage: string;
  images: string[];
  amenities: string[];
  propertyCount: number;
  priceRange: { min: number; max: number };
  established?: number;
  propertyIds: string[];
  latitude?: number | null;
  longitude?: number | null;
};

export function parseDevelopmentsQuery(sp: URLSearchParams): DevelopmentsListingQuery {
  return {
    where: (sp.get('where') ?? '').trim(),
    type: parseCsvParam(sp.get('type')),
    city: parseCsvParam(sp.get('city')),
    minPrice: parseOptionalNumber(sp.get('minPrice')),
    maxPrice: parseOptionalNumber(sp.get('maxPrice')),
    developer: parseCsvParam(sp.get('developer')),
    lat: parseOptionalNumber(sp.get('lat')),
    lng: parseOptionalNumber(sp.get('lng')),
    swLat: parseOptionalNumber(sp.get('swLat')),
    swLng: parseOptionalNumber(sp.get('swLng')),
    neLat: parseOptionalNumber(sp.get('neLat')),
    neLng: parseOptionalNumber(sp.get('neLng')),
    locationSlug: (sp.get('locationSlug') ?? '').trim().toLowerCase(),
    slug: (sp.get('slug') ?? '').trim().toLowerCase(),
    sort: parseSortAllowlist(sp.get('sort'), DEVELOPMENTS_SORTS, DEFAULT_DEVELOPMENTS_QUERY.sort),
    page: parsePositiveInt(sp.get('page'), 1),
    pageSize: Math.min(
      Math.max(parsePositiveInt(sp.get('pageSize'), DEFAULT_DEVELOPMENTS_QUERY.pageSize), 1),
      48
    ),
  };
}

export function writeDevelopmentsQuery(
  query: DevelopmentsListingQuery,
  current?: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(current ?? undefined);
  const keys = [
    'where',
    'type',
    'city',
    'minPrice',
    'maxPrice',
    'developer',
    'lat',
    'lng',
    'swLat',
    'swLng',
    'neLat',
    'neLng',
    'locationSlug',
    'slug',
    'sort',
    'page',
    'pageSize',
  ] as const;
  for (const key of keys) next.delete(key);

  if (query.where) next.set('where', query.where);
  setCsvOrDelete(next, 'type', query.type);
  setCsvOrDelete(next, 'city', query.city);
  setIfNotDefault(next, 'minPrice', query.minPrice, null);
  setIfNotDefault(next, 'maxPrice', query.maxPrice, null);
  setCsvOrDelete(next, 'developer', query.developer);
  setIfNotDefault(next, 'lat', query.lat, null);
  setIfNotDefault(next, 'lng', query.lng, null);
  setIfNotDefault(next, 'swLat', query.swLat, null);
  setIfNotDefault(next, 'swLng', query.swLng, null);
  setIfNotDefault(next, 'neLat', query.neLat, null);
  setIfNotDefault(next, 'neLng', query.neLng, null);
  setOrDelete(next, 'locationSlug', query.locationSlug || null);
  setOrDelete(next, 'slug', query.slug || null);
  setIfNotDefault(next, 'sort', query.sort, DEFAULT_DEVELOPMENTS_QUERY.sort);
  setIfNotDefault(next, 'page', query.page, 1);
  setIfNotDefault(next, 'pageSize', query.pageSize, DEFAULT_DEVELOPMENTS_QUERY.pageSize);
  return next;
}

export function countActiveDevelopmentFilters(query: DevelopmentsListingQuery): number {
  return (
    query.type.length +
    query.city.length +
    (query.minPrice != null || query.maxPrice != null ? 1 : 0) +
    query.developer.length
  );
}

export function clearDevelopmentFilters(query: DevelopmentsListingQuery): DevelopmentsListingQuery {
  return {
    ...query,
    type: [],
    city: [],
    minPrice: null,
    maxPrice: null,
    developer: [],
    page: 1,
  };
}

export function toDevelopmentCard(item: PublicDevelopmentListItem): Development {
  const images = resolveListingImages(item.images, 'development', item.slug);
  const coverImage = resolveListingCoverImage(
    item.images,
    item.coverImage,
    'development',
    item.slug
  );

  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    developerName: item.developerName,
    type: item.type as DevelopmentType,
    location: item.location,
    city: item.city,
    description: item.description,
    coverImage,
    images,
    amenities: item.amenities,
    propertyCount: item.propertyCount,
    priceRange: item.priceRange,
    established: item.established,
    propertyIds: item.propertyIds,
    latitude: item.latitude,
    longitude: item.longitude,
  };
}
