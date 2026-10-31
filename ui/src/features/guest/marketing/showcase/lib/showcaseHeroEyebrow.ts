import type { ResolvedPropertyDetail } from '@/features/guest/marketing/properties/types/publicProperty';
import type { ShowcaseTextSourceConfig } from '@/features/guest/marketing/showcase/types/showcase';

const CONDO_LIKE_TYPES = new Set(['condo', 'condominium', 'apartment', 'apt']);

export function showcasePropertyHasDevelopment(property: {
  type?: string | null;
  residenceName?: string | null;
  developmentSlug?: string | null;
}): boolean {
  const type = property.type?.trim().toLowerCase() ?? '';
  const condoLike = CONDO_LIKE_TYPES.has(type);
  const hasDev = Boolean(property.residenceName?.trim() || property.developmentSlug?.trim());
  return condoLike && hasDev;
}

export function normalizeShowcaseTextSource(raw: unknown): ShowcaseTextSourceConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as { source?: unknown; customText?: unknown };
  const source =
    obj.source === 'development' || obj.source === 'custom' || obj.source === 'location'
      ? obj.source
      : null;
  if (!source) return undefined;
  const customText =
    typeof obj.customText === 'string' ? obj.customText.trim().slice(0, 120) : undefined;
  if (source === 'location') {
    return customText ? { source: 'location', customText } : { source: 'location' };
  }
  if (source === 'custom') {
    return { source: 'custom', customText: customText || undefined };
  }
  if (source === 'development') return { source: 'development' };
  return { source: 'location' };
}

/** @deprecated Use normalizeShowcaseTextSource */
export const normalizeShowcaseHeroEyebrow = normalizeShowcaseTextSource;

/** Default text source when the section config leaves `source` unset. */
export function defaultShowcaseTextSource(property: {
  type?: string | null;
  residenceName?: string | null;
  developmentSlug?: string | null;
}): ShowcaseTextSourceConfig['source'] {
  return showcasePropertyHasDevelopment(property) ? 'development' : 'location';
}

/**
 * Resolve a location / development / custom line.
 * `locationFallback` is the default when source is location (or when other sources are missing).
 */
export function resolveShowcaseTextSource(
  property: ResolvedPropertyDetail,
  locationFallback: string,
  config: ShowcaseTextSourceConfig | undefined
): string {
  const source = config?.source ?? defaultShowcaseTextSource(property);
  const location = locationFallback.trim();

  if (source === 'custom') {
    const custom = config?.customText?.trim();
    return custom || location;
  }

  if (source === 'development') {
    const development = property.residenceName?.trim();
    if (development && showcasePropertyHasDevelopment(property)) return development;
    return location;
  }

  return location;
}

/** Resolve the line above the hero heading. */
export function resolveShowcaseHeroEyebrow(
  property: ResolvedPropertyDetail,
  locationLabel: string,
  config: ShowcaseTextSourceConfig | undefined
): string {
  return resolveShowcaseTextSource(property, locationLabel, config);
}

/** Resolve the primary line under the Location section heading. */
export function resolveShowcaseLocationLead(
  property: ResolvedPropertyDetail,
  areaLabel: string,
  config: ShowcaseTextSourceConfig | undefined
): string {
  return resolveShowcaseTextSource(property, areaLabel, config);
}
