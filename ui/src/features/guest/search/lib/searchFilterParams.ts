/**
 * Bridge search URL ↔ vertical listing filter queries.
 * Keeps search `type` (category) distinct from property/development type filters
 * (`propertyType` / `devType` on /search).
 *
 * Nearby and concept nouns are intents, not place names: they travel as lat/lng
 * or hard type filters, never as `where` text that would ilike-match a word no
 * listing contains.
 */

import {
  DEFAULT_DEVELOPMENTS_QUERY,
  parseDevelopmentsQuery,
  writeDevelopmentsQuery,
  type DevelopmentsListingQuery,
} from '@/features/guest/marketing/developments/lib/developmentsQuery';
import {
  DEFAULT_PARKINGS_QUERY,
  parseParkingsQuery,
  writeParkingsQuery,
  type ParkingsListingQuery,
} from '@/features/guest/marketing/parkings/lib/parkingsQuery';
import {
  DEFAULT_PROPERTIES_QUERY,
  parsePropertiesQuery,
  writePropertiesQuery,
  type PropertiesListingQuery,
} from '@/features/guest/marketing/properties/lib/propertiesQuery';
import {
  parseCsvParam,
  setCsvOrDelete,
} from '@/features/guest/marketing/shared/lib/listingQueryParams';
import {
  canBridgeConceptToListPublic,
  resolveClientSearchIntent,
} from '@/features/guest/search/lib/searchIntents';
import type { SearchListingsQuery } from '@/features/guest/search/types/search';

const SEARCH_FILTER_KEYS = [
  'propertyType',
  'devType',
  'minPrice',
  'maxPrice',
  'bedrooms',
  'amenities',
  'development',
  'city',
  'developer',
  'location',
  'towers',
  'sort',
] as const;

/** Search `where` for the listing endpoints — empty for intent-driven searches. */
function listingWhere(search: SearchListingsQuery): string {
  const intent = resolveClientSearchIntent(search.where);
  if (intent.kind === 'nearby' || intent.kind === 'concept') return '';
  return search.where;
}

/** Build a properties list query from /search URL + search hero fields. */
export function propertiesQueryFromSearch(
  sp: URLSearchParams,
  search: SearchListingsQuery
): PropertiesListingQuery {
  const bridged = new URLSearchParams(sp);
  bridged.delete('type');
  const propertyTypes = parseCsvParam(sp.get('propertyType'));
  if (propertyTypes.length > 0) bridged.set('type', propertyTypes.join(','));
  else bridged.delete('type');

  const base = parsePropertiesQuery(bridged);
  const intent = resolveClientSearchIntent(search.where);
  const conceptTypes =
    intent.kind === 'concept' ? intent.propertyTypes.map((type) => type.toLowerCase()) : [];

  return {
    ...base,
    where: listingWhere(search),
    type: propertyTypes.length > 0 ? base.type : conceptTypes.length > 0 ? conceptTypes : base.type,
    checkIn: search.checkIn || base.checkIn,
    checkOut: search.checkOut || base.checkOut,
    adults: search.adults || base.adults,
    children: search.children || base.children,
    lat: search.lat ?? base.lat,
    lng: search.lng ?? base.lng,
    page: search.page,
    pageSize: search.pageSize,
  };
}

/** Whether /search should load a category via list-public-* vs search-listings. */
export function shouldUsePublicListForSearchCategory(
  category: 'properties' | 'developments' | 'parkings',
  search: SearchListingsQuery
): boolean {
  const intent = resolveClientSearchIntent(search.where);
  if (intent.kind === 'nearby') return true;
  if (intent.kind === 'concept') {
    if (!canBridgeConceptToListPublic(intent)) return false;
    if (intent.preferType === 'parkings') return category === 'parkings';
    if (intent.propertyTypes.length > 0) return category === 'properties';
    return false;
  }
  return true;
}

export function developmentsQueryFromSearch(
  sp: URLSearchParams,
  search: SearchListingsQuery
): DevelopmentsListingQuery {
  const bridged = new URLSearchParams(sp);
  bridged.delete('type');
  const devTypes = parseCsvParam(sp.get('devType'));
  if (devTypes.length > 0) bridged.set('type', devTypes.join(','));
  else bridged.delete('type');

  const base = parseDevelopmentsQuery(bridged);
  return {
    ...base,
    where: listingWhere(search),
    lat: search.lat ?? base.lat,
    lng: search.lng ?? base.lng,
    page: search.page,
    pageSize: search.pageSize,
  };
}

export function parkingsQueryFromSearch(
  sp: URLSearchParams,
  search: SearchListingsQuery
): ParkingsListingQuery {
  const base = parseParkingsQuery(sp);
  return {
    ...base,
    where: listingWhere(search),
    checkIn: search.checkIn || base.checkIn,
    checkOut: search.checkOut || base.checkOut,
    lat: search.lat ?? base.lat,
    lng: search.lng ?? base.lng,
    page: search.page,
    pageSize: search.pageSize,
  };
}

/** Merge properties filter changes into the current /search URLSearchParams. */
export function writePropertiesFiltersToSearch(
  filters: PropertiesListingQuery,
  current: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of SEARCH_FILTER_KEYS) next.delete(key);

  const written = writePropertiesQuery(
    {
      ...filters,
      where: '',
      checkIn: '',
      checkOut: '',
      adults: 0,
      children: 0,
      page: 1,
      pageSize: DEFAULT_PROPERTIES_QUERY.pageSize,
    },
    new URLSearchParams()
  );
  setCsvOrDelete(next, 'propertyType', parseCsvParam(written.get('type')));
  for (const key of [
    'minPrice',
    'maxPrice',
    'bedrooms',
    'amenities',
    'development',
    'sort',
  ] as const) {
    const value = written.get(key);
    if (value) next.set(key, value);
  }
  return next;
}

export function writeDevelopmentsFiltersToSearch(
  filters: DevelopmentsListingQuery,
  current: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of SEARCH_FILTER_KEYS) next.delete(key);

  const written = writeDevelopmentsQuery(
    {
      ...filters,
      where: '',
      page: 1,
      pageSize: DEFAULT_DEVELOPMENTS_QUERY.pageSize,
    },
    new URLSearchParams()
  );
  setCsvOrDelete(next, 'devType', parseCsvParam(written.get('type')));
  for (const key of ['city', 'developer', 'minPrice', 'maxPrice', 'sort'] as const) {
    const value = written.get(key);
    if (value) next.set(key, value);
  }
  return next;
}

export function writeParkingsFiltersToSearch(
  filters: ParkingsListingQuery,
  current: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of SEARCH_FILTER_KEYS) next.delete(key);

  const written = writeParkingsQuery(
    {
      ...filters,
      where: '',
      checkIn: '',
      checkOut: '',
      page: 1,
      pageSize: DEFAULT_PARKINGS_QUERY.pageSize,
    },
    new URLSearchParams()
  );
  for (const key of ['location', 'towers', 'minPrice', 'maxPrice', 'sort'] as const) {
    const value = written.get(key);
    if (value) next.set(key, value);
  }
  return next;
}
