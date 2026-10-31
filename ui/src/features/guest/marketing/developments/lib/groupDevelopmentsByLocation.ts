import {
  normalizeCityPlace,
  toLocationSlug,
} from '@/features/guest/marketing/shared/lib/locationSlug';

import type { Development } from '../types';

export { toLocationSlug } from '@/features/guest/marketing/shared/lib/locationSlug';

export interface DevelopmentLocationGroup {
  city: string;
  /** URL segment for `/developments/in/:location` */
  locationSlug: string;
  title: string;
  developments: Development[];
}

/** Resolve display city name from a location URL slug, or null if unknown. */
export function findCityByLocationSlug(
  locationSlug: string,
  developments: Development[]
): string | null {
  const needle = locationSlug.trim().toLowerCase();
  if (!needle) return null;

  for (const development of developments) {
    const city = normalizeCityPlace(development.city);
    if (toLocationSlug(city) === needle) return city;
  }
  return null;
}

export function filterDevelopmentsByLocationSlug(
  developments: Development[],
  locationSlug: string
): Development[] {
  const city = findCityByLocationSlug(locationSlug, developments);
  if (!city) return [];
  return developments.filter((d) => normalizeCityPlace(d.city) === city);
}

/** Group developments by city for Airbnb-style location rows. */
export function groupDevelopmentsByLocation(
  developments: Development[]
): DevelopmentLocationGroup[] {
  const byCity = new Map<string, Development[]>();

  for (const development of developments) {
    const city = normalizeCityPlace(development.city);
    const existing = byCity.get(city);
    if (existing) {
      existing.push(development);
    } else {
      byCity.set(city, [development]);
    }
  }

  return Array.from(byCity.entries())
    .map(([city, items]) => ({
      city,
      locationSlug: toLocationSlug(city),
      title: `Developments in ${city}`,
      developments: items,
    }))
    .sort((a, b) => b.developments.length - a.developments.length || a.city.localeCompare(b.city));
}
