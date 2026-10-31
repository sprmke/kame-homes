import { getGoogleMapsApiKey } from '@/lib/google-maps/useGoogleMapsLoader';

export type PropertyMapEmbedInput = {
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  placeId?: string | null;
  mapsUrl?: string | null;
};

function getGoogleMapsApiKeyLocal(): string {
  return getGoogleMapsApiKey();
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** Parse `query=lat,lng` from saved Google Maps links (property settings). */
export function parseLatLngFromMapsUrl(
  mapsUrl: string
): { latitude: number; longitude: number } | null {
  try {
    const url = new URL(mapsUrl.trim());
    const query = url.searchParams.get('query')?.trim();
    if (!query) return null;
    const match = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(query);
    if (!match) return null;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

function resolveMapCoordinates(input: PropertyMapEmbedInput): {
  latitude: number | null;
  longitude: number | null;
} {
  const lat = readFiniteNumber(input.latitude);
  const lng = readFiniteNumber(input.longitude);
  if (lat != null && lng != null) {
    return { latitude: lat, longitude: lng };
  }

  const fromUrl = input.mapsUrl?.trim() ? parseLatLngFromMapsUrl(input.mapsUrl) : null;
  if (fromUrl) return fromUrl;

  return { latitude: null, longitude: null };
}

function hasCoordinates(latitude?: number | null, longitude?: number | null): latitude is number {
  const lat = readFiniteNumber(latitude);
  const lng = readFiniteNumber(longitude);
  return lat != null && lng != null;
}

/** OpenStreetMap — light Mapnik tiles; no API key. */
export function buildOpenStreetMapEmbedSrc(latitude: number, longitude: number): string {
  const delta = 0.012;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

/** Legacy Google embed — works without Maps Embed API billing product. */
export function buildLegacyGoogleMapEmbedSrc(input: PropertyMapEmbedInput): string | null {
  const coords = resolveMapCoordinates(input);
  const query = hasCoordinates(coords.latitude, coords.longitude)
    ? `${coords.latitude},${coords.longitude}`
    : input.address?.trim() || null;

  if (!query) return null;

  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed&iwloc=near`;
}

/** Google Maps Embed API — use when `VITE_GOOGLE_MAPS_API_KEY` is set (enable Maps Embed API in Cloud Console). */
export function buildGoogleMapsEmbedApiSrc(
  input: PropertyMapEmbedInput,
  apiKey: string
): string | null {
  const key = apiKey.trim();
  if (!key) return null;

  const params = new URLSearchParams({ key });

  if (input.placeId?.trim()) {
    params.set('q', `place_id:${input.placeId.trim()}`);
  } else {
    const coords = resolveMapCoordinates(input);
    if (hasCoordinates(coords.latitude, coords.longitude)) {
      params.set('q', `${coords.latitude},${coords.longitude}`);
    } else if (input.address?.trim()) {
      params.set('q', input.address.trim());
    } else {
      return null;
    }
  }

  params.set('zoom', '15');
  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
}

export function hasPropertyMapCoordinates(
  latitude?: number | null,
  longitude?: number | null
): latitude is number {
  return hasCoordinates(latitude, longitude);
}

export function resolvePropertyMapEmbedSrc(input: PropertyMapEmbedInput): string | null {
  const apiKey = getGoogleMapsApiKeyLocal();
  const fullAddress = input.address?.trim() || null;
  const coords = resolveMapCoordinates(input);

  const normalized: PropertyMapEmbedInput = {
    ...input,
    latitude: coords.latitude,
    longitude: coords.longitude,
    address: fullAddress ?? input.address,
  };

  if (apiKey) {
    const embedApi = buildGoogleMapsEmbedApiSrc(normalized, apiKey);
    if (embedApi) return embedApi;
  }

  const legacyGoogle = buildLegacyGoogleMapEmbedSrc(normalized);
  if (legacyGoogle) return legacyGoogle;

  if (hasCoordinates(normalized.latitude, normalized.longitude)) {
    return buildOpenStreetMapEmbedSrc(normalized.latitude!, normalized.longitude as number);
  }

  return null;
}
