import { isParkingLocationFilterParam } from '@/features/guest/marketing/parkings/lib/parkingsQuery';
import { nearbyCategoryFromQuery } from '@/features/guest/search/lib/searchIntents';
import type { SearchListingsQuery, SearchListingsType } from '@/features/guest/search/types/search';

export const DEFAULT_SEARCH_QUERY: SearchListingsQuery = {
  where: '',
  checkIn: '',
  checkOut: '',
  adults: 0,
  children: 0,
  infants: 0,
  pets: 0,
  type: 'all',
  page: 1,
  pageSize: 12,
  lat: null,
  lng: null,
  focus: null,
};

const VALID_TYPES = new Set<SearchListingsType>(['all', 'properties', 'developments', 'parkings']);
const VALID_FOCUS = new Set<Exclude<SearchListingsType, 'all'>>([
  'properties',
  'developments',
  'parkings',
]);

function parseNonNegInt(raw: string | null, fallback = 0): number {
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parsePage(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parseType(raw: string | null): SearchListingsType {
  if (raw && VALID_TYPES.has(raw as SearchListingsType)) return raw as SearchListingsType;
  return 'all';
}

function parseFocus(raw: string | null): SearchListingsQuery['focus'] {
  if (raw && VALID_FOCUS.has(raw as Exclude<SearchListingsType, 'all'>)) {
    return raw as Exclude<SearchListingsType, 'all'>;
  }
  return null;
}

function parseCoord(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse `/search` URL params.
 * Uses adults/children/pets — distinct from `/properties`' collapsed `guests` contract.
 * Accepts legacy `location` as an alias for `where` (except parking slot-type filters in `location`).
 * Optional `lat`/`lng` power Nearby geo ranking.
 * Optional `focus` prioritizes a category from the origin listing page.
 * Legacy `infants` is accepted for old URLs but always stored/written as 0 (not offered in UI).
 */
export function parseSearchParams(sp: URLSearchParams): SearchListingsQuery {
  const whereRaw = (sp.get('where') ?? '').trim();
  const legacyLocation = (sp.get('location') ?? '').trim();
  const where =
    whereRaw ||
    (legacyLocation && !isParkingLocationFilterParam(legacyLocation) ? legacyLocation : '');
  const nearbyCategory = nearbyCategoryFromQuery(where);
  const explicitType = parseType(sp.get('type'));

  return {
    where,
    checkIn: (sp.get('checkIn') ?? '').trim(),
    checkOut: (sp.get('checkOut') ?? '').trim(),
    adults: parseNonNegInt(sp.get('adults')),
    children: parseNonNegInt(sp.get('children')),
    infants: 0,
    pets: parseNonNegInt(sp.get('pets')),
    // The phrase itself is a valid category constraint. This keeps pasted or
    // hand-authored `?where=Nearby properties` links scoped even when `type`
    // was omitted, while an explicit type continues to win.
    type: !sp.has('type') && nearbyCategory ? nearbyCategory : explicitType,
    page: parsePage(sp.get('page')),
    pageSize: Math.min(Math.max(parseNonNegInt(sp.get('pageSize'), 12), 1), 48),
    lat: parseCoord(sp.get('lat')),
    lng: parseCoord(sp.get('lng')),
    focus: parseFocus(sp.get('focus')) ?? nearbyCategory,
  };
}

/** Write search query to URLSearchParams; omit defaults for clean shareable URLs. */
export function writeSearchParams(
  query: SearchListingsQuery,
  current?: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(current ?? undefined);
  const keys = [
    'where',
    'location',
    'checkIn',
    'checkOut',
    'adults',
    'children',
    'infants',
    'pets',
    'type',
    'page',
    'pageSize',
    'guests',
    'lat',
    'lng',
    'focus',
  ] as const;
  for (const key of keys) next.delete(key);

  if (query.where) next.set('where', query.where);
  if (query.checkIn) next.set('checkIn', query.checkIn);
  if (query.checkOut) next.set('checkOut', query.checkOut);
  if (query.adults > 0) next.set('adults', String(query.adults));
  if (query.children > 0) next.set('children', String(query.children));
  // infants omitted from public search URLs — not offered in the Who picker
  if (query.pets > 0) next.set('pets', String(query.pets));
  if (query.type !== 'all') next.set('type', query.type);
  if (query.page > 1) next.set('page', String(query.page));
  if (query.pageSize !== DEFAULT_SEARCH_QUERY.pageSize) {
    next.set('pageSize', String(query.pageSize));
  }
  if (query.lat != null && query.lng != null) {
    next.set('lat', String(query.lat));
    next.set('lng', String(query.lng));
  }
  if (query.focus) next.set('focus', query.focus);

  return next;
}

/** Build `/search?...` from HeroSearch guest breakdown (not collapsed guests). */
export function buildSearchHref(input: {
  where?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  infants?: number;
  pets?: number;
  type?: SearchListingsType;
  lat?: number | null;
  lng?: number | null;
  focus?: SearchListingsQuery['focus'];
}): string {
  const params = writeSearchParams({
    ...DEFAULT_SEARCH_QUERY,
    where: input.where?.trim() ?? '',
    checkIn: input.checkIn?.trim() ?? '',
    checkOut: input.checkOut?.trim() ?? '',
    adults: input.adults ?? 0,
    children: input.children ?? 0,
    infants: input.infants ?? 0,
    pets: input.pets ?? 0,
    type: input.type ?? 'all',
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    focus: input.focus ?? null,
  });
  const qs = params.toString();
  return qs ? `/search?${qs}` : '/search';
}
