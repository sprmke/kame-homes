import {
  normalizeCityPlace,
  toLocationSlug,
} from '@/features/guest/marketing/shared/lib/locationSlug';

import type { ParkingListEntry } from './parkingListEntries';

export interface ParkingLocationGroup {
  city: string;
  /** URL segment for `/parkings/in/:location` */
  locationSlug: string;
  title: string;
  entries: ParkingListEntry[];
}

export function findCityByLocationSlug(
  locationSlug: string,
  entries: ParkingListEntry[]
): string | null {
  const needle = locationSlug.trim().toLowerCase();
  if (!needle) return null;

  for (const entry of entries) {
    const city = normalizeCityPlace(entry.city);
    if (toLocationSlug(city) === needle) return city;
  }

  return null;
}

export function filterParkingEntriesByLocationSlug(
  entries: ParkingListEntry[],
  locationSlug: string
): ParkingListEntry[] {
  const city = findCityByLocationSlug(locationSlug, entries);
  if (!city) return [];
  return entries.filter((entry) => normalizeCityPlace(entry.city) === city);
}

/** Group parking slots by city for Airbnb-style location rows. */
export function groupParkingsByLocation(entries: ParkingListEntry[]): ParkingLocationGroup[] {
  const byCity = new Map<string, ParkingListEntry[]>();

  for (const entry of entries) {
    const city = normalizeCityPlace(entry.city);
    const existing = byCity.get(city);
    if (existing) {
      existing.push(entry);
    } else {
      byCity.set(city, [entry]);
    }
  }

  return Array.from(byCity.entries())
    .map(([city, items]) => ({
      city,
      locationSlug: toLocationSlug(city),
      title: `Parking in ${city}`,
      entries: items,
    }))
    .sort((a, b) => b.entries.length - a.entries.length || a.city.localeCompare(b.city));
}
