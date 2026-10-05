/**
 * Typed access to the public listing search index (migration
 * 20261316126800_public_listing_search_index.sql).
 *
 * `search_public_*` RPCs filter, sort, facet, and paginate in Postgres and return
 * `{ total, ids, facets, distances }` for one page; callers then load card payloads for
 * those ids only (`publicListingCards.ts` / `publicSearch.ts` mappers).
 *
 * Request parsing lives here too so every public endpoint applies the same bounds:
 * query text length, CSV list size, page size, and a maximum result window that stops
 * deep-offset scraping.
 */

import { createServiceClient } from './orgAuth.ts';

export type ListingFamily = 'property' | 'development' | 'parking';

/** Max characters kept from free-text `where` / `q` params. */
export const MAX_QUERY_LENGTH = 120;
/** Max values kept from CSV filter params (types, amenities, towers, …). */
export const MAX_LIST_ITEMS = 30;
/** Max characters per CSV value. */
export const MAX_LIST_ITEM_LENGTH = 80;
/** page × pageSize ceiling — deeper pages clamp to the last reachable page. */
export const MAX_RESULT_WINDOW = 10_000;

export type SearchTextMode = 'none' | 'ilike' | 'literal' | 'concept';

type CommonSearchParams = {
  textMode?: SearchTextMode;
  q?: string;
  terms?: string[];
  placeSlug?: string;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number;
  swLat?: number | null;
  swLng?: number | null;
  neLat?: number | null;
  neLng?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  limit: number;
  offset: number;
  facets?: boolean;
};

export type PropertySearchParams = CommonSearchParams & {
  conceptTypes?: string[];
  types?: string[];
  amenities?: string[];
  developments?: string[];
  bedrooms?: number | null;
  guests?: number;
  checkIn?: string | null;
  checkOut?: string | null;
  order: 'recommended' | 'rating' | 'reviews' | 'newest' | 'nearest' | 'rank' | 'name';
};

export type DevelopmentSearchParams = CommonSearchParams & {
  conceptTypes?: string[];
  types?: string[];
  cities?: string[];
  developers?: string[];
  slug?: string;
  order: 'recommended' | 'newest' | 'nearest' | 'rank' | 'name';
};

export type ParkingSearchParams = CommonSearchParams & {
  locations?: string[];
  towers?: string[];
  developmentSlug?: string;
  checkIn?: string | null;
  checkOut?: string | null;
  order: 'tower' | 'nearest' | 'rank' | 'name';
};

export type CountFacetRow = { value: string; count: number };

export type PropertySearchFacets = {
  types: CountFacetRow[];
  price: { min: number; max: number };
  bedrooms: Array<{ value: number; count: number }>;
  amenities: Array<{ id: string; count: number }>;
  developments: Array<{ slug: string; name: string; count: number }>;
};

export type DevelopmentSearchFacets = {
  types: CountFacetRow[];
  cities: CountFacetRow[];
  price: { min: number; max: number };
  developers: CountFacetRow[];
};

export type ParkingSearchFacets = {
  locations: CountFacetRow[];
  towers: CountFacetRow[];
  price: { min: number; max: number };
};

export type SearchResult<F> = {
  total: number;
  ids: string[];
  facets: F | null;
  /** id → km from the origin (only when lat/lng were sent). */
  distances: Record<string, number> | null;
};

const RPC_BY_FAMILY: Record<ListingFamily, string> = {
  property: 'search_public_properties',
  development: 'search_public_developments',
  parking: 'search_public_parkings',
};

/** Drop undefined / null / empty-array keys so the RPC sees only active filters. */
function compactParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    out[key] = value;
  }
  return out;
}

async function callSearch<F>(
  family: ListingFamily,
  params: Record<string, unknown>
): Promise<SearchResult<F>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc(RPC_BY_FAMILY[family], { p: compactParams(params) });
  if (error) {
    throw new Error(`${RPC_BY_FAMILY[family]} failed: ${error.message}`);
  }
  const body = (data ?? {}) as {
    total?: number;
    ids?: string[];
    facets?: F | null;
    distances?: Record<string, number> | null;
  };
  return {
    total: Number(body.total ?? 0),
    ids: Array.isArray(body.ids) ? body.ids : [],
    facets: body.facets ?? null,
    distances: body.distances ?? null,
  };
}

export function searchPublicProperties(
  params: PropertySearchParams
): Promise<SearchResult<PropertySearchFacets>> {
  return callSearch('property', params);
}

export function searchPublicDevelopments(
  params: DevelopmentSearchParams
): Promise<SearchResult<DevelopmentSearchFacets>> {
  return callSearch('development', params);
}

export function searchPublicParkings(
  params: ParkingSearchParams
): Promise<SearchResult<ParkingSearchFacets>> {
  return callSearch('parking', params);
}

export type PlaceGroupsResult = {
  total: number;
  groupTotal: number;
  groups: Array<{ place: string; locationSlug: string; total: number; ids: string[] }>;
};

export async function loadPublicPlaceGroups(
  family: ListingFamily,
  groupOffset: number,
  groupLimit: number,
  previewSize: number
): Promise<PlaceGroupsResult> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('public_listing_place_groups', {
    p_family: family,
    p_group_offset: groupOffset,
    p_group_limit: groupLimit,
    p_preview_size: previewSize,
  });
  if (error) throw new Error(`public_listing_place_groups failed: ${error.message}`);
  const body = (data ?? {}) as Partial<PlaceGroupsResult>;
  return {
    total: Number(body.total ?? 0),
    groupTotal: Number(body.groupTotal ?? 0),
    groups: Array.isArray(body.groups) ? body.groups : [],
  };
}

// ---------------------------------------------------------------------------
// Request parsing (shared bounds)
// ---------------------------------------------------------------------------

export function readQueryText(raw: string | null): string {
  return (raw ?? '').trim().slice(0, MAX_QUERY_LENGTH).trim();
}

export function parseBoundedCsv(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const part of raw.split(',')) {
    const value = part.trim().slice(0, MAX_LIST_ITEM_LENGTH);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
    if (values.length >= MAX_LIST_ITEMS) break;
  }
  return values;
}

export function parseNonNegInt(raw: string | null, fallback = 0, max = 1_000): number {
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : fallback;
}

export function parsePage(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function parsePageSize(raw: string | null, fallback: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

export function parseOptionalNumber(raw: string | null): number | null {
  if (raw == null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Last page reachable inside both the result set and MAX_RESULT_WINDOW. */
export function clampPage(page: number, pageSize: number, total: number): number {
  const lastByTotal = Math.max(1, Math.ceil(total / pageSize) || 1);
  const lastByWindow = Math.max(1, Math.floor(MAX_RESULT_WINDOW / pageSize));
  return Math.min(Math.max(page, 1), lastByTotal, lastByWindow);
}

/** Requested page clamped to the result window before the total is known. */
export function windowedPage(page: number, pageSize: number): number {
  return Math.min(Math.max(page, 1), Math.max(1, Math.floor(MAX_RESULT_WINDOW / pageSize)));
}

export type PagedSearch<F> = {
  result: SearchResult<F>;
  page: number;
  pageSize: number;
};

/**
 * Runs one page of a search. Map mode returns up to `mapCap` markers on page 1.
 * A page past the end clamps to the last reachable page (facets from the first call).
 */
export async function runPagedSearch<F>(
  run: (args: { limit: number; offset: number; facets: boolean }) => Promise<SearchResult<F>>,
  options: { page: number; pageSize: number; mapMode: boolean; mapCap: number }
): Promise<PagedSearch<F>> {
  const { pageSize, mapMode, mapCap } = options;
  if (mapMode) {
    return { result: await run({ limit: mapCap, offset: 0, facets: true }), page: 1, pageSize: mapCap };
  }

  const page = windowedPage(options.page, pageSize);
  const first = await run({ limit: pageSize, offset: (page - 1) * pageSize, facets: true });
  if (first.ids.length > 0 || first.total === 0) return { result: first, page, pageSize };

  const lastPage = clampPage(page, pageSize, first.total);
  if (lastPage === page) return { result: first, page, pageSize };
  const last = await run({ limit: pageSize, offset: (lastPage - 1) * pageSize, facets: false });
  return { result: { ...last, facets: first.facets }, page: lastPage, pageSize };
}
