/**
 * list-public-developments — Public GET for /developments browse + filters.
 * Auth: anon key (verify_jwt=false).
 * Query: where, type[], city[], developer[], minPrice, maxPrice, slug, locationSlug,
 *        lat, lng, sort, page, pageSize, swLat, swLng, neLat, neLng
 *
 * Filtering, sorting, facets, and pagination run in Postgres
 * (`search_public_developments` over `public_listing_search`); only the current page's
 * cards are loaded (`loadDevelopmentCards`, property counts for that page only).
 *
 * `lat`/`lng` scope results to the Nearby radius so the /search category tabs agree with
 * the All tab; with no explicit sort the page stays nearest-first.
 * Facets are disjunctive: each dimension is counted with every *other* filter applied
 * (scoped to the visible bbox in map mode). Price from settings priceRangeMin/Max.
 */

import { jsonError, jsonResponse } from '../_shared/httpResponse.ts';
import { MAP_MARKER_CAP, readGeoOrigin, readMapBbox } from '../_shared/publicGeoScope.ts';
import { loadDevelopmentCards } from '../_shared/publicListingCards.ts';
import { listingCacheKey, withListingCache } from '../_shared/publicListingCache.ts';
import {
  parseBoundedCsv,
  parseOptionalNumber,
  parsePage,
  parsePageSize,
  readQueryText,
  runPagedSearch,
  searchPublicDevelopments,
  type DevelopmentSearchParams,
} from '../_shared/publicListingSearch.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

type SortKey = 'recommended' | 'newest';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 48;
const VALID_SORTS = new Set<SortKey>(['recommended', 'newest']);

const DEVELOPMENT_TYPE_LABELS: Record<string, string> = {
  CONDOMINIUM: 'Condominium',
  SUBDIVISION: 'Subdivision',
  MIXED_USE: 'Mixed-Use',
  TOWNHOUSE: 'Townhouse',
  COMMERCIAL: 'Commercial',
};

function developmentTypeLabel(type: string): string {
  return DEVELOPMENT_TYPE_LABELS[type] ?? type;
}

servePublic('list-public-developments', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const limited = await publicGetRateLimitGate(req, 'list-public-developments');
  if (limited) return limited;

  const url = new URL(req.url);
  const sp = url.searchParams;
  const sortRaw = sp.get('sort');
  const sortExplicit = Boolean(sortRaw && VALID_SORTS.has(sortRaw as SortKey));
  const sort: SortKey = sortExplicit ? (sortRaw as SortKey) : 'recommended';
  const pageSize = parsePageSize(sp.get('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const requestedPage = parsePage(sp.get('page'));
  const origin = readGeoOrigin(sp);
  const mapBbox = readMapBbox(sp);
  const mapMode = mapBbox != null;

  const base: Omit<DevelopmentSearchParams, 'limit' | 'offset'> = {
    textMode: 'ilike',
    q: readQueryText(sp.get('where')),
    types: parseBoundedCsv(sp.get('type')).map((t) => t.toUpperCase()),
    cities: parseBoundedCsv(sp.get('city')),
    developers: parseBoundedCsv(sp.get('developer')),
    minPrice: parseOptionalNumber(sp.get('minPrice')),
    maxPrice: parseOptionalNumber(sp.get('maxPrice')),
    slug: readQueryText(sp.get('slug')).toLowerCase(),
    placeSlug: readQueryText(sp.get('locationSlug')).toLowerCase(),
    lat: origin?.lat ?? null,
    lng: origin?.lng ?? null,
    swLat: mapBbox?.swLat ?? null,
    swLng: mapBbox?.swLng ?? null,
    neLat: mapBbox?.neLat ?? null,
    neLng: mapBbox?.neLng ?? null,
    order: origin != null && !sortExplicit ? 'nearest' : sort,
    facets: true,
  };

  try {
    const body = await withListingCache(
      listingCacheKey('list-public-developments', { ...base, requestedPage, pageSize, mapMode }),
      // Cards carry property counts, so property changes invalidate too.
      { families: ['development', 'property'] },
      async () => {
        const {
          result,
          page,
          pageSize: effectivePageSize,
        } = await runPagedSearch(
          ({ limit, offset, facets }) =>
            searchPublicDevelopments({ ...base, limit, offset, facets }),
          { page: requestedPage, pageSize, mapMode, mapCap: MAP_MARKER_CAP }
        );
        const facets = result.facets;
        return {
          success: true,
          data: await loadDevelopmentCards(result.ids),
          total: result.total,
          facets: {
            types: (facets?.types ?? []).map((entry) => ({
              type: entry.value,
              label: developmentTypeLabel(entry.value),
              count: entry.count,
            })),
            cities: (facets?.cities ?? []).map((entry) => ({
              city: entry.value,
              count: entry.count,
            })),
            price: facets?.price ?? { min: 0, max: 0 },
            developers: (facets?.developers ?? []).map((entry) => ({
              name: entry.value,
              count: entry.count,
            })),
          },
          page,
          pageSize: effectivePageSize,
          ...(mapMode ? { mapMode: true } : {}),
        };
      }
    );

    return jsonResponse(req, body, 200, 'publicDynamic');
  } catch (error) {
    console.error('[list-public-developments]', error);
    return jsonError(req, 'Failed to list developments', 500);
  }
});
