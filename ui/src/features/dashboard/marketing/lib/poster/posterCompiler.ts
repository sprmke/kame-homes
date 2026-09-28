import {
  resetIds,
  type PolotnoDesignDocument,
} from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import {
  POSTER_ARCHETYPES,
  type PosterPhoto,
} from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import { derivePosterPalette } from '@/features/dashboard/marketing/lib/poster/posterColor';
import { POSTER_FONT_PAIRINGS } from '@/features/dashboard/marketing/lib/poster/posterFonts';
import { createPosterCanvas } from '@/features/dashboard/marketing/lib/poster/posterModules';
import type { PosterFacts, PosterSpec } from '@/features/dashboard/marketing/lib/poster/posterSpec';
import {
  DESIGN_FORMAT_DIMENSIONS,
  type DesignTemplateFormat,
} from '@/features/dashboard/marketing/lib/templateRegistry';

export type PhotoSizeMap = Record<string, { width: number; height: number } | undefined>;

function pageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `page-${crypto.randomUUID()}`;
  }
  return `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * PosterSpec + facts → an ordinary editable Polotno document. Deterministic: the
 * same inputs always produce the same layout, which keeps variants reproducible and
 * lets "Shuffle style" re-compile without another AI call.
 */
export function compilePosterDocument(
  spec: PosterSpec,
  facts: PosterFacts,
  format: DesignTemplateFormat,
  options?: { photoSizes?: PhotoSizeMap; brandColor?: string | null }
): PolotnoDesignDocument {
  const { width, height } = DESIGN_FORMAT_DIMENSIONS[format];
  const canvas = createPosterCanvas(width, height);
  const photos: PosterPhoto[] = spec.photoIndexes
    .map((index) => facts.photos[index])
    .filter((url): url is string => Boolean(url))
    .map((url) => ({ url, size: options?.photoSizes?.[url] ?? null }));
  // Every photo-led archetype needs a photo; the type-only layout is the safe fallback.
  const archetype = photos.length > 0 ? spec.archetype : 'minimal-title';
  const palette = derivePosterPalette({
    accent: spec.palette.accent ?? options?.brandColor ?? null,
    secondary: spec.palette.secondary,
    field: spec.palette.field,
  });

  resetIds();
  const result = POSTER_ARCHETYPES[archetype]({
    canvas,
    spec: { ...spec, archetype },
    facts,
    fonts: POSTER_FONT_PAIRINGS[spec.fontPairing],
    palette,
    photos,
  });

  return {
    width,
    height,
    schemaVersion: 2,
    fonts: [],
    custom: { templateId: '', aiGenerated: true, poster: { spec, archetype } },
    pages: [{ id: pageId(), background: result.background, children: result.children }],
  };
}
