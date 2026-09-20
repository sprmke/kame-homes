/**
 * list-public-properties — Public GET for /properties browse + /search property filters.
 * Auth: anon key (verify_jwt=false).
 * Query: type[], minPrice, maxPrice, bedrooms, amenities[], development[],
 *        checkIn, checkOut, adults, children, lat, lng, sort, page, pageSize,
 *        swLat, swLng, neLat, neLng (map viewport — capped markers, page ignored)
 *
 * `lat`/`lng` scope results to the Nearby radius so the /search category tabs
 * agree with the All tab; with no explicit sort the page stays nearest-first.
 * Map bbox scopes markers; each row includes latitude/longitude.
 * Facets: grid/list = after all filters; map mode = from the visible bbox
 * pool before type/price/bedroom/amenity/development filters (so options
 * mirror what’s on the map even when a facet is already selected).
 * Pricing via batched app_settings read (no ensurePropertySettings upsert).
 * Reviews for rating sorts load on the full candidate set; nearest/newest defer
 * reviews + superhost to the current page only.
 * Availability via availabilityService.loadConflictingPropertyIds.
 */

import { loadConflictingPropertyIds, parseRequestedRange } from '../_shared/availabilityService.ts';
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
import {
  amenityLabelForId,
  batchLoadPropertyPricing,
  batchLoadReviewStats,
  computeAmenityFacet,
  computeNumberCountFacet,
  computePriceFacet,
  computeStringCountFacet,
  propertyTypeLabel,
} from '../_shared/publicListingFacets.ts';
import { propertyPlaceLabel, toLocationSlug } from '../_shared/listingPlace.ts';
import { loadPublicListingRows } from '../_shared/publicListingRows.ts';
import { batchLoadIsSuperhostByPropertyId } from '../_shared/orgSuperhost.ts';
import { mapPropertySearchSummary, postgrestOrIlikeValue } from '../_shared/publicSearch.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

type SortKey = 'recommended' | 'rating' | 'reviews' | 'newest';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 48;
const VALID_SORTS = new Set<SortKey>(['recommended', 'rating', 'reviews', 'newest']);

function parseCsv(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

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

function readAmenityIds(settings: unknown): string[] {
  const record = asSettings(settings);
  const value = record.enabledAmenities;
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
}

function propertyFitsGuests(
  settings: unknown,
  maxGuests: number | null,
  adults: number,
  children: number
): boolean {
  const needed = adults + children;
  if (needed <= 0) return true;
  const record = asSettings(settings);
  const maxAdults = readNumber(record, 'maxAdults');
  const maxChildren = readNumber(record, 'maxChildren') ?? 0;
  const capacity =
    maxGuests && maxGuests > 0
      ? maxGuests
      : maxAdults != null
        ? Math.max(maxAdults + Math.max(maxChildren, 0), 1)
        : null;
  if (capacity == null) return true;
  return capacity >= needed;
}

type WorkingRow = {
  id: string;
  slug: string;
  name: string;
  type: string;
  city: string | null;
  residence_name: string | null;
  max_guests: number | null;
  tower: string | null;
  unit_number: string | null;
  settings: unknown;
  created_at: string;
  price: number;
  rating: number | null;
  reviewCount: number;
  amenityIds: string[];
  bedrooms: number | null;
  developmentSlug: string | null;
  developmentName: string | null;
  isSuperhost: boolean;
};

servePublic('list-public-properties', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const limited = await publicGetRateLimitGate(req, 'list-public-properties');
  if (limited) return limited;

  const url = new URL(req.url);
  const where = (url.searchParams.get('where') ?? '').trim();
  const types = parseCsv(url.searchParams.get('type')).map((t) => t.toLowerCase());
  const minPrice = parseOptionalNumber(url.searchParams.get('minPrice'));
  const maxPrice = parseOptionalNumber(url.searchParams.get('maxPrice'));
  const bedroomsRaw = url.searchParams.get('bedrooms');
  const bedrooms =
    bedroomsRaw === '5+'
      ? 5
      : bedroomsRaw && bedroomsRaw !== 'Any'
        ? parseOptionalNumber(bedroomsRaw)
        : null;
  const amenities = parseCsv(url.searchParams.get('amenities'));
  const developmentSlugs = parseCsv(url.searchParams.get('development')).map((s) =>
    s.toLowerCase()
  );
  const checkIn = url.searchParams.get('checkIn');
  const checkOut = url.searchParams.get('checkOut');
  const adults = parseNonNegInt(url.searchParams.get('adults'));
  const children = parseNonNegInt(url.searchParams.get('children'));
  const sortRaw = url.searchParams.get('sort');
  const sort = parseSort(sortRaw);
  const sortExplicit = Boolean(sortRaw && VALID_SORTS.has(sortRaw as SortKey));
  const page = parsePage(url.searchParams.get('page'));
  const pageSize = parsePageSize(url.searchParams.get('pageSize'));
  const locationSlug = (url.searchParams.get('locationSlug') ?? '').trim().toLowerCase();
  const origin = readGeoOrigin(url.searchParams);
  const mapBbox = readMapBbox(url.searchParams);

  const range = parseRequestedRange(checkIn, checkOut);

  try {
    const supabase = createServiceClient();

    const buildCandidateQuery = () => {
      let query = supabase
        .from('properties')
        .select(
          'id, slug, name, type, city, residence_name, max_guests, tower, unit_number, settings, created_at'
        )
        .eq('status', 'ACTIVE');

      // Map mode keeps all types in the candidate set so facets stay disjunctive.
      if (types.length === 1 && !mapBbox) {
        query = query.ilike('type', types[0]!);
      }
      if (where) {
        const pattern = postgrestOrIlikeValue(where);
        query = query.or(
          `name.ilike.${pattern},city.ilike.${pattern},residence_name.ilike.${pattern}`
        );
      }
      return query;
    };

    let rows = await loadPublicListingRows('properties', (from, to) =>
      buildCandidateQuery().order('id').range(from, to)
    );

    if (types.length > 1 && !mapBbox) {
      const typeSet = new Set(types);
      rows = rows.filter((row) => typeSet.has(String(row.type).toLowerCase()));
    }

    if (locationSlug) {
      rows = rows.filter((row) => toLocationSlug(propertyPlaceLabel(row)) === locationSlug);
    }

    let distanceById = new Map<string, number>();
    if (origin) {
      const scoped = scopeRowsToRadius(
        rows.map((row) => ({ ...row, id: row.id as string })),
        origin,
        (row) => resolveListingCoords(row.settings, row.residence_name as string | null)
      );
      rows = scoped.rows;
      distanceById = scoped.distanceById;
    }

    const { data: developments } = await supabase
      .from('developments')
      .select('slug, name')
      .eq('status', 'ACTIVE')
      .limit(500);

    const developmentByName = new Map<string, { slug: string; name: string }>();
    for (const dev of developments ?? []) {
      const name = (dev.name as string | null)?.trim();
      const slug = (dev.slug as string | null)?.trim();
      if (!name || !slug) continue;
      developmentByName.set(name.toLowerCase(), { slug, name });
    }

    const ids = rows.map((row) => row.id as string);
    // Pricing is required for every candidate (price filter + price facets).
    // Reviews are only required before sort when ranking by rating/reviews.
    // Superhost is card chrome — load only for the page after slice.
    const nearestFirst = origin != null && !sortExplicit;
    const needsReviewsForSort = !nearestFirst && sort !== 'newest';

    const [priceById, reviewById] = await Promise.all([
      batchLoadPropertyPricing(ids),
      needsReviewsForSort
        ? batchLoadReviewStats(ids)
        : Promise.resolve(new Map<string, { rating: number | null; reviewCount: number }>()),
    ]);

    let working: WorkingRow[] = rows.map((row) => {
      const id = row.id as string;
      const settings = asSettings(row.settings);
      const residence = (row.residence_name as string | null)?.trim() || null;
      const matched = residence ? developmentByName.get(residence.toLowerCase()) : null;
      const reviews = reviewById.get(id) ?? { rating: null, reviewCount: 0 };
      return {
        id,
        slug: row.slug as string,
        name: row.name as string,
        type: row.type as string,
        city: (row.city as string | null) ?? null,
        residence_name: residence,
        max_guests: (row.max_guests as number | null) ?? null,
        tower: (row.tower as string | null) ?? null,
        unit_number: (row.unit_number as string | null) ?? null,
        settings: row.settings,
        created_at: (row.created_at as string) ?? '',
        price: priceById.get(id) ?? 2799,
        rating: reviews.rating,
        reviewCount: reviews.reviewCount,
        amenityIds: readAmenityIds(row.settings),
        bedrooms: readNumber(settings, 'bedrooms'),
        developmentSlug: matched?.slug ?? null,
        developmentName: matched?.name ?? residence,
        isSuperhost: false,
      };
    });

    // Hard constraints (guests, dates, map viewport) always shape the pool first.
    if (adults > 0 || children > 0) {
      working = working.filter((row) =>
        propertyFitsGuests(row.settings, row.max_guests, adults, children)
      );
    }

    if (range) {
      const conflicting = await loadConflictingPropertyIds(
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
      if (types.length > 0) {
        const typeSet = new Set(types);
        working = working.filter((row) => typeSet.has(row.type.toLowerCase()));
      }
      if (minPrice != null) {
        working = working.filter((row) => row.price >= minPrice);
      }
      if (maxPrice != null) {
        working = working.filter((row) => row.price <= maxPrice);
      }
      if (bedrooms != null) {
        working = working.filter((row) => {
          if (row.bedrooms == null) return false;
          if (bedrooms >= 5) return row.bedrooms >= 5;
          return row.bedrooms === bedrooms;
        });
      }
      if (amenities.length > 0) {
        working = working.filter((row) => amenities.every((id) => row.amenityIds.includes(id)));
      }
      if (developmentSlugs.length > 0) {
        const slugSet = new Set(developmentSlugs);
        working = working.filter(
          (row) => row.developmentSlug != null && slugSet.has(row.developmentSlug.toLowerCase())
        );
      }
    };

    const buildFacets = () => ({
      types: computeStringCountFacet(working.map((row) => row.type.toLowerCase())).map((entry) => ({
        type: entry.value,
        label: propertyTypeLabel(entry.value),
        count: entry.count,
      })),
      price: computePriceFacet(working.map((row) => row.price)),
      bedrooms: computeNumberCountFacet(working.map((row) => row.bedrooms)).map((entry) => ({
        value: entry.value,
        count: entry.count,
      })),
      amenities: computeAmenityFacet(working.map((row) => row.amenityIds)),
      developments: (() => {
        const counts = new Map<string, { slug: string; name: string; count: number }>();
        for (const row of working) {
          if (!row.developmentSlug || !row.developmentName) continue;
          const key = row.developmentSlug.toLowerCase();
          const existing = counts.get(key);
          if (existing) existing.count += 1;
          else
            counts.set(key, {
              slug: row.developmentSlug,
              name: row.developmentName,
              count: 1,
            });
        }
        return [...counts.values()].sort(
          (a, b) => b.count - a.count || a.name.localeCompare(b.name)
        );
      })(),
    });

    // Map view: facets = what’s visible on the map; then narrow pins/results.
    // Grid/list: facets = after all filters (unchanged browse behavior).
    let facets;
    if (mapBbox) {
      facets = buildFacets();
      applyCategoricalFilters();
    } else {
      applyCategoricalFilters();
      facets = buildFacets();
    }

    const nearestFirstSort = origin != null && !sortExplicit;

    working.sort((a, b) => {
      if (nearestFirstSort) {
        return (distanceById.get(a.id) ?? Infinity) - (distanceById.get(b.id) ?? Infinity);
      }
      switch (sort) {
        case 'rating':
          return (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount;
        case 'reviews':
          return b.reviewCount - a.reviewCount || (b.rating ?? 0) - (a.rating ?? 0);
        case 'newest':
          return String(b.created_at).localeCompare(String(a.created_at));
        default:
          return (
            (b.rating ?? 0) - (a.rating ?? 0) ||
            b.reviewCount - a.reviewCount ||
            a.name.localeCompare(b.name)
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
    const pageIds = pageRows.map((row) => row.id);

    const [pageReviewById, superhostById] = await Promise.all([
      needsReviewsForSort ? Promise.resolve(reviewById) : batchLoadReviewStats(pageIds),
      batchLoadIsSuperhostByPropertyId(supabase, pageIds),
    ]);

    const data = pageRows.map((row) => {
      const pageReviews = pageReviewById.get(row.id) ?? {
        rating: row.rating,
        reviewCount: row.reviewCount,
      };
      const rating = needsReviewsForSort ? row.rating : pageReviews.rating;
      const reviewCount = needsReviewsForSort ? row.reviewCount : pageReviews.reviewCount;

      const summary = mapPropertySearchSummary(
        {
          id: row.id,
          slug: row.slug,
          name: row.name,
          type: row.type,
          city: row.city,
          residence_name: row.residence_name,
          max_guests: row.max_guests,
          settings: row.settings,
        },
        {
          price: row.price,
          rating,
          reviewCount,
        }
      );

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const createdMs = Date.parse(row.created_at);
      const isNew = Number.isFinite(createdMs) && createdMs >= thirtyDaysAgo;
      const coords = resolveListingCoords(row.settings, row.residence_name);

      return {
        id: summary.id,
        slug: summary.slug,
        name: summary.name,
        type: propertyTypeLabel(summary.type),
        location: summary.locationLabel,
        price: summary.price ?? row.price,
        rating: summary.reviewCount > 0 ? summary.rating : null,
        reviews: summary.reviewCount,
        images:
          summary.images.length > 0
            ? summary.images
            : summary.coverImage
              ? [summary.coverImage]
              : [],
        guests: summary.maxGuests ?? 1,
        bedrooms: summary.bedrooms ?? 1,
        bathrooms: summary.bathrooms ?? 1,
        amenities: summary.amenities.map(amenityLabelForId),
        isSuperhost: superhostById.get(row.id) ?? false,
        isNew,
        developmentSlug: row.developmentSlug ?? undefined,
        developmentName: row.developmentName ?? undefined,
        tower: row.tower ?? undefined,
        unitNumber: row.unit_number ?? undefined,
        createdAt: row.created_at,
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
    console.error('[list-public-properties]', error);
    return jsonError(req, 'Failed to list properties', 500);
  }
});
