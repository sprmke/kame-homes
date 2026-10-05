/**
 * search-listings — Public GET for /search results page.
 * Auth: anon key (verify_jwt=false).
 * Query: where, checkIn, checkOut, adults, children, infants, pets,
 *        type(all|properties|developments|parkings), page, pageSize, lat, lng
 *
 * Smart intents: Nearby (geo), concept (condo/beach/…), literal text, expanded fallback.
 * Candidates, ranking, totals, and paging run in Postgres via the same `search_public_*`
 * RPCs as the browse endpoints; only page rows are mapped to summaries.
 * Availability: properties/parkings exclude booking + owner-block conflicts.
 * Developments are catalog-only (date-agnostic). Guest capacity applies to properties only.
 */

import { parseRequestedRange } from '../_shared/availabilityService.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import {
  type DevelopmentSearchSummary,
  type ParkingSearchSummary,
  type PropertySearchSummary,
} from '../_shared/publicSearch.ts';
import {
  findConceptFallback,
  NEARBY_DEFAULT_RADIUS_KM,
  nearbyCategoryFromQuery,
  resolveSearchIntent,
  type ResolvedSearchIntent,
} from '../_shared/searchIntents.ts';
import {
  loadDevelopmentSearchSummaries,
  loadParkingSearchSummaries,
  loadPropertySearchSummaries,
} from '../_shared/publicListingCards.ts';
import {
  readQueryText,
  searchPublicDevelopments,
  searchPublicParkings,
  searchPublicProperties,
  windowedPage,
} from '../_shared/publicListingSearch.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';

type SearchType = 'all' | 'properties' | 'developments' | 'parkings';

type MetaIntent = 'nearby' | 'concept' | 'literal' | 'expanded';

type ActiveSearch =
  | { mode: 'browse' }
  | { mode: 'literal'; query: string }
  | {
      mode: 'concept';
      expandedTerms: string[];
      propertyTypes: string[];
      conceptId: string;
      label: string;
    }
  | { mode: 'nearby'; lat: number; lng: number; label: string };

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;

function parseNonNegInt(raw: string | null, fallback = 0): number {
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parsePage(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parsePageSize(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
}

function parseType(raw: string | null): SearchType {
  if (raw === 'properties' || raw === 'developments' || raw === 'parkings') return raw;
  return 'all';
}

function parseCoord(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function buildActiveSearch(intent: ResolvedSearchIntent, lat: number, lng: number): ActiveSearch {
  if (intent.kind === 'nearby') {
    return { mode: 'nearby', lat, lng, label: intent.label };
  }
  if (intent.kind === 'concept') {
    return {
      mode: 'concept',
      expandedTerms: intent.expandedTerms,
      propertyTypes: intent.propertyTypes,
      conceptId: intent.conceptId,
      label: intent.label,
    };
  }
  if (!intent.query) return { mode: 'browse' };
  return { mode: 'literal', query: intent.query };
}

servePublic('search-listings', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }

  const limited = await publicGetRateLimitGate(req, 'search-listings');
  if (limited) return limited;

  const url = new URL(req.url);
  const where = readQueryText(url.searchParams.get('where') ?? url.searchParams.get('location'));
  const checkIn = url.searchParams.get('checkIn');
  const checkOut = url.searchParams.get('checkOut');
  const adults = parseNonNegInt(url.searchParams.get('adults'), 0);
  const children = parseNonNegInt(url.searchParams.get('children'), 0);
  const infants = parseNonNegInt(url.searchParams.get('infants'), 0);
  const pets = parseNonNegInt(url.searchParams.get('pets'), 0);
  const requestedType = parseType(url.searchParams.get('type'));
  const nearbyCategory = nearbyCategoryFromQuery(where);
  // Treat "Nearby <category>" as a real server-side constraint, not merely a
  // UI hint. Explicit `type` remains authoritative for API consumers.
  const type = !url.searchParams.has('type') && nearbyCategory ? nearbyCategory : requestedType;
  const page = parsePage(url.searchParams.get('page'));
  const pageSize = parsePageSize(url.searchParams.get('pageSize'));
  const lat = parseCoord(url.searchParams.get('lat'));
  const lng = parseCoord(url.searchParams.get('lng'));
  const effectivePage = type === 'all' ? 1 : windowedPage(page, pageSize);

  const range = parseRequestedRange(checkIn, checkOut);
  if ((checkIn || checkOut) && !range) {
    return jsonError(
      req,
      'checkIn and checkOut must be valid YYYY-MM-DD with checkIn < checkOut',
      400
    );
  }

  const resolvedIntent = resolveSearchIntent(where);
  const needsLocation = resolvedIntent.kind === 'nearby' && (lat == null || lng == null);

  const queryPayload = {
    where,
    checkIn: range?.checkIn ?? checkIn ?? null,
    checkOut: range?.checkOut ?? checkOut ?? null,
    adults,
    children,
    infants,
    pets,
    type,
    page: effectivePage,
    pageSize,
    lat,
    lng,
  };

  if (needsLocation) {
    return jsonSuccess(
      req,
      {
        query: queryPayload,
        totals: { properties: 0, developments: 0, parkings: 0, all: 0 },
        properties: [] as PropertySearchSummary[],
        developments: [] as DevelopmentSearchSummary[],
        parkings: [] as ParkingSearchSummary[],
        meta: {
          intent: 'nearby' as const,
          intentLabel: resolvedIntent.kind === 'nearby' ? resolvedIntent.label : null,
          needsLocation: true,
          usedSmartFallback: false,
          conceptId: null,
        },
      },
      undefined,
      'publicDynamic'
    );
  }

  async function runListings(activeSearch: ActiveSearch): Promise<{
    properties: PropertySearchSummary[];
    developments: DevelopmentSearchSummary[];
    parkings: ParkingSearchSummary[];
    propertyTotal: number;
    developmentTotal: number;
    parkingTotal: number;
  }> {
    const wantProperties = type === 'all' || type === 'properties';
    const wantDevelopments = type === 'all' || type === 'developments';
    const wantParkings = type === 'all' || type === 'parkings';
    const limit = pageSize;
    const offset = (effectivePage - 1) * pageSize;

    // Same index + RPCs as the browse endpoints; the search intent picks the text mode
    // and ordering (rank for literal/concept, distance for Nearby, name for browse).
    const textParams =
      activeSearch.mode === 'literal'
        ? { textMode: 'literal' as const, q: activeSearch.query, order: 'rank' as const }
        : activeSearch.mode === 'concept'
          ? { textMode: 'concept' as const, terms: activeSearch.expandedTerms, order: 'rank' as const }
          : activeSearch.mode === 'nearby'
            ? {
                textMode: 'none' as const,
                lat: activeSearch.lat,
                lng: activeSearch.lng,
                radiusKm: NEARBY_DEFAULT_RADIUS_KM,
                order: 'nearest' as const,
              }
            : { textMode: 'none' as const, order: 'name' as const };
    const conceptTypes = activeSearch.mode === 'concept' ? activeSearch.propertyTypes : [];

    const [propertyResult, developmentResult, parkingResult] = await Promise.all([
      wantProperties
        ? searchPublicProperties({
            ...textParams,
            conceptTypes,
            guests: adults + children,
            checkIn: range?.checkIn ?? null,
            checkOut: range?.checkOut ?? null,
            limit,
            offset,
          })
        : null,
      wantDevelopments
        ? searchPublicDevelopments({ ...textParams, conceptTypes, limit, offset })
        : null,
      wantParkings
        ? searchPublicParkings({
            ...textParams,
            checkIn: range?.checkIn ?? null,
            checkOut: range?.checkOut ?? null,
            limit,
            offset,
          })
        : null,
    ]);

    const [properties, developments, parkings] = await Promise.all([
      loadPropertySearchSummaries(propertyResult?.ids ?? []),
      loadDevelopmentSearchSummaries(developmentResult?.ids ?? []),
      loadParkingSearchSummaries(parkingResult?.ids ?? []),
    ]);

    return {
      properties,
      developments,
      parkings,
      propertyTotal: propertyResult?.total ?? 0,
      developmentTotal: developmentResult?.total ?? 0,
      parkingTotal: parkingResult?.total ?? 0,
    };
  }

  let activeSearch = buildActiveSearch(resolvedIntent, lat ?? 0, lng ?? 0);
  let responseIntent: MetaIntent =
    resolvedIntent.kind === 'nearby'
      ? 'nearby'
      : resolvedIntent.kind === 'concept'
        ? 'concept'
        : 'literal';
  let usedSmartFallback = false;
  let fallbackConceptId: string | null = null;
  let fallbackLabel: string | null = null;

  try {
    let result = await runListings(activeSearch);
    let propertyTotal = result.propertyTotal;
    let developmentTotal = result.developmentTotal;
    let parkingTotal = result.parkingTotal;
    let allTotal = propertyTotal + developmentTotal + parkingTotal;

    if (activeSearch.mode === 'literal' && activeSearch.query && allTotal === 0) {
      const fallback = findConceptFallback(where);
      if (fallback?.kind === 'concept') {
        activeSearch = {
          mode: 'concept',
          expandedTerms: fallback.expandedTerms,
          propertyTypes: fallback.propertyTypes,
          conceptId: fallback.conceptId,
          label: fallback.label,
        };
        usedSmartFallback = true;
        responseIntent = 'expanded';
        fallbackConceptId = fallback.conceptId;
        fallbackLabel = fallback.label;
        result = await runListings(activeSearch);
        propertyTotal = result.propertyTotal;
        developmentTotal = result.developmentTotal;
        parkingTotal = result.parkingTotal;
        allTotal = propertyTotal + developmentTotal + parkingTotal;
      }
    }

    const meta = {
      intent: responseIntent,
      intentLabel:
        resolvedIntent.kind === 'nearby'
          ? resolvedIntent.label
          : resolvedIntent.kind === 'concept'
            ? resolvedIntent.label
            : usedSmartFallback
              ? fallbackLabel
              : null,
      needsLocation: false,
      usedSmartFallback,
      conceptId:
        resolvedIntent.kind === 'concept'
          ? resolvedIntent.conceptId
          : usedSmartFallback
            ? fallbackConceptId
            : null,
    };

    return jsonSuccess(
      req,
      {
        query: queryPayload,
        totals: {
          properties: propertyTotal,
          developments: developmentTotal,
          parkings: parkingTotal,
          all: allTotal,
        },
        properties: result.properties,
        developments: result.developments,
        parkings: result.parkings,
        meta,
      },
      undefined,
      'publicDynamic'
    );
  } catch {
    return jsonError(req, 'Failed to search listings', 500);
  }
});
