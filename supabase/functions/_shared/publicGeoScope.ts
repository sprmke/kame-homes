/**
 * Geo scoping for public listing endpoints (`list-public-*`).
 *
 * Nearby is an intent, not text: `search-listings` resolves it to lat/lng, so the
 * category endpoints must scope by radius too. Without this a Nearby search that
 * has results on All would return zero the moment a category tab (and its facet
 * sidebar) opened, because "Nearby" is not a place name any row matches.
 *
 * Radius + coordinate resolution mirror `search-listings` so both views agree.
 */

import { AZURE_NORTH_DEFAULT_COORDS, isAzureNorthResidence } from './propertyLocationDefaults.ts';
import { readSettingsCoord } from './searchIntents.ts';

export type GeoOrigin = { lat: number; lng: number };

export type GeoCoords = { lat: number; lng: number };

function asSettingsRecord(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === 'object' && !Array.isArray(settings)
    ? (settings as Record<string, unknown>)
    : {};
}

function parseCoord(raw: string | null): number | null {
  if (raw == null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Guest coords from `?lat=&lng=`; null unless both are usable. */
export function readGeoOrigin(sp: URLSearchParams): GeoOrigin | null {
  const lat = parseCoord(sp.get('lat'));
  const lng = parseCoord(sp.get('lng'));
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

/** Map pin from settings, falling back to the Azure North residence default. */
export function resolveListingCoords(
  settings: unknown,
  residenceName: string | null | undefined
): GeoCoords | null {
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

/** Inclusive map viewport from `?swLat=&swLng=&neLat=&neLng=`. */
export type MapBbox = {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
};

/** Hard cap for map-mode marker payloads (cluster client-side beyond this). */
export const MAP_MARKER_CAP = 200;

export function readMapBbox(sp: URLSearchParams): MapBbox | null {
  const swLat = parseCoord(sp.get('swLat'));
  const swLng = parseCoord(sp.get('swLng'));
  const neLat = parseCoord(sp.get('neLat'));
  const neLng = parseCoord(sp.get('neLng'));
  if (swLat == null || swLng == null || neLat == null || neLng == null) return null;
  if (swLat > neLat) return null;
  return { swLat, swLng, neLat, neLng };
}
