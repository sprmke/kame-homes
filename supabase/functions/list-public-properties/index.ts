/**
 * list-public-properties — Public GET for /properties browse + /search property filters.
 * Auth: anon key (verify_jwt=false).
 * Query: where, type[], minPrice, maxPrice, bedrooms, amenities[], development[],
 *        checkIn, checkOut, adults, children, lat, lng, locationSlug, sort, page, pageSize,
 *        swLat, swLng, neLat, neLng (map viewport — capped markers, page ignored)
 *
 * Filtering, sorting, facets, and pagination run in Postgres (`search_public_properties`
 * over the trigger-maintained `public_listing_search` index); only the current page's
 * cards are loaded (`loadPropertyCards`). No catalog-size ceiling.
 *
 * `lat`/`lng` scope results to the Nearby radius so /search category tabs agree with the
 * All tab; with no explicit sort the page stays nearest-first.
 * Facets are disjunctive: type/price/bedrooms/development are counted with every *other*
 * filter applied (scoped to the visible bbox in map mode); amenities are AND-ed, so their
 * facet reflects the fully filtered set.
 * Availability (checkIn+checkOut) excludes non-cancelled bookings and owner blocks.
 */

import { parseRequestedRange } from '../_shared/availabilityService.ts';
import { jsonError, jsonResponse } from '../_shared/httpResponse.ts';
import { MAP_MARKER_CAP, readGeoOrigin, readMapBbox } from '../_shared/publicGeoScope.ts';
import { amenityLabelForId, propertyTypeLabel } from '../_shared/publicListingFacets.ts';
import { loadPropertyCards } from '../_shared/publicListingCards.ts';
import { listingCacheKey, withListingCache } from '../_shared/publicListingCache.ts';
import {
  parseBoundedCsv,
  parseNonNegInt,
  parseOptionalNumber,
  parsePage,
  parsePageSize,
  readQueryText,
  runPagedSearch,
  searchPublicProperties,
  type PropertySearchParams,
} from '../_shared/publicListingSearch.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

type SortKey = 'recommended' | 'rating' | 'reviews' | 'newest';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 48;
const VALID_SORTS = new Set<SortKey>(['recommended', 'rating', 'reviews', 'newest']);

function parseBedrooms(raw: string | null): number | null {
  if (raw == null || raw === '' || raw === 'Any') return null;
  if (raw === '5+') return 5;
  return parseOptionalNumber(raw);
}

servePublic('list-public-properties', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const limited = await publicGetRateLimitGate(req, 'list-public-properties');
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
  const range = parseRequestedRange(sp.get('checkIn'), sp.get('checkOut'));
  const mapMode = mapBbox != null;

  const base: Omit<PropertySearchParams, 'limit' | 'offset'> = {
    textMode: 'ilike',
    q: readQueryText(sp.get('where')),
    types: parseBoundedCsv(sp.get('type')).map((t) => t.toLowerCase()),
    minPrice: parseOptionalNumber(sp.get('minPrice')),
    maxPrice: parseOptionalNumber(sp.get('maxPrice')),
    bedrooms: parseBedrooms(sp.get('bedrooms')),
    amenities: parseBoundedCsv(sp.get('amenities')),
    developments: parseBoundedCsv(sp.get('development')).map((s) => s.toLowerCase()),
    guests: parseNonNegInt(sp.get('adults')) + parseNonNegInt(sp.get('children')),
    placeSlug: readQueryText(sp.get('locationSlug')).toLowerCase(),
    lat: origin?.lat ?? null,
    lng: origin?.lng ?? null,
    swLat: mapBbox?.swLat ?? null,
    swLng: mapBbox?.swLng ?? null,
    neLat: mapBbox?.neLat ?? null,
    neLng: mapBbox?.neLng ?? null,
    checkIn: range?.checkIn ?? null,
    checkOut: range?.checkOut ?? null,
    order: origin != null && !sortExplicit ? 'nearest' : sort,
    facets: true,
  };

  try {
    const body = await withListingCache(
      listingCacheKey('list-public-properties', { ...base, requestedPage, pageSize, mapMode }),
      { families: ['property'], bypass: range != null },
      async () => {
        const { result, page, pageSize: effectivePageSize } = await runPagedSearch(
          ({ limit, offset, facets }) =>
            searchPublicProperties({ ...base, limit, offset, facets }),
          { page: requestedPage, pageSize, mapMode, mapCap: MAP_MARKER_CAP }
        );

        const facets = result.facets;
        return {
          success: true,
          data: await loadPropertyCards(result.ids),
          total: result.total,
          facets: {
            types: (facets?.types ?? []).map((entry) => ({
              type: entry.value,
              label: propertyTypeLabel(entry.value),
              count: entry.count,
            })),
            price: facets?.price ?? { min: 0, max: 0 },
            bedrooms: facets?.bedrooms ?? [],
            amenities: (facets?.amenities ?? []).map((entry) => ({
              id: entry.id,
              label: amenityLabelForId(entry.id),
              count: entry.count,
            })),
            developments: facets?.developments ?? [],
          },
          page,
          pageSize: effectivePageSize,
          ...(mapMode ? { mapMode: true } : {}),
        };
      }
    );

    return jsonResponse(req, body, 200, range ? 'publicAvailability' : 'publicDynamic');
  } catch (error) {
    console.error('[list-public-properties]', error);
    return jsonError(req, 'Failed to list properties', 500);
  }
});
