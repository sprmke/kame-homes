/** Shared map marker shape for listing map view (properties / developments / parkings). */

export type ListingMapMarker = {
  id: string;
  slug: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  /** Primary metric shown on the pin (nightly price, min price, rate). */
  price: number | null;
  rating?: number | null;
  images?: string[];
  href: string;
  /** Noun for count badge — "property" / "development" / "parking" */
  family: 'property' | 'development' | 'parking';
};

export type MapBbox = {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
};

export function formatMapPinLabel(price: number | null, fallbackName: string): string {
  if (price != null && Number.isFinite(price) && price > 0) {
    if (price >= 1000) {
      const k = price / 1000;
      const rounded = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
      return `₱${rounded}k`;
    }
    return `₱${Math.round(price)}`;
  }
  const trimmed = fallbackName.trim();
  if (trimmed.length <= 12) return trimmed || '·';
  return `${trimmed.slice(0, 11)}…`;
}

export function markersFromCoords<
  T extends { id: string; latitude?: number | null; longitude?: number | null },
>(
  rows: T[],
  mapRow: (row: T & { latitude: number; longitude: number }) => ListingMapMarker
): ListingMapMarker[] {
  const out: ListingMapMarker[] = [];
  for (const row of rows) {
    const lat = row.latitude;
    const lng = row.longitude;
    if (typeof lat !== 'number' || !Number.isFinite(lat)) continue;
    if (typeof lng !== 'number' || !Number.isFinite(lng)) continue;
    out.push(mapRow({ ...row, latitude: lat, longitude: lng }));
  }
  return out;
}

export function bboxToSearchParams(bbox: MapBbox): Record<string, string> {
  return {
    swLat: String(bbox.swLat),
    swLng: String(bbox.swLng),
    neLat: String(bbox.neLat),
    neLng: String(bbox.neLng),
  };
}

export function parseBboxFromSearchParams(sp: URLSearchParams): MapBbox | null {
  const raw = ['swLat', 'swLng', 'neLat', 'neLng'].map((key) => sp.get(key));
  // A missing param coerces to 0, which would read as a valid box off West Africa.
  if (raw.some((value) => value == null || value.trim() === '')) return null;

  const [swLat, swLng, neLat, neLng] = raw.map(Number) as [number, number, number, number];
  if (![swLat, swLng, neLat, neLng].every((n) => Number.isFinite(n))) return null;
  if (Math.abs(swLat) > 90 || Math.abs(neLat) > 90) return null;
  if (Math.abs(swLng) > 180 || Math.abs(neLng) > 180) return null;
  // A box with no area frames nothing; the result set should own the viewport instead.
  if (swLat >= neLat || swLng === neLng) return null;

  return { swLat, swLng, neLat, neLng };
}
