/**
 * list-public-parkings — Public GET for /parkings browse + filters.
 * Auth: anon key (verify_jwt=false).
 * Query: location[], towers[], minPrice, maxPrice, checkIn, checkOut, lat, lng, sort, page, pageSize
 * Legacy: `type` param maps to location[] (inside_tower|outside_tower|motorcycle).
 *
 * `lat`/`lng` scope results to the Nearby radius so the /search category tabs
 * agree with the All tab. Availability via loadConflictingParkingIds when
 * checkIn+checkOut present.
 * Facets: grid/list = after all filters; map mode = from the visible bbox
 * pool before location/tower/price filters (options mirror the map).
 * Card fields come from selected parkings rows + in-memory settings parse;
 * no separate page-only enrich query (developments lookup is for slug chrome).
 */

import { loadConflictingParkingIds, parseRequestedRange } from '../_shared/availabilityService.ts';
import { jsonError, jsonResponse } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  filterRowsToBbox,
  MAP_MARKER_CAP,
  readGeoOrigin,
  readMapBbox,
  resolveListingCoords,
  scopeRowsToRadius,
} from '../_shared/publicGeoScope.ts';
import { normalizeCityPlace, toLocationSlug } from '../_shared/listingPlace.ts';
import { computePriceFacet, computeStringCountFacet } from '../_shared/publicListingFacets.ts';
import { loadPublicListingRows } from '../_shared/publicListingRows.ts';
import {
  escapeIlikePattern,
  mapParkingSearchSummary,
  postgrestOrIlikeValue,
} from '../_shared/publicSearch.ts';
import { slugifyName } from '../_shared/slugUtils.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

type ParkingLocation = 'inside_tower' | 'outside_tower' | 'motorcycle';
type SortKey = 'tower';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 48;
const VALID_SORTS = new Set<SortKey>(['tower']);
const VALID_LOCATIONS = new Set<ParkingLocation>(['inside_tower', 'outside_tower', 'motorcycle']);

function parseCsv(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseLocations(url: URL): ParkingLocation[] {
  const fromLocation = parseCsv(url.searchParams.get('location'))
    .map((value) => value.toLowerCase())
    .filter((value): value is ParkingLocation => VALID_LOCATIONS.has(value as ParkingLocation));

  if (fromLocation.length > 0) return [...new Set(fromLocation)];

  const legacy = (url.searchParams.get('type') ?? '').trim().toLowerCase();
  if (legacy && VALID_LOCATIONS.has(legacy as ParkingLocation)) {
    return [legacy as ParkingLocation];
  }
  return [];
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

function parseOptionalNumber(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseSort(raw: string | null): SortKey {
  if (raw && VALID_SORTS.has(raw as SortKey)) return raw as SortKey;
  return 'tower';
}

function asSettings(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === 'object' && !Array.isArray(settings)
    ? (settings as Record<string, unknown>)
    : {};
}

function readNumber(settings: Record<string, unknown>, key: string): number | null {
  const value = settings[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

type WorkingRow = {
  id: string;
  slug: string;
  name: string;
  parking_type: ParkingLocation;
  tower: string | null;
  level: string | null;
  slot_label: string;
  rate: number;
  features: string[];
  coverImage: string | null;
  residence_name: string | null;
  city: string | null;
  developmentSlug: string | null;
  developmentName: string | null;
  settings: unknown;
};

servePublic('list-public-parkings', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const limited = await publicGetRateLimitGate(req, 'list-public-parkings');
  if (limited) return limited;

  const url = new URL(req.url);
  const where = (url.searchParams.get('where') ?? '').trim();
  const locations = parseLocations(url);
  const towers = parseCsv(url.searchParams.get('towers'));
  const minPrice = parseOptionalNumber(url.searchParams.get('minPrice'));
  const maxPrice = parseOptionalNumber(url.searchParams.get('maxPrice'));
  const checkIn = url.searchParams.get('checkIn');
  const checkOut = url.searchParams.get('checkOut');
  // Accept legacy ?sort=price_* URLs; only tower ordering is applied.
  parseSort(url.searchParams.get('sort'));
  const page = parsePage(url.searchParams.get('page'));
  const pageSize = parsePageSize(url.searchParams.get('pageSize'));
  const locationSlug = (url.searchParams.get('locationSlug') ?? '').trim().toLowerCase();
  const developmentSlug = (url.searchParams.get('developmentSlug') ?? '').trim().toLowerCase();
  const origin = readGeoOrigin(url.searchParams);
  const mapBbox = readMapBbox(url.searchParams);

  const range = parseRequestedRange(checkIn, checkOut);

  try {
    const supabase = createServiceClient();

    let developmentResidenceName: string | null = null;
    if (developmentSlug) {
      const { data: developmentRow } = await supabase
        .from('developments')
        .select('name')
        .eq('status', 'ACTIVE')
        .ilike('slug', escapeIlikePattern(developmentSlug))
        .maybeSingle();
      developmentResidenceName = (developmentRow?.name as string | null)?.trim() || null;
    }

    const buildCandidateQuery = () => {
      let query = supabase
        .from('parkings')
        .select(
          'id, slug, name, residence_name, tower, level, slot_label, parking_type, rate_per_night, settings'
        )
        .eq('status', 'ACTIVE');
      if (developmentResidenceName) {
        query = query.ilike('residence_name', escapeIlikePattern(developmentResidenceName));
      }
      if (where) {
        const pattern = postgrestOrIlikeValue(where);
        query = query.or(
          `name.ilike.${pattern},residence_name.ilike.${pattern},tower.ilike.${pattern},slot_label.ilike.${pattern}`
        );
      }
      return query;
    };

    const [rawRows, developments] = await Promise.all([
      loadPublicListingRows('parkings', (from, to) =>
        buildCandidateQuery().order('id').range(from, to)
      ),
      developmentResidenceName && developmentSlug
        ? Promise.resolve([{ slug: developmentSlug, name: developmentResidenceName }])
        : loadPublicListingRows('parking developments', (from, to) =>
            supabase
              .from('developments')
              .select('slug, name')
              .eq('status', 'ACTIVE')
              .order('id')
              .range(from, to)
          ),
    ]);

    const developmentByName = new Map<string, { slug: string; name: string }>();
    for (const dev of developments) {
      const name = (dev.name as string | null)?.trim();
      const slug = (dev.slug as string | null)?.trim();
      if (!name || !slug) continue;
      developmentByName.set(name.toLowerCase(), { slug, name });
    }

    let working: WorkingRow[] = rawRows.map((row) => {
      const settings = asSettings(row.settings);
      const residence = (row.residence_name as string | null)?.trim() || null;
      const matched = residence ? developmentByName.get(residence.toLowerCase()) : null;
      const summary = mapParkingSearchSummary({
        id: row.id as string,
        slug: row.slug as string,
        name: row.name as string,
        residence_name: residence,
        tower: (row.tower as string | null) ?? null,
        level: (row.level as string | null) ?? null,
        slot_label: row.slot_label as string,
        parking_type: row.parking_type as string,
        rate_per_night: row.rate_per_night != null ? Number(row.rate_per_night) : null,
        settings: row.settings,
      });

      const rate = summary.ratePerNight ?? readNumber(settings, 'ratePerNight') ?? 0;

      return {
        id: summary.id,
        slug: summary.slug,
        name: summary.name,
        parking_type: row.parking_type as ParkingLocation,
        tower: summary.tower,
        level: summary.level,
        slot_label: summary.slotLabel,
        rate,
        features: summary.features,
        coverImage: summary.coverImage,
        residence_name: residence,
        city: summary.city,
        developmentSlug: matched?.slug ?? (residence ? slugifyName(residence) : null),
        developmentName: matched?.name ?? residence,
        settings: row.settings,
      };
    });

    if (developmentSlug) {
      working = working.filter(
        (row) => (row.developmentSlug ?? '').toLowerCase() === developmentSlug
      );
    }

    if (locationSlug) {
      working = working.filter(
        (row) => toLocationSlug(normalizeCityPlace(row.city)) === locationSlug
      );
    }

    if (origin) {
      working = scopeRowsToRadius(working, origin, (row) =>
        resolveListingCoords(row.settings, row.residence_name)
      ).rows;
    }

    if (range) {
      const conflicting = await loadConflictingParkingIds(
        working.map((row) => row.id),
        range
      );
      if (conflicting.size > 0) {
        working = working.filter((row) => !conflicting.has(row.id));
      }
    }

    if (mapBbox) {
      working = filterRowsToBbox(
        working,
        (row) => resolveListingCoords(row.settings, row.residence_name),
        mapBbox
      );
    }

    const applyCategoricalFilters = () => {
      if (locations.length > 0) {
        const locationSet = new Set(locations);
        working = working.filter((row) => locationSet.has(row.parking_type));
      }

      if (towers.length > 0) {
        const towerSet = new Set(towers.map((t) => t.toLowerCase()));
        working = working.filter(
          (row) => row.tower != null && towerSet.has(row.tower.toLowerCase())
        );
      }

      if (minPrice != null) {
        working = working.filter((row) => row.rate >= minPrice);
      }
      if (maxPrice != null) {
        working = working.filter((row) => row.rate <= maxPrice);
      }
    };

    const buildFacets = () => ({
      locations: computeStringCountFacet(working.map((row) => row.parking_type)).map((entry) => ({
        location: entry.value as ParkingLocation,
        count: entry.count,
      })),
      towers: computeStringCountFacet(
        working.filter((row) => row.parking_type === 'inside_tower').map((row) => row.tower)
      ).map((entry) => ({
        tower: entry.value,
        count: entry.count,
      })),
      price: computePriceFacet(working.map((row) => row.rate)),
    });

    let facets;
    if (mapBbox) {
      facets = buildFacets();
      applyCategoricalFilters();
    } else {
      applyCategoricalFilters();
      facets = buildFacets();
    }

    working.sort((a, b) => {
      return (
        (a.tower ?? '').localeCompare(b.tower ?? '') ||
        a.rate - b.rate ||
        a.name.localeCompare(b.name)
      );
    });

    const total = working.length;
    const mapMode = mapBbox != null;
    const effectivePageSize = mapMode ? MAP_MARKER_CAP : pageSize;
    const effectivePage = mapMode
      ? 1
      : Math.min(page, Math.max(1, Math.ceil(total / pageSize) || 1));
    const start = mapMode ? 0 : (effectivePage - 1) * pageSize;
    const pageRows = working.slice(start, start + effectivePageSize);

    const data = pageRows.map((row) => {
      const coords = resolveListingCoords(row.settings, row.residence_name);
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        parkingType: row.parking_type,
        tower: row.tower ?? undefined,
        level: row.level ?? undefined,
        slotLabel: row.slot_label,
        ratePerNight: row.rate,
        features: row.features,
        coverImage: row.coverImage ?? undefined,
        residenceName: row.residence_name ?? undefined,
        city: row.city ?? undefined,
        developmentSlug: row.developmentSlug ?? undefined,
        developmentName: row.developmentName ?? undefined,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      };
    });

    return jsonResponse(
      req,
      {
        success: true,
        data,
        total,
        facets,
        page: effectivePage,
        pageSize: effectivePageSize,
        ...(mapMode ? { mapMode: true } : {}),
      },
      200,
      'publicDynamic'
    );
  } catch (error) {
    console.error('[list-public-parkings]', error);
    return jsonError(req, 'Failed to list parkings', 500);
  }
});
