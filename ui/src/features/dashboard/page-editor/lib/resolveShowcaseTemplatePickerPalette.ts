import type { ShowcaseMediaPalette } from '@/features/guest/marketing/showcase/lib/showcaseMediaPalette';
import { resolveAccentOptionPreview } from '@/features/guest/marketing/showcase/lib/showcasePalettePreview';
import {
  resolveShowcasePaletteAccent,
  resolveShowcasePaletteSurface,
} from '@/features/guest/marketing/showcase/lib/showcasePaletteSurfaces';
import type { ShowcaseVariant } from '@/features/guest/marketing/showcase/lib/showcaseThemeTokens';
import type { PropertyShowcaseConfig } from '@/features/guest/marketing/showcase/types/showcase';

import { resolveOrgBrandHex } from '@/lib/theme/brandColor';

export type ShowcaseTemplatePickerPalette = {
  surface: string;
  accent: string;
  ink: string;
  muted: string;
  hero: string;
  onAccent: string;
  border: string;
};

function hslToken(components: string): string {
  return `hsl(${components})`;
}

function variantDefaults(variant: ShowcaseVariant, accent: string): ShowcaseTemplatePickerPalette {
  switch (variant) {
    case 'monolith':
      return {
        surface: '#fafaf9',
        accent,
        ink: '#0a0a0a',
        muted: '#737373',
        hero: '#171717',
        onAccent: '#fafaf9',
        border: '#0a0a0a',
      };
    case 'editorial':
      return {
        surface: '#f7f3ec',
        accent,
        ink: '#1c1917',
        muted: '#78716c',
        hero: '#d6cfc4',
        onAccent: '#f7f3ec',
        border: '#1c1917',
      };
    case 'verso':
      return {
        surface: '#0b0b0c',
        accent,
        ink: '#f4f4f2',
        muted: '#a1a1aa',
        hero: '#3f3f46',
        onAccent: '#0b0b0c',
        border: '#f4f4f2',
      };
    case 'atlas':
      return {
        surface: '#0f1614',
        accent,
        ink: '#eef1f2',
        muted: '#94a3a8',
        hero: '#1e2930',
        onAccent: '#0f1614',
        border: 'color-mix(in srgb, var(--tp-accent) 45%, transparent)',
      };
    case 'haven':
      return {
        surface: '#fbf7f1',
        accent,
        ink: '#2c2622',
        muted: '#8a8178',
        hero: '#e8dfd3',
        onAccent: '#fbf7f1',
        border: 'color-mix(in srgb, var(--tp-ink) 12%, transparent)',
      };
    case 'aurora':
    default:
      return {
        surface: '#ffffff',
        accent,
        ink: '#0f172a',
        muted: '#64748b',
        hero: '#334155',
        onAccent: '#ffffff',
        border: 'color-mix(in srgb, var(--tp-ink) 10%, transparent)',
      };
  }
}

export function resolveShowcaseTemplatePickerPalette(
  variant: ShowcaseVariant,
  palette: PropertyShowcaseConfig['palette'],
  brandColor: string | null | undefined,
  mediaPalette: ShowcaseMediaPalette | null
): ShowcaseTemplatePickerPalette {
  const brandHex = resolveOrgBrandHex(brandColor);
  const brandAccent = resolveAccentOptionPreview(palette.accent, brandColor, palette.customAccent);

  const accent = resolveShowcasePaletteAccent(
    palette.mode,
    'light',
    brandAccent,
    mediaPalette,
    brandHex,
    palette.customPaletteBase
  );

  const defaults = variantDefaults(variant, accent);
  const customSurface = resolveShowcasePaletteSurface(
    palette.mode,
    'light',
    mediaPalette,
    brandHex,
    palette.customPaletteBase
  );

  if (!customSurface) {
    return defaults;
  }

  const surface = hslToken(customSurface);
  const lightnessMatch = customSurface.match(/([\d.]+)%\s*$/);
  const isLightSurface = lightnessMatch ? Number(lightnessMatch[1]) >= 52 : true;
  const needsLightSurfaceInk =
    isLightSurface && (variant === 'verso' || variant === 'atlas' || variant === 'monolith');

  return {
    ...defaults,
    surface,
    ...(needsLightSurfaceInk
      ? {
          ink: '#0f172a',
          muted: '#64748b',
          hero: `color-mix(in srgb, var(--tp-accent) 22%, #334155)`,
          border: 'color-mix(in srgb, var(--tp-ink) 10%, transparent)',
        }
      : {}),
  };
}
