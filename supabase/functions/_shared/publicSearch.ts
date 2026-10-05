/**
 * Shared DTO builders + text match helpers for public search endpoints.
 * Keep summary shapes filter-ready (type, bedrooms, price fields) so smart-filters
 * can layer facets/sort without reshaping search-listings responses.
 */

import { resolveListingCoords } from './publicGeoScope.ts';

export type SearchSuggestionKind = 'location' | 'development' | 'property' | 'parking';

export type SearchSuggestionItem = {
  kind: SearchSuggestionKind;
  id: string;
  label: string;
  subtitle: string;
  /** Deep-link slug when kind is property | development | parking */
  slug?: string;
  /** Plain location string when kind is location */
  city?: string;
};

export type PropertySearchSummary = {
  id: string;
  slug: string;
  name: string;
  type: string;
  city: string | null;
  locationLabel: string;
  residenceName: string | null;
  coverImage: string | null;
  images: string[];
  maxGuests: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price: number | null;
  rating: number | null;
  reviewCount: number;
  amenities: string[];
  latitude: number | null;
  longitude: number | null;
};

export type DevelopmentSearchSummary = {
  id: string;
  slug: string;
  name: string;
  type: string;
  city: string | null;
  location: string | null;
  locationLabel: string;
  coverImage: string | null;
  images: string[];
  developerName: string | null;
  priceRangeMin: number | null;
  priceRangeMax: number | null;
  propertyCount: number;
  latitude: number | null;
  longitude: number | null;
};

export type ParkingSearchSummary = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  locationLabel: string;
  residenceName: string | null;
  tower: string | null;
  level: string | null;
  slotLabel: string;
  parkingType: string;
  coverImage: string | null;
  images: string[];
  ratePerNight: number | null;
  features: string[];
  latitude: number | null;
  longitude: number | null;
};

export function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * `%…%` ilike value safe inside PostgREST `.or()` / `.and()` logic trees.
 * Commas (e.g. "Manila, Philippines") and other reserved chars must be double-quoted.
 */
export function postgrestOrIlikeValue(raw: string): string {
  const pattern = `%${escapeIlikePattern(raw)}%`;
  return `"${pattern.replace(/"/g, '""')}"`;
}

/** Case-insensitive exact-match ilike value for PostgREST `.or()` trees (no wildcards). */
export function postgrestOrIlikeExactValue(raw: string): string {
  return `"${escapeIlikePattern(raw).replace(/"/g, '""')}"`;
}

export function rankTextMatch(query: string, ...fields: Array<string | null | undefined>): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  let best = 0;
  for (const field of fields) {
    const value = (field ?? '').trim().toLowerCase();
    if (!value) continue;
    if (value === q) best = Math.max(best, 100);
    else if (value.startsWith(q)) best = Math.max(best, 80);
    else if (value.split(/[\s,/-]+/).some((token) => token.startsWith(q))) {
      // "San Fernando" for "san", "Azure North Condo" for "condo"
      best = Math.max(best, 70);
    } else if (value.includes(q)) best = Math.max(best, 50);
  }
  return best;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === 'string' ? value.trim() : '';
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

function firstImageFromSettings(settings: Record<string, unknown>): {
  coverImage: string | null;
  images: string[];
} {
  const media = settings.media;
  const images: string[] = [];
  if (Array.isArray(media)) {
    for (const item of media) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;
      const url = typeof record.url === 'string' ? record.url.trim() : '';
      const type = typeof record.type === 'string' ? record.type : 'image';
      if (url && type !== 'video') images.push(url);
    }
  }
  const settingsImages = readStringArray(settings, 'images');
  for (const url of settingsImages) {
    if (!images.includes(url)) images.push(url);
  }
  const cover =
    readString(settings, 'coverImage') ||
    (typeof settings.cover_image_url === 'string' ? settings.cover_image_url.trim() : '') ||
    images[0] ||
    null;
  return { coverImage: cover || null, images };
}

function buildLocationLabel(city: string | null, fallback?: string | null): string {
  const parts = [city, fallback].filter((part) => Boolean(part && String(part).trim()));
  return parts.length > 0 ? parts.join(', ') : 'Philippines';
}

export function mapPropertySearchSummary(
  row: {
    id: string;
    slug: string;
    name: string;
    type: string;
    city: string | null;
    residence_name: string | null;
    max_guests: number | null;
    settings: unknown;
  },
  extras?: { price?: number | null; rating?: number | null; reviewCount?: number }
): PropertySearchSummary {
  const settings = asRecord(row.settings);
  const city = (row.city ?? readString(settings, 'city')) || null;
  const { coverImage, images } = firstImageFromSettings(settings);
  const maxAdults = readNumber(settings, 'maxAdults');
  const maxChildren = readNumber(settings, 'maxChildren') ?? 0;
  const maxGuests =
    row.max_guests && row.max_guests > 0
      ? row.max_guests
      : maxAdults != null
        ? Math.max(maxAdults + Math.max(maxChildren, 0), 1)
        : null;
  const coords = resolveListingCoords(row.settings, row.residence_name);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    city,
    locationLabel: buildLocationLabel(city, row.residence_name),
    residenceName: row.residence_name,
    coverImage,
    images,
    maxGuests,
    bedrooms: readNumber(settings, 'bedrooms'),
    bathrooms: readNumber(settings, 'bathrooms'),
    price: extras?.price ?? null,
    rating: extras?.rating ?? null,
    reviewCount: extras?.reviewCount ?? 0,
    amenities: readStringArray(settings, 'enabledAmenities'),
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
  };
}

export function mapDevelopmentSearchSummary(
  row: {
    id: string;
    slug: string;
    name: string;
    type: string;
    city: string | null;
    location: string | null;
    developer_name: string | null;
    cover_image_url: string | null;
    settings: unknown;
  },
  propertyCount = 0
): DevelopmentSearchSummary {
  const settings = asRecord(row.settings);
  const images = readStringArray(settings, 'images');
  const coverImage = row.cover_image_url || images[0] || null;
  const coords = resolveListingCoords(row.settings, row.name);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    city: row.city,
    location: row.location,
    locationLabel: row.location || buildLocationLabel(row.city),
    coverImage,
    images: coverImage && !images.includes(coverImage) ? [coverImage, ...images] : images,
    developerName: row.developer_name,
    priceRangeMin: readNumber(settings, 'priceRangeMin'),
    priceRangeMax: readNumber(settings, 'priceRangeMax'),
    propertyCount,
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
  };
}

export function mapParkingSearchSummary(row: {
  id: string;
  slug: string;
  name: string;
  residence_name: string | null;
  tower: string | null;
  level: string | null;
  slot_label: string;
  parking_type: string;
  rate_per_night: number | null;
  settings: unknown;
}): ParkingSearchSummary {
  const settings = asRecord(row.settings);
  const city = readString(settings, 'city') || null;
  const { coverImage, images } = firstImageFromSettings(settings);
  const rateFromSettings = readNumber(settings, 'ratePerNight');
  const coords = resolveListingCoords(row.settings, row.residence_name);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city,
    locationLabel: buildLocationLabel(city, row.residence_name),
    residenceName: row.residence_name,
    tower: row.tower,
    level: row.level,
    slotLabel: row.slot_label,
    parkingType: row.parking_type,
    coverImage,
    images,
    ratePerNight: row.rate_per_night != null ? Number(row.rate_per_night) : rateFromSettings,
    features: readStringArray(settings, 'features'),
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
  };
}

/** Capacity check aligned with publicPropertyService (adults+children vs max_guests / settings). */
export function propertyFitsGuestCapacity(
  row: { max_guests: number | null; settings: unknown },
  adults: number,
  children: number
): boolean {
  const needed = Math.max(adults, 0) + Math.max(children, 0);
  if (needed <= 0) return true;
  const settings = asRecord(row.settings);
  const maxAdults = readNumber(settings, 'maxAdults');
  const maxChildren = readNumber(settings, 'maxChildren') ?? 0;
  const maxGuests =
    row.max_guests && row.max_guests > 0
      ? row.max_guests
      : maxAdults != null
        ? Math.max(maxAdults + Math.max(maxChildren, 0), 1)
        : null;
  if (maxGuests == null) return true;
  return needed <= maxGuests;
}
