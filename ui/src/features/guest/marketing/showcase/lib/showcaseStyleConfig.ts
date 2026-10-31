import { parseBrandColorHsl } from '@/features/guest/marketing/showcase/lib/showcaseBrandPalette';
import {
  getShowcasePresetPalette,
  isShowcasePresetPaletteId,
} from '@/features/guest/marketing/showcase/lib/showcasePresetPalettes';
import type { PropertyShowcaseConfig } from '@/features/guest/marketing/showcase/types/showcase';

import { hexToHslComponents } from '@/lib/theme/brandColor';

type DisplayFont = PropertyShowcaseConfig['typography']['displayFont'];
type TypeScale = PropertyShowcaseConfig['typography']['scale'];
type MotionIntensity = PropertyShowcaseConfig['motion']['intensity'];
type PaletteOverlay = PropertyShowcaseConfig['palette']['overlay'];

const DISPLAY_FONT_CLASS: Record<DisplayFont, string> = {
  jakarta: 'font-sans',
  outfit: 'font-outfit',
  instrument: 'font-instrument',
  cormorant: 'font-cormorant',
  fraunces: 'font-fraunces',
};

/** Shadcn `--primary` expects space-separated HSL components (no hsl() wrapper). */
export function showcasePrimaryCssVar(accentColor: string): string {
  const match = accentColor.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
  if (match) return `${match[1]} ${match[2]}% ${match[3]}%`;

  const hex = accentColor.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    const expanded = hex
      .slice(1)
      .split('')
      .map((char) => char + char)
      .join('');
    return hexToHslComponents(`#${expanded}`);
  }
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return hexToHslComponents(hex);
  }

  return hexToHslComponents(accentColor);
}

/** Resolved accent for inline gradients (Framer Motion cannot use `var(--primary)` reliably). */
export function showcaseAccentHsla(accentColor: string, alpha: number): string {
  const hslMatch = accentColor.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
  if (hslMatch) {
    return `hsla(${hslMatch[1]}, ${hslMatch[2]}%, ${hslMatch[3]}%, ${alpha})`;
  }

  const hex = accentColor.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    const expanded = hex
      .slice(1)
      .split('')
      .map((char) => char + char)
      .join('');
    return showcaseAccentHsla(`#${expanded}`, alpha);
  }
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return `hsla(168, 65%, 40%, ${alpha})`;
}

export function resolveShowcaseDisplayFontClass(config: PropertyShowcaseConfig): string {
  return DISPLAY_FONT_CLASS[config.typography.displayFont] ?? DISPLAY_FONT_CLASS.outfit;
}

export function resolveShowcaseHeadingScaleClass(scale: TypeScale): string {
  if (scale === 'sm') return 'showcase-scale-sm';
  if (scale === 'lg') return 'showcase-scale-lg';
  return 'showcase-scale-md';
}

/** @deprecated Body scale is applied on `.showcase-scope` via `--showcase-body-scale`. */
export function resolveShowcaseBodyScaleClass(_scale: TypeScale): string {
  return '';
}

export function resolveShowcaseHeroOverlayClass(overlay: PaletteOverlay): string {
  if (overlay === 'strong') return 'from-black/90 via-black/50 to-black/20';
  if (overlay === 'soft') return 'from-black/70 via-black/30 to-black/10';
  return 'from-black/55 via-black/25 to-transparent';
}

export function resolveShowcaseWarmTintClass(
  paletteMode: PropertyShowcaseConfig['palette']['mode'],
  mediaWarmHue?: boolean,
  customPaletteBase?: string | null
): string {
  if (isShowcasePresetPaletteId(paletteMode) && getShowcasePresetPalette(paletteMode).warmTint) {
    return 'showcase-warm-tint';
  }
  if (paletteMode === 'media' && mediaWarmHue) return 'showcase-warm-tint';
  if (paletteMode === 'custom' && customPaletteBase) {
    const { h } = parseBrandColorHsl(customPaletteBase);
    if (h <= 55 || h >= 295) return 'showcase-warm-tint';
  }
  return '';
}

export function resolveShowcaseCustomPaletteClass(
  paletteMode: PropertyShowcaseConfig['palette']['mode']
): string {
  return paletteMode === 'default' ? '' : 'showcase-custom-palette';
}

/** @deprecated Use resolveShowcaseCustomPaletteClass */
export function resolveShowcaseMediaPaletteClass(
  paletteMode: PropertyShowcaseConfig['palette']['mode']
): string {
  return resolveShowcaseCustomPaletteClass(paletteMode);
}

/**
 * Soften entrance / kinetic motion. Only OS reduced-motion and Subtle intensity —
 * not `?embed=1` or the Page Editor — so hosts can preview canvas, parallax, and
 * Ken Burns with the Style toggles they turned on.
 */
export function resolveShowcaseMotionReduced(
  config: PropertyShowcaseConfig,
  reducedMotion: boolean,
  _embed = false
): boolean {
  if (reducedMotion) return true;
  return config.motion.intensity === 'subtle';
}

export function resolveShowcaseRevealDuration(intensity: MotionIntensity): number {
  if (intensity === 'subtle') return 0.45;
  if (intensity === 'bold') return 0.95;
  return 0.7;
}

/** Pause mesh/grain canvas when the host disabled it or the guest prefers reduced motion. */
export function resolveShowcaseCanvasPaused(
  config: PropertyShowcaseConfig,
  reducedMotion: boolean
): boolean {
  return reducedMotion || !config.motion.canvas;
}

/**
 * Scroll parallax (Aurora hero/sections, Atlas hero). Honors the Parallax toggle;
 * Subtle intensity still opts out so “calm” stays calm.
 */
export function resolveShowcaseParallaxEnabled(
  config: PropertyShowcaseConfig,
  reducedMotion: boolean,
  _embed = false
): boolean {
  if (reducedMotion || !config.motion.parallax) return false;
  return config.motion.intensity !== 'subtle';
}
