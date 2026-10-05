/**
 * list-public-place-groups — Public GET for bounded location rows on listing indexes.
 * Auth: anon key (verify_jwt=false).
 * Query: family=properties|developments|parkings, groupOffset, groupLimit, previewSize.
 *
 * Groups come from `public_listing_place_groups` (Postgres GROUP BY over the
 * `public_listing_search` index): ordered by size then place, previews newest first.
 * Only the preview ids of the requested group window are turned into cards, with the
 * same loaders as the list endpoints, so a preview card matches its grid card exactly.
 * Callers append later windows with "Show more places".
 */

import { jsonError, jsonResponse } from '../_shared/httpResponse.ts';
import {
  loadDevelopmentCards,
  loadParkingCards,
  loadPropertyCards,
} from '../_shared/publicListingCards.ts';
import { listingCacheKey, withListingCache } from '../_shared/publicListingCache.ts';
import { loadPublicPlaceGroups, type ListingFamily } from '../_shared/publicListingSearch.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

type RouteFamily = 'properties' | 'developments' | 'parkings';

const DEFAULT_GROUP_LIMIT = 6;
const MAX_GROUP_LIMIT = 12;
const DEFAULT_PREVIEW_SIZE = 8;
const MAX_PREVIEW_SIZE = 12;
/** Deepest group window offset accepted (stops unbounded offset scans). */
const MAX_GROUP_OFFSET = 5_000;

const INDEX_FAMILY: Record<RouteFamily, ListingFamily> = {
  properties: 'property',
  developments: 'development',
  parkings: 'parking',
};

function parseBoundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function titleForFamily(family: RouteFamily, place: string): string {
  if (family === 'properties') return `Homes in ${place}`;
  if (family === 'developments') return `Developments in ${place}`;
  return `Parking in ${place}`;
}

function loadCards(family: RouteFamily, ids: string[]): Promise<Array<{ id: string }>> {
  if (family === 'properties') return loadPropertyCards(ids);
  if (family === 'developments') return loadDevelopmentCards(ids);
  return loadParkingCards(ids);
}

servePublic('list-public-place-groups', async (req) => {
  if (req.method !== 'GET') return jsonError(req, 'Method not allowed', 405);

  const limited = await publicGetRateLimitGate(req, 'list-public-place-groups');
  if (limited) return limited;
  const url = new URL(req.url);
  const family = url.searchParams.get('family') as RouteFamily | null;
  if (family !== 'properties' && family !== 'developments' && family !== 'parkings') {
    return jsonError(req, 'Invalid listing family', 400);
  }

  const groupOffset = parseBoundedInt(url.searchParams.get('groupOffset'), 0, 0, MAX_GROUP_OFFSET);
  const groupLimit = parseBoundedInt(
    url.searchParams.get('groupLimit'),
    DEFAULT_GROUP_LIMIT,
    1,
    MAX_GROUP_LIMIT
  );
  const previewSize = parseBoundedInt(
    url.searchParams.get('previewSize'),
    DEFAULT_PREVIEW_SIZE,
    1,
    MAX_PREVIEW_SIZE
  );
  const indexFamily = INDEX_FAMILY[family];

  try {
    const body = await withListingCache(
      listingCacheKey('list-public-place-groups', { family, groupOffset, groupLimit, previewSize }),
      {
        families: indexFamily === 'development' ? ['development', 'property'] : [indexFamily],
      },
      async () => {
        const result = await loadPublicPlaceGroups(
          indexFamily,
          groupOffset,
          groupLimit,
          previewSize
        );
        const previewIds = result.groups.flatMap((group) => group.ids);
        const cards = await loadCards(family, previewIds);
        const cardById = new Map(cards.map((card) => [card.id, card]));

        return {
          success: true,
          groups: result.groups.map((group) => ({
            place: group.place,
            locationSlug: group.locationSlug,
            title: titleForFamily(family, group.place),
            total: group.total,
            preview: group.ids
              .map((id) => cardById.get(id))
              .filter((card): card is { id: string } => card != null),
          })),
          total: result.total,
          groupTotal: result.groupTotal,
          groupOffset,
          groupLimit,
          previewSize,
        };
      }
    );

    return jsonResponse(req, body, 200, 'publicDynamic');
  } catch (error) {
    console.error('[list-public-place-groups]', error);
    return jsonError(req, 'Failed to list places', 500);
  }
});
