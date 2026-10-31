import type { Development } from '@/features/guest/marketing/developments/types';
import type { Property } from '@/features/guest/marketing/properties/components/PropertyCard';

export interface PropertyDevelopmentGroup {
  development: Development;
  title: string;
  /** Path for row title — development detail page */
  viewAllTo: string;
  properties: Property[];
}

function propertyBelongsToDevelopment(property: Property, development: Development): boolean {
  if (property.developmentSlug && property.developmentSlug === development.slug) {
    return true;
  }
  return development.propertyIds.includes(property.id);
}

/** Collect unique properties for a development from the catalog. */
export function propertiesForDevelopment(
  development: Development,
  properties: Property[]
): Property[] {
  const seen = new Set<string>();
  const matched: Property[] = [];

  for (const property of properties) {
    if (!propertyBelongsToDevelopment(property, development)) continue;
    if (seen.has(property.id)) continue;
    seen.add(property.id);
    matched.push(property);
  }

  return matched;
}

/**
 * Group properties under each development (skips developments with no matching units).
 * Used on `/developments/in/:location`.
 */
export function groupPropertiesByDevelopment(
  developments: Development[],
  properties: Property[]
): PropertyDevelopmentGroup[] {
  const groups: PropertyDevelopmentGroup[] = [];

  for (const development of developments) {
    const matched = propertiesForDevelopment(development, properties);
    if (matched.length === 0) continue;

    groups.push({
      development,
      title: development.name,
      viewAllTo: `/developments/${development.slug}`,
      properties: matched,
    });
  }

  return groups.sort(
    (a, b) =>
      b.properties.length - a.properties.length ||
      (b.development.rating ?? 0) - (a.development.rating ?? 0) ||
      a.title.localeCompare(b.title)
  );
}
