import { mockDevelopments } from '@/features/guest/marketing/developments/data/mockDevelopments';

export type ResolvedPublicDevelopment = {
  slug: string;
  name: string;
  locationLabel: string;
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

/** Map a property/parking `residence_name` (or mock slug hint) to the public development catalog. */
export function resolvePublicDevelopment(
  residenceName: string | null | undefined,
  developmentSlug?: string | null
): ResolvedPublicDevelopment | null {
  if (developmentSlug?.trim()) {
    const bySlug = mockDevelopments.find((entry) => entry.slug === developmentSlug.trim());
    if (bySlug) {
      return {
        slug: bySlug.slug,
        name: bySlug.name,
        locationLabel: bySlug.location,
      };
    }
  }

  const name = residenceName?.trim();
  if (!name) return null;

  const normalized = normalizeName(name);
  const exact = mockDevelopments.find((entry) => normalizeName(entry.name) === normalized);
  if (exact) {
    return { slug: exact.slug, name: exact.name, locationLabel: exact.location };
  }

  const partial = mockDevelopments.find(
    (entry) =>
      normalizeName(entry.name).includes(normalized) ||
      normalized.includes(normalizeName(entry.name))
  );
  if (partial) {
    return { slug: partial.slug, name: partial.name, locationLabel: partial.location };
  }

  return null;
}

export function developmentDetailPath(slug: string): string {
  return `/developments/${encodeURIComponent(slug)}`;
}
