/**
 * search-listings — Public GET for /search results page.
 * Auth: anon key (verify_jwt=false).
 * Query: where, checkIn, checkOut, adults, children, infants, pets,
 *        type(all|properties|developments|parkings), page, pageSize, lat, lng
 *
 * Smart intents: Nearby (geo), concept (condo/beach/…), literal text, expanded fallback.
 * Availability: properties/parkings exclude booking (+ property block) conflicts.
 * Developments are catalog-only (date-agnostic). Guest capacity applies to properties only.
 */

import {
  loadConflictingParkingIds,
  loadConflictingPropertyIds,
  parseRequestedRange,
} from '../_shared/availabilityService.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  AZURE_NORTH_DEFAULT_COORDS,
  isAzureNorthResidence,
} from '../_shared/propertyLocationDefaults.ts';
import {
  postgrestOrIlikeValue,
  mapDevelopmentSearchSummary,
  mapParkingSearchSummary,
  mapPropertySearchSummary,
  propertyFitsGuestCapacity,
  rankTextMatch,
  type DevelopmentSearchSummary,
  type ParkingSearchSummary,
  type PropertySearchSummary,
} from '../_shared/publicSearch.ts';
import {
  findConceptFallback,
  haversineKm,
  NEARBY_DEFAULT_RADIUS_KM,
  nearbyCategoryFromQuery,
  readSettingsCoord,
  resolveSearchIntent,
  type ResolvedSearchIntent,
} from '../_shared/searchIntents.ts';
import { loadPublicListingRows } from '../_shared/publicListingRows.ts';
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

function asSettingsRecord(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === 'object' && !Array.isArray(settings)
    ? (settings as Record<string, unknown>)
    : {};
}

function readAmenities(settings: unknown): string[] {
  const record = asSettingsRecord(settings);
  const value = record.enabledAmenities;
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
}

function matchesExpandedTerms(
  terms: string[],
  ...fields: Array<string | null | undefined>
): boolean {
  return terms.some((term) => rankTextMatch(term, ...fields) > 0);
}

function matchesPropertyType(rowType: string | null | undefined, allowedTypes: string[]): boolean {
  if (allowedTypes.length === 0) return false;
  const upper = (rowType ?? '').trim().toUpperCase();
  return allowedTypes.some((type) => type.toUpperCase() === upper);
}

function resolveRowCoords(
  settings: unknown,
  residenceName: string | null | undefined
): { lat: number; lng: number } | null {
  const record = asSettingsRecord(settings);
  const lat = readSettingsCoord(record, 'latitude');
  const lng = readSettingsCoord(record, 'longitude');
  if (lat != null && lng != null) return { lat, lng };
  if (residenceName && isAzureNorthResidence(residenceName)) {
    return {
      lat: AZURE_NORTH_DEFAULT_COORDS.latitude,
      lng: AZURE_NORTH_DEFAULT_COORDS.longitude,
    };
  }
  return null;
}

function matchesWhere(query: string, ...fields: Array<string | null | undefined>): boolean {
  if (!query) return true;
  return rankTextMatch(query, ...fields) > 0;
}

function matchesConceptProperty(
  row: {
    type: string;
    name: string;
    city: string | null;
    residence_name: string | null;
    settings: unknown;
  },
  expandedTerms: string[],
  propertyTypes: string[]
): boolean {
  if (matchesPropertyType(row.type, propertyTypes)) return true;
  const amenities = readAmenities(row.settings);
  return matchesExpandedTerms(expandedTerms, row.name, row.city, row.residence_name, ...amenities);
}

function matchesConceptDevelopment(
  row: {
    type: string;
    name: string;
    city: string | null;
    location: string | null;
  },
  expandedTerms: string[],
  propertyTypes: string[]
): boolean {
  if (matchesPropertyType(row.type, propertyTypes)) return true;
  return matchesExpandedTerms(expandedTerms, row.name, row.city, row.location);
}

function matchesConceptParking(
  row: {
    name: string;
    residence_name: string | null;
    tower: string | null;
    settings: unknown;
  },
  expandedTerms: string[],
  propertyTypes: string[]
): boolean {
  const settings = asSettingsRecord(row.settings);
  const city = typeof settings.city === 'string' ? settings.city : '';
  if (
    matchesPropertyType(
      typeof settings.parkingType === 'string' ? settings.parkingType : null,
      propertyTypes
    )
  ) {
    return true;
  }
  return matchesExpandedTerms(expandedTerms, row.name, row.residence_name, row.tower, city);
}

function conceptRankScore(
  expandedTerms: string[],
  ...fields: Array<string | null | undefined>
): number {
  let best = 0;
  for (const term of expandedTerms) {
    best = Math.max(best, rankTextMatch(term, ...fields));
  }
  return best;
}

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
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
  const where = (url.searchParams.get('where') ?? url.searchParams.get('location') ?? '').trim();
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
  const effectivePage = type === 'all' ? 1 : page;

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
    return jsonSuccess(req, {
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
    });
  }

  async function runListings(activeSearch: ActiveSearch): Promise<{
    properties: PropertySearchSummary[];
    developments: DevelopmentSearchSummary[];
    parkings: ParkingSearchSummary[];
    propertyTotal: number;
    developmentTotal: number;
    parkingTotal: number;
  }> {
    const supabase = createServiceClient();
    const useDbTextFilter = activeSearch.mode === 'literal' && activeSearch.query.length > 0;
    const literalQuery = activeSearch.mode === 'literal' ? activeSearch.query : '';
    const pattern = useDbTextFilter ? postgrestOrIlikeValue(literalQuery) : null;

    const wantProperties = type === 'all' || type === 'properties';
    const wantDevelopments = type === 'all' || type === 'developments';
    const wantParkings = type === 'all' || type === 'parkings';

    let properties: PropertySearchSummary[] = [];
    let developments: DevelopmentSearchSummary[] = [];
    let parkings: ParkingSearchSummary[] = [];
    let propertyTotal = 0;
    let developmentTotal = 0;
    let parkingTotal = 0;

    if (wantProperties) {
      const buildPropertyQuery = () => {
        let query = supabase
          .from('properties')
          .select('id, slug, name, type, city, residence_name, max_guests, settings, created_at')
          .eq('status', 'ACTIVE');

        if (pattern) {
          query = query.or(
            `name.ilike.${pattern},city.ilike.${pattern},residence_name.ilike.${pattern}`
          );
        }
        return query;
      };

      let rows = await loadPublicListingRows('search properties', (from, to) =>
        buildPropertyQuery().order('id').range(from, to)
      );

      if (activeSearch.mode === 'literal') {
        rows = rows.filter((row) =>
          matchesWhere(literalQuery, row.name, row.city, row.residence_name)
        );
      } else if (activeSearch.mode === 'concept') {
        rows = rows.filter((row) =>
          matchesConceptProperty(row, activeSearch.expandedTerms, activeSearch.propertyTypes)
        );
      } else if (activeSearch.mode === 'nearby') {
        rows = rows
          .map((row) => {
            const coords = resolveRowCoords(row.settings, row.residence_name as string | null);
            if (!coords) return null;
            const distanceKm = haversineKm(
              activeSearch.lat,
              activeSearch.lng,
              coords.lat,
              coords.lng
            );
            if (distanceKm > NEARBY_DEFAULT_RADIUS_KM) return null;
            return { row, distanceKm };
          })
          .filter(
            (entry): entry is { row: (typeof rows)[number]; distanceKm: number } => entry != null
          )
          .sort(
            (a, b) =>
              a.distanceKm - b.distanceKm || String(a.row.name).localeCompare(String(b.row.name))
          )
          .map((entry) => entry.row);
      }

      if (adults > 0 || children > 0) {
        rows = rows.filter((row) => propertyFitsGuestCapacity(row, adults, children));
      }

      if (range && rows.length > 0) {
        const conflicting = await loadConflictingPropertyIds(
          rows.map((row) => row.id as string),
          range
        );
        rows = rows.filter((row) => !conflicting.has(row.id as string));
      }

      if (activeSearch.mode === 'literal') {
        rows.sort(
          (a, b) =>
            rankTextMatch(literalQuery, b.name, b.city, b.residence_name) -
              rankTextMatch(literalQuery, a.name, a.city, a.residence_name) ||
            String(a.name).localeCompare(String(b.name))
        );
      } else if (activeSearch.mode === 'concept') {
        rows.sort(
          (a, b) =>
            conceptRankScore(
              activeSearch.expandedTerms,
              b.name,
              b.city,
              b.residence_name,
              ...readAmenities(b.settings)
            ) -
              conceptRankScore(
                activeSearch.expandedTerms,
                a.name,
                a.city,
                a.residence_name,
                ...readAmenities(a.settings)
              ) || String(a.name).localeCompare(String(b.name))
        );
      } else if (activeSearch.mode === 'browse') {
        rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      }

      const pageRows = paginate(rows, effectivePage, pageSize);
      const ids = pageRows.map((row) => row.id as string);

      const priceById = new Map<string, number>();
      if (ids.length > 0) {
        const { data: pricingRows } = await supabase
          .from('app_settings')
          .select('property_id, weekday_nightly_rate')
          .in('property_id', ids);
        for (const pricing of pricingRows ?? []) {
          if (pricing.property_id != null && pricing.weekday_nightly_rate != null) {
            priceById.set(pricing.property_id as string, Number(pricing.weekday_nightly_rate));
          }
        }
      }

      propertyTotal = rows.length;
      properties = pageRows.map((row) =>
        mapPropertySearchSummary(row, { price: priceById.get(row.id as string) ?? null })
      );
    }

    if (wantDevelopments) {
      const buildDevelopmentQuery = () => {
        let query = supabase
          .from('developments')
          .select(
            'id, slug, name, type, city, location, developer_name, cover_image_url, settings, created_at'
          )
          .eq('status', 'ACTIVE');

        if (pattern) {
          query = query.or(`name.ilike.${pattern},city.ilike.${pattern},location.ilike.${pattern}`);
        }
        return query;
      };

      let rows = await loadPublicListingRows('search developments', (from, to) =>
        buildDevelopmentQuery().order('id').range(from, to)
      );

      if (activeSearch.mode === 'literal') {
        rows = rows.filter((row) => matchesWhere(literalQuery, row.name, row.city, row.location));
      } else if (activeSearch.mode === 'concept') {
        rows = rows.filter((row) =>
          matchesConceptDevelopment(row, activeSearch.expandedTerms, activeSearch.propertyTypes)
        );
      } else if (activeSearch.mode === 'nearby') {
        rows = rows
          .map((row) => {
            const coords = resolveRowCoords(row.settings, row.name as string | null);
            if (!coords) return null;
            const distanceKm = haversineKm(
              activeSearch.lat,
              activeSearch.lng,
              coords.lat,
              coords.lng
            );
            if (distanceKm > NEARBY_DEFAULT_RADIUS_KM) return null;
            return { row, distanceKm };
          })
          .filter(
            (entry): entry is { row: (typeof rows)[number]; distanceKm: number } => entry != null
          )
          .sort(
            (a, b) =>
              a.distanceKm - b.distanceKm || String(a.row.name).localeCompare(String(b.row.name))
          )
          .map((entry) => entry.row);
      }

      if (activeSearch.mode === 'literal') {
        rows.sort(
          (a, b) =>
            rankTextMatch(literalQuery, b.name, b.city, b.location) -
              rankTextMatch(literalQuery, a.name, a.city, a.location) ||
            String(a.name).localeCompare(String(b.name))
        );
      } else if (activeSearch.mode === 'concept') {
        rows.sort(
          (a, b) =>
            conceptRankScore(activeSearch.expandedTerms, b.name, b.city, b.location) -
              conceptRankScore(activeSearch.expandedTerms, a.name, a.city, a.location) ||
            String(a.name).localeCompare(String(b.name))
        );
      } else if (activeSearch.mode === 'browse') {
        rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      }

      const pageRows = paginate(rows, effectivePage, pageSize);

      const names = pageRows.map((row) => row.name as string).filter(Boolean);
      const countByName = new Map<string, number>();
      if (names.length > 0) {
        const { data: propRows } = await supabase
          .from('properties')
          .select('residence_name')
          .eq('status', 'ACTIVE')
          .in('residence_name', names);
        for (const prop of propRows ?? []) {
          const name = prop.residence_name as string;
          if (!name) continue;
          countByName.set(name, (countByName.get(name) ?? 0) + 1);
        }
      }

      developmentTotal = rows.length;
      developments = pageRows.map((row) =>
        mapDevelopmentSearchSummary(row, countByName.get(row.name as string) ?? 0)
      );
    }

    if (wantParkings) {
      const buildParkingQuery = () => {
        let query = supabase
          .from('parkings')
          .select(
            'id, slug, name, residence_name, tower, level, slot_label, parking_type, rate_per_night, settings, created_at'
          )
          .eq('status', 'ACTIVE');

        if (pattern) {
          query = query.or(
            `name.ilike.${pattern},residence_name.ilike.${pattern},tower.ilike.${pattern}`
          );
        }
        return query;
      };

      let rows = await loadPublicListingRows('search parkings', (from, to) =>
        buildParkingQuery().order('id').range(from, to)
      );

      if (activeSearch.mode === 'literal') {
        rows = rows.filter((row) => {
          const settings = asSettingsRecord(row.settings);
          const city = typeof settings.city === 'string' ? settings.city : '';
          return matchesWhere(literalQuery, row.name, row.residence_name, row.tower, city);
        });
      } else if (activeSearch.mode === 'concept') {
        rows = rows.filter((row) =>
          matchesConceptParking(row, activeSearch.expandedTerms, activeSearch.propertyTypes)
        );
      } else if (activeSearch.mode === 'nearby') {
        rows = rows
          .map((row) => {
            const coords = resolveRowCoords(row.settings, row.residence_name as string | null);
            if (!coords) return null;
            const distanceKm = haversineKm(
              activeSearch.lat,
              activeSearch.lng,
              coords.lat,
              coords.lng
            );
            if (distanceKm > NEARBY_DEFAULT_RADIUS_KM) return null;
            return { row, distanceKm };
          })
          .filter(
            (entry): entry is { row: (typeof rows)[number]; distanceKm: number } => entry != null
          )
          .sort(
            (a, b) =>
              a.distanceKm - b.distanceKm || String(a.row.name).localeCompare(String(b.row.name))
          )
          .map((entry) => entry.row);
      }

      if (range && rows.length > 0) {
        const conflicting = await loadConflictingParkingIds(
          rows.map((row) => row.id as string),
          range
        );
        rows = rows.filter((row) => !conflicting.has(row.id as string));
      }

      if (activeSearch.mode === 'literal') {
        rows.sort(
          (a, b) =>
            rankTextMatch(literalQuery, b.name, b.residence_name, b.tower) -
              rankTextMatch(literalQuery, a.name, a.residence_name, a.tower) ||
            String(a.name).localeCompare(String(b.name))
        );
      } else if (activeSearch.mode === 'concept') {
        rows.sort((a, b) => {
          const settingsA = asSettingsRecord(a.settings);
          const settingsB = asSettingsRecord(b.settings);
          const cityA = typeof settingsA.city === 'string' ? settingsA.city : '';
          const cityB = typeof settingsB.city === 'string' ? settingsB.city : '';
          return (
            conceptRankScore(activeSearch.expandedTerms, b.name, b.residence_name, b.tower, cityB) -
              conceptRankScore(
                activeSearch.expandedTerms,
                a.name,
                a.residence_name,
                a.tower,
                cityA
              ) || String(a.name).localeCompare(String(b.name))
          );
        });
      } else if (activeSearch.mode === 'browse') {
        rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      }

      parkingTotal = rows.length;
      parkings = paginate(rows, effectivePage, pageSize).map((row) => mapParkingSearchSummary(row));
    }

    return {
      properties,
      developments,
      parkings,
      propertyTotal,
      developmentTotal,
      parkingTotal,
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

    return jsonSuccess(req, {
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
    });
  } catch {
    return jsonError(req, 'Failed to search listings', 500);
  }
});
