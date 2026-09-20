/**
 * list-public-place-groups — Public GET for bounded location rows on listing indexes.
 * Auth: anon key (verify_jwt=false).
 * Query: family=properties|developments|parkings, groupOffset, groupLimit, previewSize.
 *
 * The endpoint groups the full lean ACTIVE candidate set, then enriches only the
 * preview rows returned for the requested group window. It is read-only and
 * deterministic; callers append later group windows with "Show more places".
 */

import { jsonError, jsonResponse } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  amenityLabelForId,
  batchLoadPropertyPricing,
  batchLoadReviewStats,
  propertyTypeLabel,
} from '../_shared/publicListingFacets.ts';
import {
  asSettings,
  normalizeCityPlace,
  propertyPlaceLabel,
  readSettingsString,
  toLocationSlug,
} from '../_shared/listingPlace.ts';
import { loadPublicListingRows } from '../_shared/publicListingRows.ts';
import { batchLoadIsSuperhostByPropertyId } from '../_shared/orgSuperhost.ts';
import {
  mapDevelopmentSearchSummary,
  mapParkingSearchSummary,
  mapPropertySearchSummary,
} from '../_shared/publicSearch.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

type ListingFamily = 'properties' | 'developments' | 'parkings';

type CandidateRow = {
  id: string;
  created_at?: string | null;
  [key: string]: unknown;
};

type PlaceGroup = {
  place: string;
  rows: CandidateRow[];
};

const DEFAULT_GROUP_LIMIT = 6;
const MAX_GROUP_LIMIT = 12;
const DEFAULT_PREVIEW_SIZE = 8;
const MAX_PREVIEW_SIZE = 12;

function parseBoundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
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

function groupRows(
  rows: CandidateRow[],
  resolvePlace: (row: CandidateRow) => string
): PlaceGroup[] {
  const byPlace = new Map<string, CandidateRow[]>();
  for (const row of rows) {
    const place = resolvePlace(row);
    const existing = byPlace.get(place);
    if (existing) existing.push(row);
    else byPlace.set(place, [row]);
  }

  return Array.from(byPlace.entries())
    .map(([place, groupRows]) => ({
      place,
      rows: groupRows.sort(
        (a, b) =>
          String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')) ||
          a.id.localeCompare(b.id)
      ),
    }))
    .sort((a, b) => b.rows.length - a.rows.length || a.place.localeCompare(b.place));
}

function titleForFamily(family: ListingFamily, place: string): string {
  if (family === 'properties') return `Homes in ${place}`;
  if (family === 'developments') return `Developments in ${place}`;
  return `Parking in ${place}`;
}

servePublic('list-public-place-groups', async (req) => {
  if (req.method !== 'GET') return jsonError(req, 'Method not allowed', 405);

  const limited = await publicGetRateLimitGate(req, 'list-public-place-groups');
  if (limited) return limited;
  const url = new URL(req.url);
  const family = url.searchParams.get('family') as ListingFamily | null;
  if (family !== 'properties' && family !== 'developments' && family !== 'parkings') {
    return jsonError(req, 'Invalid listing family', 400);
  }

  const groupOffset = parseBoundedInt(
    url.searchParams.get('groupOffset'),
    0,
    0,
    Number.MAX_SAFE_INTEGER
  );
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

  try {
    const supabase = createServiceClient();
    let rawRows: CandidateRow[];

    if (family === 'properties') {
      rawRows = await loadPublicListingRows('property place groups', (from, to) =>
        supabase
          .from('properties')
          .select(
            'id, slug, name, type, city, residence_name, max_guests, tower, unit_number, settings, created_at'
          )
          .eq('status', 'ACTIVE')
          .order('id')
          .range(from, to)
      );
    } else if (family === 'developments') {
      rawRows = await loadPublicListingRows('development place groups', (from, to) =>
        supabase
          .from('developments')
          .select(
            'id, slug, name, developer_name, type, location, city, description, cover_image_url, settings, created_at'
          )
          .eq('status', 'ACTIVE')
          .order('id')
          .range(from, to)
      );
    } else {
      rawRows = await loadPublicListingRows('parking place groups', (from, to) =>
        supabase
          .from('parkings')
          .select(
            'id, slug, name, residence_name, tower, level, slot_label, parking_type, rate_per_night, settings, created_at'
          )
          .eq('status', 'ACTIVE')
          .order('id')
          .range(from, to)
      );
    }

    const allGroups = groupRows(rawRows, (row) => {
      if (family === 'parkings') {
        return normalizeCityPlace(readSettingsString(row.settings, 'city'));
      }
      if (family === 'properties') {
        return propertyPlaceLabel(row);
      }
      return normalizeCityPlace(row.city);
    });
    const selectedGroups = allGroups.slice(groupOffset, groupOffset + groupLimit);
    const previewRows = selectedGroups.flatMap((group) => group.rows.slice(0, previewSize));
    const previewIds = previewRows.map((row) => row.id);
    const previewById = new Map<string, Record<string, unknown>>();

    if (family === 'properties') {
      const [priceById, reviewById, superhostById] = await Promise.all([
        batchLoadPropertyPricing(previewIds),
        batchLoadReviewStats(previewIds),
        batchLoadIsSuperhostByPropertyId(supabase, previewIds),
      ]);
      const residenceNames = [
        ...new Set(
          previewRows
            .map((row) => (typeof row.residence_name === 'string' ? row.residence_name.trim() : ''))
            .filter(Boolean)
        ),
      ];
      const developmentByName = new Map<string, { slug: string; name: string }>();
      if (residenceNames.length > 0) {
        const { data: developmentRows, error } = await supabase
          .from('developments')
          .select('slug, name')
          .eq('status', 'ACTIVE')
          .in('name', residenceNames);
        if (error) throw error;
        for (const development of developmentRows ?? []) {
          const name = (development.name as string | null)?.trim();
          const slug = (development.slug as string | null)?.trim();
          if (name && slug) developmentByName.set(name.toLowerCase(), { name, slug });
        }
      }

      for (const row of previewRows) {
        const settings = asSettings(row.settings);
        const residenceName =
          typeof row.residence_name === 'string' ? row.residence_name.trim() : '';
        const development = residenceName
          ? developmentByName.get(residenceName.toLowerCase())
          : undefined;
        const reviews = reviewById.get(row.id) ?? { rating: null, reviewCount: 0 };
        const summary = mapPropertySearchSummary(
          {
            id: row.id,
            slug: String(row.slug ?? ''),
            name: String(row.name ?? ''),
            type: String(row.type ?? ''),
            city: (row.city as string | null) ?? null,
            residence_name: residenceName || null,
            max_guests: (row.max_guests as number | null) ?? null,
            settings: row.settings,
          },
          {
            price: priceById.get(row.id) ?? 2799,
            rating: reviews.rating,
            reviewCount: reviews.reviewCount,
          }
        );
        const createdAt = typeof row.created_at === 'string' ? row.created_at : '';
        const createdMs = Date.parse(createdAt);
        previewById.set(row.id, {
          id: summary.id,
          slug: summary.slug,
          name: summary.name,
          type: propertyTypeLabel(summary.type),
          location: summary.locationLabel,
          price: summary.price ?? 2799,
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
          isNew: Number.isFinite(createdMs) && createdMs >= Date.now() - 30 * 24 * 60 * 60 * 1000,
          developmentSlug: development?.slug,
          developmentName: (development?.name ?? residenceName) || undefined,
          tower: (row.tower as string | null) ?? undefined,
          unitNumber: (row.unit_number as string | null) ?? undefined,
          createdAt,
          latitude: summary.latitude,
          longitude: summary.longitude,
        });
      }
    } else if (family === 'developments') {
      const names = previewRows.map((row) => String(row.name ?? '')).filter(Boolean);
      const propertyCountByName = new Map<string, number>();
      if (names.length > 0) {
        const { data: propertyRows, error } = await supabase
          .from('properties')
          .select('residence_name')
          .eq('status', 'ACTIVE')
          .in('residence_name', names);
        if (error) throw error;
        for (const property of propertyRows ?? []) {
          const name = (property.residence_name as string | null)?.trim();
          if (!name) continue;
          const key = name.toLowerCase();
          propertyCountByName.set(key, (propertyCountByName.get(key) ?? 0) + 1);
        }
      }

      for (const row of previewRows) {
        const settings = asSettings(row.settings);
        const name = String(row.name ?? '');
        const priceMin = readNumber(settings, 'priceRangeMin') ?? 0;
        const priceMax = readNumber(settings, 'priceRangeMax') ?? priceMin;
        const createdAt = typeof row.created_at === 'string' ? row.created_at : '';
        const createdYear = Number.parseInt(createdAt.slice(0, 4), 10);
        const summary = mapDevelopmentSearchSummary(
          {
            id: row.id,
            slug: String(row.slug ?? ''),
            name,
            type: String(row.type ?? ''),
            city: (row.city as string | null) ?? null,
            location: (row.location as string | null) ?? null,
            developer_name: (row.developer_name as string | null) ?? null,
            cover_image_url: (row.cover_image_url as string | null) ?? null,
            settings: row.settings,
          },
          propertyCountByName.get(name.toLowerCase()) ?? 0
        );
        previewById.set(row.id, {
          id: summary.id,
          slug: summary.slug,
          name: summary.name,
          developerName: summary.developerName ?? '',
          type: String(row.type ?? ''),
          location: summary.location ?? summary.locationLabel,
          city: summary.city ?? '',
          description: (row.description as string | null) ?? '',
          coverImage: summary.coverImage ?? '',
          images:
            summary.images.length > 0
              ? summary.images
              : summary.coverImage
                ? [summary.coverImage]
                : [],
          amenities: readStringArray(settings, 'amenities'),
          propertyCount: summary.propertyCount,
          priceRange: {
            min: summary.priceRangeMin ?? priceMin,
            max: summary.priceRangeMax ?? priceMax,
          },
          established:
            readNumber(settings, 'established') ??
            (Number.isFinite(createdYear) ? createdYear : undefined),
          propertyIds: [],
          latitude: summary.latitude,
          longitude: summary.longitude,
        });
      }
    } else {
      const residenceNames = [
        ...new Set(
          previewRows
            .map((row) => (typeof row.residence_name === 'string' ? row.residence_name.trim() : ''))
            .filter(Boolean)
        ),
      ];
      const developmentByName = new Map<string, { slug: string; name: string }>();
      if (residenceNames.length > 0) {
        const { data: developmentRows, error } = await supabase
          .from('developments')
          .select('slug, name')
          .eq('status', 'ACTIVE')
          .in('name', residenceNames);
        if (error) throw error;
        for (const development of developmentRows ?? []) {
          const name = (development.name as string | null)?.trim();
          const slug = (development.slug as string | null)?.trim();
          if (name && slug) developmentByName.set(name.toLowerCase(), { name, slug });
        }
      }

      for (const row of previewRows) {
        const residenceName =
          typeof row.residence_name === 'string' ? row.residence_name.trim() : '';
        const development = residenceName
          ? developmentByName.get(residenceName.toLowerCase())
          : undefined;
        const summary = mapParkingSearchSummary({
          id: row.id,
          slug: String(row.slug ?? ''),
          name: String(row.name ?? ''),
          residence_name: residenceName || null,
          tower: (row.tower as string | null) ?? null,
          level: (row.level as string | null) ?? null,
          slot_label: String(row.slot_label ?? ''),
          parking_type: String(row.parking_type ?? ''),
          rate_per_night: (row.rate_per_night as number | null) ?? null,
          settings: row.settings,
        });
        previewById.set(row.id, {
          id: summary.id,
          slug: summary.slug,
          name: summary.name,
          parkingType: summary.parkingType,
          tower: summary.tower ?? undefined,
          level: summary.level ?? undefined,
          slotLabel: summary.slotLabel,
          ratePerNight: summary.ratePerNight ?? 0,
          features: summary.features,
          coverImage: summary.coverImage ?? undefined,
          residenceName: summary.residenceName ?? undefined,
          city: summary.city ?? undefined,
          developmentSlug: development?.slug,
          developmentName: (development?.name ?? residenceName) || undefined,
          latitude: summary.latitude,
          longitude: summary.longitude,
        });
      }
    }

    const groups = selectedGroups.map((group) => ({
      place: group.place,
      locationSlug: toLocationSlug(group.place),
      title: titleForFamily(family, group.place),
      total: group.rows.length,
      preview: group.rows
        .slice(0, previewSize)
        .map((row) => previewById.get(row.id))
        .filter((row): row is Record<string, unknown> => Boolean(row)),
    }));

    return jsonResponse(
      req,
      {
        success: true,
        groups,
        total: rawRows.length,
        groupTotal: allGroups.length,
        groupOffset,
        groupLimit,
        previewSize,
      },
      200,
      'publicDynamic'
    );
  } catch (error) {
    console.error('[list-public-place-groups]', error);
    return jsonError(req, 'Failed to list places', 500);
  }
});
