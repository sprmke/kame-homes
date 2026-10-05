/**
 * list-public-parkings — Public GET for /parkings browse + filters.
 * Auth: anon key (verify_jwt=false).
 * Query: where, location[], towers[], minPrice, maxPrice, checkIn, checkOut, lat, lng,
 *        locationSlug, developmentSlug, sort, page, pageSize, swLat, swLng, neLat, neLng
 * Legacy: `type` param maps to location[] (inside_tower|outside_tower|motorcycle);
 * legacy `sort=price_*` values are accepted and ignored (tower ordering).
 *
 * Filtering, sorting, facets, and pagination run in Postgres (`search_public_parkings`
 * over `public_listing_search`); only the current page's cards are loaded.
 * `ratePerNight` is the charged rate (parking_settings weekday rate), matching the
 * detail page and checkout.
 *
 * `lat`/`lng` scope results to the Nearby radius. Availability (checkIn+checkOut)
 * excludes non-cancelled parking bookings and owner blocks.
 * Facets are disjunctive: location type, tower, and price are each counted with every
 * *other* filter applied (scoped to the visible bbox in map mode).
 */

import { parseRequestedRange } from '../_shared/availabilityService.ts';
import { jsonError, jsonResponse } from '../_shared/httpResponse.ts';
import { MAP_MARKER_CAP, readGeoOrigin, readMapBbox } from '../_shared/publicGeoScope.ts';
import { loadParkingCards } from '../_shared/publicListingCards.ts';
import { listingCacheKey, withListingCache } from '../_shared/publicListingCache.ts';
import {
  parseBoundedCsv,
  parseOptionalNumber,
  parsePage,
  parsePageSize,
  readQueryText,
  runPagedSearch,
  searchPublicParkings,
  type ParkingSearchParams,
} from '../_shared/publicListingSearch.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

type ParkingLocation = 'inside_tower' | 'outside_tower' | 'motorcycle';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 48;
const VALID_LOCATIONS = new Set<ParkingLocation>(['inside_tower', 'outside_tower', 'motorcycle']);

function parseLocations(sp: URLSearchParams): ParkingLocation[] {
  const fromLocation = parseBoundedCsv(sp.get('location'))
    .map((value) => value.toLowerCase())
    .filter((value): value is ParkingLocation => VALID_LOCATIONS.has(value as ParkingLocation));
  if (fromLocation.length > 0) return [...new Set(fromLocation)];

  const legacy = (sp.get('type') ?? '').trim().toLowerCase();
  return VALID_LOCATIONS.has(legacy as ParkingLocation) ? [legacy as ParkingLocation] : [];
}

servePublic('list-public-parkings', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const limited = await publicGetRateLimitGate(req, 'list-public-parkings');
  if (limited) return limited;

  const url = new URL(req.url);
  const sp = url.searchParams;
  const pageSize = parsePageSize(sp.get('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const requestedPage = parsePage(sp.get('page'));
  const origin = readGeoOrigin(sp);
  const mapBbox = readMapBbox(sp);
  const range = parseRequestedRange(sp.get('checkIn'), sp.get('checkOut'));
  const mapMode = mapBbox != null;

  const base: Omit<ParkingSearchParams, 'limit' | 'offset'> = {
    textMode: 'ilike',
    q: readQueryText(sp.get('where')),
    locations: parseLocations(sp),
    towers: parseBoundedCsv(sp.get('towers')),
    minPrice: parseOptionalNumber(sp.get('minPrice')),
    maxPrice: parseOptionalNumber(sp.get('maxPrice')),
    developmentSlug: readQueryText(sp.get('developmentSlug')).toLowerCase(),
    placeSlug: readQueryText(sp.get('locationSlug')).toLowerCase(),
    lat: origin?.lat ?? null,
    lng: origin?.lng ?? null,
    swLat: mapBbox?.swLat ?? null,
    swLng: mapBbox?.swLng ?? null,
    neLat: mapBbox?.neLat ?? null,
    neLng: mapBbox?.neLng ?? null,
    checkIn: range?.checkIn ?? null,
    checkOut: range?.checkOut ?? null,
    order: 'tower',
    facets: true,
  };

  try {
    const body = await withListingCache(
      listingCacheKey('list-public-parkings', { ...base, requestedPage, pageSize, mapMode }),
      { families: ['parking'], bypass: range != null },
      async () => {
        const {
          result,
          page,
          pageSize: effectivePageSize,
        } = await runPagedSearch(
          ({ limit, offset, facets }) => searchPublicParkings({ ...base, limit, offset, facets }),
          { page: requestedPage, pageSize, mapMode, mapCap: MAP_MARKER_CAP }
        );
        const facets = result.facets;
        return {
          success: true,
          data: await loadParkingCards(result.ids),
          total: result.total,
          facets: {
            locations: (facets?.locations ?? []).map((entry) => ({
              location: entry.value as ParkingLocation,
              count: entry.count,
            })),
            towers: (facets?.towers ?? []).map((entry) => ({
              tower: entry.value,
              count: entry.count,
            })),
            price: facets?.price ?? { min: 0, max: 0 },
          },
          page,
          pageSize: effectivePageSize,
          ...(mapMode ? { mapMode: true } : {}),
        };
      }
    );

    return jsonResponse(req, body, 200, range ? 'publicAvailability' : 'publicDynamic');
  } catch (error) {
    console.error('[list-public-parkings]', error);
    return jsonError(req, 'Failed to list parkings', 500);
  }
});
