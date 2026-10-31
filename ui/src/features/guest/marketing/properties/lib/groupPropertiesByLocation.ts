import { toLocationSlug } from '@/features/guest/marketing/shared/lib/locationSlug';

import type { Property } from '../components/PropertyCard';

export interface PropertyLocationGroup {
  place: string;
  /** URL segment for `/properties/in/:location` */
  locationSlug: string;
  title: string;
  properties: Property[];
}

/**
 * Derive a place label from a property `location` string for grouping.
 * Examples: "Tagaytay, Cavite" → "Tagaytay"; "Makati City, Metro Manila" → "Makati";
 * "Bonifacio Global City, Taguig" → "Taguig".
 */
export function placeLabelFromPropertyLocation(location: string): string {
  const parts = location
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return 'Other';

  const primary = parts[0] ?? 'Other';
  const secondary = parts[1];

  if (secondary && /bonifacio|fort bonifacio|\bbgc\b/i.test(primary)) {
    return secondary.replace(/\s+City$/i, '').trim() || secondary;
  }

  return primary.replace(/\s+City$/i, '').trim() || primary;
}

export function findPlaceByLocationSlug(
  locationSlug: string,
  properties: Property[]
): string | null {
  const needle = locationSlug.trim().toLowerCase();
  if (!needle) return null;

  for (const property of properties) {
    const place = placeLabelFromPropertyLocation(property.location);
    if (toLocationSlug(place) === needle) return place;
  }
  return null;
}

export function filterPropertiesByLocationSlug(
  properties: Property[],
  locationSlug: string
): Property[] {
  const place = findPlaceByLocationSlug(locationSlug, properties);
  if (!place) return [];
  return properties.filter((p) => placeLabelFromPropertyLocation(p.location) === place);
}

/** Group properties by place for Airbnb-style location rows. */
export function groupPropertiesByLocation(properties: Property[]): PropertyLocationGroup[] {
  const byPlace = new Map<string, Property[]>();

  for (const property of properties) {
    const place = placeLabelFromPropertyLocation(property.location);
    const existing = byPlace.get(place);
    if (existing) {
      existing.push(property);
    } else {
      byPlace.set(place, [property]);
    }
  }

  return Array.from(byPlace.entries())
    .map(([place, items]) => ({
      place,
      locationSlug: toLocationSlug(place),
      title: `Homes in ${place}`,
      properties: items,
    }))
    .sort((a, b) => b.properties.length - a.properties.length || a.place.localeCompare(b.place));
}
