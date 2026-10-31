/**
 * Card payloads for public listing grids (`list-public-*`, `list-public-place-groups`).
 *
 * The search index (`public_listing_search`) decides *which* ids are on a page; these
 * loaders turn exactly those ids into the card shapes the UI renders, preserving the
 * requested order. One mapper per family so browse rows, place rows, and filtered
 * grids never drift apart.
 *
 * Exact unit numbers are not sent on list cards (the UI shows tower + floor on the
 * detail page only).
 *
 * Price / rating / review count come from the index (same values used for filtering,
 * sorting, and facets), so a card can never disagree with the filter that matched it.
 */

import { createServiceClient } from './orgAuth.ts';
import { asSettings, readSettingsString } from './listingPlace.ts';
import { batchLoadIsSuperhostByPropertyId } from './orgSuperhost.ts';
import {
  amenityLabelForId,
  batchCountActivePropertiesByResidence,
  propertyTypeLabel,
} from './publicListingFacets.ts';
import { loadRowsByKeyChunks } from './publicListingRows.ts';
import {
  mapDevelopmentSearchSummary,
  mapParkingSearchSummary,
  mapPropertySearchSummary,
  postgrestOrIlikeExactValue,
  type DevelopmentSearchSummary,
  type ParkingSearchSummary,
  type PropertySearchSummary,
} from './publicSearch.ts';
import { slugifyName } from './slugUtils.ts';

/** Gallery images sent per list card; the detail page loads the full gallery. */
export const MAX_CARD_IMAGES = 5;

const NEW_LISTING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type IndexStats = { price: number; rating: number | null; reviewCount: number };

type DevelopmentLink = { slug: string; name: string };

function capImages(images: string[], cover: string | null): string[] {
  const list = images.length > 0 ? images : cover ? [cover] : [];
  return list.slice(0, MAX_CARD_IMAGES);
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

function orderByIds<T extends { id: string }>(ids: string[], rows: T[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is T => row != null);
}

async function loadIndexStats(
  family: 'property' | 'parking',
  ids: string[]
): Promise<Map<string, IndexStats>> {
  const supabase = createServiceClient();
  const rows = await loadRowsByKeyChunks('listing index stats', ids, (chunk, from, to) =>
    supabase
      .from('public_listing_search')
      .select('id, price, rating, review_count')
      .eq('family', family)
      .in('id', chunk)
      .order('id')
      .range(from, to)
  );
  return new Map(
    rows.map((row) => [
      row.id as string,
      {
        price: Number(row.price),
        rating: row.rating == null ? null : Number(row.rating),
        reviewCount: Number(row.review_count ?? 0),
      },
    ])
  );
}

/** ACTIVE developments keyed by lower-cased trimmed name (highest id wins, like the index join). */
async function loadDevelopmentLinks(names: string[]): Promise<Map<string, DevelopmentLink>> {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const links = new Map<string, DevelopmentLink>();
  if (unique.length === 0) return links;

  const supabase = createServiceClient();
  const rows = await loadRowsByKeyChunks('development links', unique, (chunk, from, to) =>
    supabase
      .from('developments')
      .select('id, slug, name')
      .eq('status', 'ACTIVE')
      .or(chunk.map((name) => `name.ilike.${postgrestOrIlikeExactValue(name)}`).join(','))
      .order('id')
      .range(from, to)
  );
  for (const row of rows) {
    const name = (row.name as string | null)?.trim();
    const slug = (row.slug as string | null)?.trim();
    if (name && slug) links.set(name.toLowerCase(), { slug, name });
  }
  return links;
}

export type PublicPropertyCard = {
  id: string;
  slug: string;
  name: string;
  type: string;
  location: string;
  price: number;
  rating: number | null;
  reviews: number;
  images: string[];
  guests: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  isSuperhost: boolean;
  isNew: boolean;
  developmentSlug?: string;
  developmentName?: string;
  tower?: string;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
};

export async function loadPropertyCards(ids: string[]): Promise<PublicPropertyCard[]> {
  if (ids.length === 0) return [];
  const supabase = createServiceClient();

  const rows = await loadRowsByKeyChunks('property cards', ids, (chunk, from, to) =>
    supabase
      .from('properties')
      .select(
        'id, slug, name, type, city, residence_name, max_guests, tower, settings, created_at'
      )
      .in('id', chunk)
      .order('id')
      .range(from, to)
  );

  const [stats, superhostById, developments] = await Promise.all([
    loadIndexStats('property', ids),
    batchLoadIsSuperhostByPropertyId(supabase, ids),
    loadDevelopmentLinks(rows.map((row) => String(row.residence_name ?? ''))),
  ]);

  const now = Date.now();
  const cards = rows.map((row): PublicPropertyCard => {
    const id = row.id as string;
    const residence = (row.residence_name as string | null)?.trim() || null;
    const development = residence ? developments.get(residence.toLowerCase()) : undefined;
    const stat = stats.get(id) ?? { price: 2799, rating: null, reviewCount: 0 };
    const summary = mapPropertySearchSummary(
      {
        id,
        slug: row.slug as string,
        name: row.name as string,
        type: row.type as string,
        city: (row.city as string | null) ?? null,
        residence_name: residence,
        max_guests: (row.max_guests as number | null) ?? null,
        settings: row.settings,
      },
      { price: stat.price, rating: stat.rating, reviewCount: stat.reviewCount }
    );
    const createdAt = (row.created_at as string) ?? '';
    const createdMs = Date.parse(createdAt);

    return {
      id,
      slug: summary.slug,
      name: summary.name,
      type: propertyTypeLabel(summary.type),
      location: summary.locationLabel,
      price: summary.price ?? stat.price,
      rating: summary.reviewCount > 0 ? summary.rating : null,
      reviews: summary.reviewCount,
      images: capImages(summary.images, summary.coverImage),
      guests: summary.maxGuests ?? 1,
      bedrooms: summary.bedrooms ?? 1,
      bathrooms: summary.bathrooms ?? 1,
      amenities: summary.amenities.map(amenityLabelForId),
      isSuperhost: superhostById.get(id) ?? false,
      isNew: Number.isFinite(createdMs) && createdMs >= now - NEW_LISTING_WINDOW_MS,
      developmentSlug: development?.slug,
      developmentName: (development?.name ?? residence) || undefined,
      tower: (row.tower as string | null) ?? undefined,
      createdAt,
      latitude: summary.latitude,
      longitude: summary.longitude,
    };
  });

  return orderByIds(ids, cards);
}

export type PublicDevelopmentCard = {
  id: string;
  slug: string;
  name: string;
  developerName: string;
  type: string;
  location: string;
  city: string;
  description: string;
  coverImage: string;
  images: string[];
  amenities: string[];
  propertyCount: number;
  priceRange: { min: number; max: number };
  established?: number;
  propertyIds: string[];
  latitude: number | null;
  longitude: number | null;
};

export async function loadDevelopmentCards(ids: string[]): Promise<PublicDevelopmentCard[]> {
  if (ids.length === 0) return [];
  const supabase = createServiceClient();

  const rows = await loadRowsByKeyChunks('development cards', ids, (chunk, from, to) =>
    supabase
      .from('developments')
      .select(
        'id, slug, name, developer_name, type, location, city, description, cover_image_url, settings, created_at'
      )
      .in('id', chunk)
      .order('id')
      .range(from, to)
  );

  const propertyCountByName = await batchCountActivePropertiesByResidence(
    rows.map((row) => String(row.name ?? ''))
  );

  const cards = rows.map((row): PublicDevelopmentCard => {
    const settings = asSettings(row.settings);
    const name = String(row.name ?? '');
    const priceMin = readNumber(settings, 'priceRangeMin') ?? 0;
    const priceMax = readNumber(settings, 'priceRangeMax') ?? priceMin;
    const createdYear = Number.parseInt(String(row.created_at ?? '').slice(0, 4), 10);
    const summary = mapDevelopmentSearchSummary(
      {
        id: row.id as string,
        slug: String(row.slug ?? ''),
        name,
        type: String(row.type ?? ''),
        city: (row.city as string | null) ?? null,
        location: (row.location as string | null) ?? null,
        developer_name: (row.developer_name as string | null) ?? null,
        cover_image_url: (row.cover_image_url as string | null) ?? null,
        settings: row.settings,
      },
      propertyCountByName.get(name.trim().toLowerCase()) ?? 0
    );

    return {
      id: summary.id,
      slug: summary.slug,
      name: summary.name,
      developerName: summary.developerName ?? '',
      type: String(row.type ?? ''),
      location: summary.location ?? summary.locationLabel,
      city: summary.city ?? '',
      description: (row.description as string | null) ?? '',
      coverImage: summary.coverImage ?? '',
      images: capImages(summary.images, summary.coverImage),
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
    };
  });

  return orderByIds(ids, cards);
}

export type PublicParkingCard = {
  id: string;
  slug: string;
  name: string;
  parkingType: string;
  tower?: string;
  level?: string;
  slotLabel: string;
  ratePerNight: number;
  features: string[];
  coverImage?: string;
  residenceName?: string;
  city?: string;
  developmentSlug?: string;
  developmentName?: string;
  latitude: number | null;
  longitude: number | null;
};

export async function loadParkingCards(ids: string[]): Promise<PublicParkingCard[]> {
  if (ids.length === 0) return [];
  const supabase = createServiceClient();

  const rows = await loadRowsByKeyChunks('parking cards', ids, (chunk, from, to) =>
    supabase
      .from('parkings')
      .select(
        'id, slug, name, residence_name, tower, level, slot_label, parking_type, rate_per_night, settings'
      )
      .in('id', chunk)
      .order('id')
      .range(from, to)
  );

  const [stats, developments] = await Promise.all([
    loadIndexStats('parking', ids),
    loadDevelopmentLinks(rows.map((row) => String(row.residence_name ?? ''))),
  ]);

  const cards = rows.map((row): PublicParkingCard => {
    const id = row.id as string;
    const residence = (row.residence_name as string | null)?.trim() || null;
    const development = residence ? developments.get(residence.toLowerCase()) : undefined;
    const summary = mapParkingSearchSummary({
      id,
      slug: String(row.slug ?? ''),
      name: String(row.name ?? ''),
      residence_name: residence,
      tower: (row.tower as string | null) ?? null,
      level: (row.level as string | null) ?? null,
      slot_label: String(row.slot_label ?? ''),
      parking_type: String(row.parking_type ?? ''),
      rate_per_night: row.rate_per_night != null ? Number(row.rate_per_night) : null,
      settings: row.settings,
    });

    return {
      id,
      slug: summary.slug,
      name: summary.name,
      parkingType: summary.parkingType,
      tower: summary.tower ?? undefined,
      level: summary.level ?? undefined,
      slotLabel: summary.slotLabel,
      // Charged rate (parking_settings via the index), so cards match detail + checkout.
      ratePerNight: stats.get(id)?.price ?? summary.ratePerNight ?? 0,
      features: summary.features,
      coverImage: summary.coverImage ?? undefined,
      residenceName: summary.residenceName ?? undefined,
      city: readSettingsString(row.settings, 'city') || undefined,
      developmentSlug: development?.slug ?? (residence ? slugifyName(residence) : undefined),
      developmentName: (development?.name ?? residence) || undefined,
      latitude: summary.latitude,
      longitude: summary.longitude,
    };
  });

  return orderByIds(ids, cards);
}

// ---------------------------------------------------------------------------
// `/search` summaries (search-listings response shape), same id-ordered loading.
// ---------------------------------------------------------------------------

export async function loadPropertySearchSummaries(ids: string[]): Promise<PropertySearchSummary[]> {
  if (ids.length === 0) return [];
  const supabase = createServiceClient();
  const [rows, stats] = await Promise.all([
    loadRowsByKeyChunks('property summaries', ids, (chunk, from, to) =>
      supabase
        .from('properties')
        .select('id, slug, name, type, city, residence_name, max_guests, settings')
        .in('id', chunk)
        .order('id')
        .range(from, to)
    ),
    loadIndexStats('property', ids),
  ]);
  const summaries = rows.map((row) => {
    const stat = stats.get(row.id as string);
    return mapPropertySearchSummary(
      {
        id: row.id as string,
        slug: row.slug as string,
        name: row.name as string,
        type: row.type as string,
        city: (row.city as string | null) ?? null,
        residence_name: (row.residence_name as string | null) ?? null,
        max_guests: (row.max_guests as number | null) ?? null,
        settings: row.settings,
      },
      { price: stat?.price ?? null, rating: stat?.rating ?? null, reviewCount: stat?.reviewCount ?? 0 }
    );
  });
  return orderByIds(ids, summaries);
}

export async function loadDevelopmentSearchSummaries(
  ids: string[]
): Promise<DevelopmentSearchSummary[]> {
  if (ids.length === 0) return [];
  const supabase = createServiceClient();
  const rows = await loadRowsByKeyChunks('development summaries', ids, (chunk, from, to) =>
    supabase
      .from('developments')
      .select('id, slug, name, type, city, location, developer_name, cover_image_url, settings')
      .in('id', chunk)
      .order('id')
      .range(from, to)
  );
  const counts = await batchCountActivePropertiesByResidence(
    rows.map((row) => String(row.name ?? ''))
  );
  const summaries = rows.map((row) =>
    mapDevelopmentSearchSummary(
      {
        id: row.id as string,
        slug: row.slug as string,
        name: row.name as string,
        type: row.type as string,
        city: (row.city as string | null) ?? null,
        location: (row.location as string | null) ?? null,
        developer_name: (row.developer_name as string | null) ?? null,
        cover_image_url: (row.cover_image_url as string | null) ?? null,
        settings: row.settings,
      },
      counts.get(
        String(row.name ?? '')
          .trim()
          .toLowerCase()
      ) ?? 0
    )
  );
  return orderByIds(ids, summaries);
}

export async function loadParkingSearchSummaries(ids: string[]): Promise<ParkingSearchSummary[]> {
  if (ids.length === 0) return [];
  const supabase = createServiceClient();
  const [rows, stats] = await Promise.all([
    loadRowsByKeyChunks('parking summaries', ids, (chunk, from, to) =>
      supabase
        .from('parkings')
        .select(
          'id, slug, name, residence_name, tower, level, slot_label, parking_type, rate_per_night, settings'
        )
        .in('id', chunk)
        .order('id')
        .range(from, to)
    ),
    loadIndexStats('parking', ids),
  ]);
  const summaries = rows.map((row) => {
    const summary = mapParkingSearchSummary({
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      residence_name: (row.residence_name as string | null) ?? null,
      tower: (row.tower as string | null) ?? null,
      level: (row.level as string | null) ?? null,
      slot_label: row.slot_label as string,
      parking_type: row.parking_type as string,
      rate_per_night: row.rate_per_night != null ? Number(row.rate_per_night) : null,
      settings: row.settings,
    });
    // Charged rate, consistent with browse cards and the detail page.
    const charged = stats.get(row.id as string)?.price;
    return charged != null ? { ...summary, ratePerNight: charged } : summary;
  });
  return orderByIds(ids, summaries);
}
