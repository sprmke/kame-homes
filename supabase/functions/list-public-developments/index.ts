/**
 * list-public-developments — Public GET for /developments browse + filters.
 * Auth: anon key (verify_jwt=false).
 * Query: type[], city[], minPrice, maxPrice, developer, lat, lng, sort, page, pageSize
 *
 * `lat`/`lng` scope results to the Nearby radius so the /search category tabs
 * agree with the All tab; with no explicit sort the page stays nearest-first.
 * Facets: grid/list = after all filters; map mode = from the visible bbox
 * pool before type/city/developer/price filters so sidebar options mirror
 * what’s on the map. Price from developments.settings priceRangeMin/Max;
 * property counts loaded only for the current page (card chrome).
 */

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
  mapDevelopmentSearchSummary,
  postgrestOrIlikeValue,
} from '../_shared/publicSearch.ts';
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

function parseCsv(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
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
  return 'recommended';
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

function readStringArray(settings: Record<string, unknown>, key: string): string[] {
  const value = settings[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
}

type WorkingRow = {
  id: string;
  slug: string;
  name: string;
  developer_name: string | null;
  type: string;
  location: string | null;
  city: string | null;
  description: string | null;
  cover_image_url: string | null;
  settings: unknown;
  created_at: string;
  priceMin: number;
  priceMax: number;
  amenities: string[];
  established: number | null;
};

servePublic('list-public-developments', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const limited = await publicGetRateLimitGate(req, 'list-public-developments');
  if (limited) return limited;

  const url = new URL(req.url);
  const where = (url.searchParams.get('where') ?? '').trim();
  const types = parseCsv(url.searchParams.get('type')).map((t) => t.toUpperCase());
  const cities = parseCsv(url.searchParams.get('city'));
  const developers = parseCsv(url.searchParams.get('developer'));
  const minPrice = parseOptionalNumber(url.searchParams.get('minPrice'));
  const maxPrice = parseOptionalNumber(url.searchParams.get('maxPrice'));
  const sortRaw = url.searchParams.get('sort');
  const sort = parseSort(sortRaw);
  const sortExplicit = Boolean(sortRaw && VALID_SORTS.has(sortRaw as SortKey));
  const page = parsePage(url.searchParams.get('page'));
  const pageSize = parsePageSize(url.searchParams.get('pageSize'));
  const locationSlug = (url.searchParams.get('locationSlug') ?? '').trim().toLowerCase();
  const slug = (url.searchParams.get('slug') ?? '').trim().toLowerCase();
  const origin = readGeoOrigin(url.searchParams);
  const mapBbox = readMapBbox(url.searchParams);

  try {
    const supabase = createServiceClient();

    const buildCandidateQuery = () => {
      let query = supabase
        .from('developments')
        .select(
          'id, slug, name, developer_name, type, location, city, description, cover_image_url, settings, created_at'
        )
        .eq('status', 'ACTIVE');
      if (slug) {
        query = query.ilike('slug', escapeIlikePattern(slug));
      }
      if (where) {
        const pattern = postgrestOrIlikeValue(where);
        query = query.or(
          `name.ilike.${pattern},city.ilike.${pattern},location.ilike.${pattern},developer_name.ilike.${pattern}`
        );
      }
      return query;
    };

    const rawRows = await loadPublicListingRows('developments', (from, to) =>
      buildCandidateQuery().order('id').range(from, to)
    );

    let working: WorkingRow[] = rawRows.map((row) => {
      const settings = asSettings(row.settings);
      const priceMin = readNumber(settings, 'priceRangeMin') ?? 0;
      const priceMax = readNumber(settings, 'priceRangeMax') ?? priceMin;
      const name = row.name as string;
      const establishedFromSettings = readNumber(settings, 'established');
      const createdYear = Number.parseInt(String(row.created_at).slice(0, 4), 10);
      return {
        id: row.id as string,
        slug: row.slug as string,
        name,
        developer_name: (row.developer_name as string | null) ?? null,
        type: row.type as string,
        location: (row.location as string | null) ?? null,
        city: (row.city as string | null) ?? null,
        description: (row.description as string | null) ?? null,
        cover_image_url: (row.cover_image_url as string | null) ?? null,
        settings: row.settings,
        created_at: (row.created_at as string) ?? '',
        priceMin,
        priceMax,
        amenities: readStringArray(settings, 'amenities'),
        established: establishedFromSettings ?? (Number.isFinite(createdYear) ? createdYear : null),
      };
    });

    if (slug) {
      working = working.filter((row) => row.slug.toLowerCase() === slug);
    }

    if (locationSlug) {
      working = working.filter(
        (row) => toLocationSlug(normalizeCityPlace(row.city)) === locationSlug
      );
    }

    let distanceById = new Map<string, number>();
    if (origin) {
      const scoped = scopeRowsToRadius(working, origin, (row) =>
        resolveListingCoords(row.settings, row.name)
      );
      working = scoped.rows;
      distanceById = scoped.distanceById;
    }

    if (mapBbox) {
      working = filterRowsToBbox(
        working,
        (row) => resolveListingCoords(row.settings, row.name),
        mapBbox
      );
    }

    const applyCategoricalFilters = () => {
      if (types.length > 0) {
        const typeSet = new Set(types);
        working = working.filter((row) => typeSet.has(row.type.toUpperCase()));
      }

      if (cities.length > 0) {
        const citySet = new Set(cities.map((c) => c.toLowerCase()));
        working = working.filter((row) => row.city != null && citySet.has(row.city.toLowerCase()));
      }

      if (developers.length > 0) {
        const devSet = new Set(developers.map((d) => d.toLowerCase()));
        working = working.filter(
          (row) => row.developer_name != null && devSet.has(row.developer_name.toLowerCase())
        );
      }

      if (minPrice != null) {
        working = working.filter((row) => row.priceMax >= minPrice);
      }
      if (maxPrice != null) {
        working = working.filter((row) => row.priceMin <= maxPrice);
      }
    };

    const buildFacets = () => ({
      types: computeStringCountFacet(working.map((row) => row.type)).map((entry) => ({
        type: entry.value,
        label: developmentTypeLabel(entry.value),
        count: entry.count,
      })),
      cities: computeStringCountFacet(working.map((row) => row.city)).map((entry) => ({
        city: entry.value,
        count: entry.count,
      })),
      price: computePriceFacet(working.map((row) => row.priceMin)),
      developers: computeStringCountFacet(working.map((row) => row.developer_name)).map(
        (entry) => ({
          name: entry.value,
          count: entry.count,
        })
      ),
    });

    let facets;
    if (mapBbox) {
      facets = buildFacets();
      applyCategoricalFilters();
    } else {
      applyCategoricalFilters();
      facets = buildFacets();
    }

    const nearestFirst = origin != null && !sortExplicit;

    working.sort((a, b) => {
      if (nearestFirst) {
        return (distanceById.get(a.id) ?? Infinity) - (distanceById.get(b.id) ?? Infinity);
      }
      switch (sort) {
        case 'newest':
          return String(b.created_at).localeCompare(String(a.created_at));
        default:
          return (
            String(b.created_at).localeCompare(String(a.created_at)) || a.name.localeCompare(b.name)
          );
      }
    });

    const total = working.length;
    const mapMode = mapBbox != null;
    const effectivePageSize = mapMode ? MAP_MARKER_CAP : pageSize;
    const effectivePage = mapMode
      ? 1
      : Math.min(page, Math.max(1, Math.ceil(total / pageSize) || 1));
    const start = mapMode ? 0 : (effectivePage - 1) * pageSize;
    const pageRows = working.slice(start, start + effectivePageSize);

    // Property counts are card chrome only — not used for facets or sort.
    const pageNames = pageRows.map((row) => row.name).filter(Boolean);
    const propertyCountByName = new Map<string, number>();
    if (pageNames.length > 0) {
      const { data: propertyRows } = await supabase
        .from('properties')
        .select('residence_name')
        .eq('status', 'ACTIVE')
        .in('residence_name', pageNames);
      for (const row of propertyRows ?? []) {
        const name = (row.residence_name as string | null)?.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        propertyCountByName.set(key, (propertyCountByName.get(key) ?? 0) + 1);
      }
    }

    const data = pageRows.map((row) => {
      const propertyCount = propertyCountByName.get(row.name.toLowerCase()) ?? 0;
      const summary = mapDevelopmentSearchSummary(
        {
          id: row.id,
          slug: row.slug,
          name: row.name,
          type: row.type,
          city: row.city,
          location: row.location,
          developer_name: row.developer_name,
          cover_image_url: row.cover_image_url,
          settings: row.settings,
        },
        propertyCount
      );
      const coords = resolveListingCoords(row.settings, row.name);

      return {
        id: summary.id,
        slug: summary.slug,
        name: summary.name,
        developerName: summary.developerName ?? '',
        type: row.type,
        location: summary.location ?? summary.locationLabel,
        city: summary.city ?? '',
        description: row.description ?? '',
        coverImage: summary.coverImage ?? '',
        images:
          summary.images.length > 0
            ? summary.images
            : summary.coverImage
              ? [summary.coverImage]
              : [],
        amenities: row.amenities,
        propertyCount: summary.propertyCount,
        priceRange: {
          min: summary.priceRangeMin ?? row.priceMin,
          max: summary.priceRangeMax ?? row.priceMax,
        },
        established: row.established ?? undefined,
        propertyIds: [] as string[],
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
    console.error('[list-public-developments]', error);
    return jsonError(req, 'Failed to list developments', 500);
  }
});
