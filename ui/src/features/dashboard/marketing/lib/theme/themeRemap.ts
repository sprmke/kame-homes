import {
  MARKETING_THEME_PALETTE_ROLES,
  sameMarketingTheme,
  type MarketingThemeCorners,
  type MarketingThemePalette,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  formatCssColor,
  oklchToRgb,
  parseCssColor,
  rgbToOklab,
  rgbToOklch,
  type Oklch,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';
import type { MarketingThemeFonts } from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';

import { parseHexRgb, type Rgb } from '@/lib/theme/colorConvert';

/**
 * Re-themes any design tree (calendar styles, Polotno JSON, video project) from
 * one theme to another without knowing its schema.
 *
 * Colors: each color is matched to the nearest of the source theme's five
 * anchors, then moved the way that anchor moved (OKLCh: hue rotates with the
 * anchor, chroma scales, lightness is remapped so white stays white and black
 * stays black). A designer's light tint of `primary` stays a light tint of the
 * new `primary`; an anchor color maps exactly onto the new anchor.
 *
 * Fonts and corner radii map by role. When source and target are the same
 * theme the tree is returned unchanged (byte-identical), which is what keeps
 * starter themes pixel-equal to the original presets.
 */

const COLOR_SKIP_KEYS = new Set([
  'id',
  'text',
  'content',
  'name',
  'label',
  'src',
  'url',
  'imageUrl',
  'href',
  'format',
  'type',
]);
const FONT_KEYS = new Set(['family', 'fontFamily']);
const RADIUS_KEYS = new Set(['radius', 'borderRadius', 'cornerRadius', 'indicatorBorderRadius']);

/** Neutral below this OKLCh chroma (whites, greys, near-black ink). */
const NEUTRAL_CHROMA = 0.025;

type Anchor = { from: Oklch; to: Oklch; fromRgb: Rgb };

function paletteAnchors(from: MarketingThemePalette, to: MarketingThemePalette): Anchor[] {
  return MARKETING_THEME_PALETTE_ROLES.map((role) => {
    const fromRgb = parseHexRgb(from[role]) ?? { r: 0, g: 0, b: 0 };
    const toRgb = parseHexRgb(to[role]) ?? fromRgb;
    return { from: rgbToOklch(fromRgb), to: rgbToOklch(toRgb), fromRgb };
  });
}

function remapLightness(L: number, fromL: number, toL: number): number {
  if (L <= fromL) return fromL <= 0.0001 ? L : (L / fromL) * toL;
  return fromL >= 0.9999 ? L : toL + ((L - fromL) / (1 - fromL)) * (1 - toL);
}

function hueDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/** Below this chroma a color has no reliable hue (pure greys). */
const HUELESS_CHROMA = 0.008;

/**
 * Hue: a color keeps its offset from its anchor, so a warmer tint stays warmer.
 * Large offsets are damped: a slate text color sitting next to a green ink
 * should land near the new ink's hue, not be spun to an unrelated one.
 */
function remapHue(colorHue: number, from: Oklch, to: Oklch): number {
  const offset = hueDelta(from.h, colorHue);
  const weight = Math.abs(offset) <= 30 ? 1 : Math.max(0.2, 30 / Math.abs(offset));
  return (to.h + offset * weight + 360) % 360;
}

function remapOklch(color: Oklch, anchor: Anchor): Oklch {
  const { from, to } = anchor;
  const L = remapLightness(color.L, from.L, to.L);
  const colorHueless = color.C < HUELESS_CHROMA;
  const targetHueless = to.C < HUELESS_CHROMA;

  // Chroma: proportional around saturated anchors, offset around near-neutral ones
  // (a ratio of two tiny chromas would explode).
  const C =
    from.C >= NEUTRAL_CHROMA
      ? color.C * Math.min(3, Math.max(0.15, to.C / from.C))
      : Math.max(0, color.C - from.C + to.C);

  if (targetHueless) return { L, C, h: color.h };
  if (from.C < HUELESS_CHROMA || colorHueless) return { L, C, h: to.h };
  return { L, C, h: remapHue(color.h, from, to) };
}

/** Saturated enough that its hue family says which anchor it is a shade of. */
const HUE_FAMILY_CHROMA = 0.03;
const HUE_FAMILY_SPAN = 40;

/**
 * Which anchor a color is a shade of. Saturated colors are matched within their
 * hue family first (a pale pink "today" fill is a tint of the pink accent, not of
 * the nearly white lavender secondary next to it in lightness), then by OKLab
 * distance with lightness down-weighted. Everything else: plain OKLab distance.
 */
function nearestAnchorIndex(
  color: Rgb,
  anchors: Anchor[],
  anchorLabs: Array<{ L: number; a: number; b: number }>
): number {
  const lab = rgbToOklab(color);
  const lch = rgbToOklch(color);
  const distance = (index: number, lightnessWeight: number) => {
    const anchorLab = anchorLabs[index]!;
    return Math.hypot((lab.L - anchorLab.L) * lightnessWeight, lab.a - anchorLab.a, lab.b - anchorLab.b);
  };
  const pick = (indexes: number[], lightnessWeight: number) =>
    indexes.reduce((best, index) =>
      distance(index, lightnessWeight) < distance(best, lightnessWeight) ? index : best
    );

  if (lch.C >= HUE_FAMILY_CHROMA) {
    const family = anchors
      .map((anchor, index) => ({ anchor, index }))
      .filter(
        ({ anchor }) =>
          anchor.from.C >= HUE_FAMILY_CHROMA &&
          Math.abs(hueDelta(anchor.from.h, lch.h)) <= HUE_FAMILY_SPAN
      )
      .map(({ index }) => index);
    if (family.length > 0) return pick(family, 0.35);
  }
  return pick(
    anchors.map((_, index) => index),
    1
  );
}

export type ThemeColorRemapper = (color: string) => string;

/** Memoized color mapper between two palettes; identity when they match. */
export function createThemeColorRemapper(
  from: MarketingThemePalette,
  to: MarketingThemePalette
): ThemeColorRemapper {
  const identical = MARKETING_THEME_PALETTE_ROLES.every(
    (role) => from[role].toLowerCase() === to[role].toLowerCase()
  );
  if (identical) return (color) => color;

  const anchors = paletteAnchors(from, to);
  const anchorLabs = anchors.map((a) => rgbToOklab(a.fromRgb));
  const cache = new Map<string, string>();

  return (color: string) => {
    const cached = cache.get(color);
    if (cached !== undefined) return cached;
    const parsed = parseCssColor(color);
    if (!parsed) {
      cache.set(color, color);
      return color;
    }
    const nearest = nearestAnchorIndex(parsed, anchors, anchorLabs);
    const anchor = anchors[nearest]!;
    // Exact anchor hit maps exactly (avoids gamut-clip rounding drift on key colors).
    const exact =
      parsed.r === anchor.fromRgb.r &&
      parsed.g === anchor.fromRgb.g &&
      parsed.b === anchor.fromRgb.b;
    const rgb = exact
      ? (parseHexRgb(to[MARKETING_THEME_PALETTE_ROLES[nearest]!]) ?? parsed)
      : oklchToRgb(remapOklch(rgbToOklch(parsed), anchor));
    const result = formatCssColor({ ...rgb, a: parsed.a }, parsed.notation);
    cache.set(color, result);
    return result;
  };
}

type FontRole = keyof MarketingThemeFonts;

const LABEL_PATH_HINT = /dayNames|propertyName|legend|label|eyebrow|chip|badge|pill|cta/i;
const DISPLAY_PATH_HINT = /monthYear|(^|\.)title|headline|display|promo|numeral/i;

/** Role a font field plays, guessed from where it sits in the tree. */
function roleHintFromPath(path: string): FontRole {
  if (DISPLAY_PATH_HINT.test(path)) return 'display';
  if (LABEL_PATH_HINT.test(path)) return 'label';
  return 'body';
}

/**
 * Role-based font swap. A family that fills one source role maps to that role;
 * one that fills several (e.g. Poppins as body and label) is resolved by the
 * field path; families outside the source roles follow the path hint too.
 */
export function createThemeFontRemapper(
  from: MarketingThemeFonts,
  to: MarketingThemeFonts
): (family: string, path?: string) => string {
  if (from.display === to.display && from.body === to.body && from.label === to.label) {
    return (family) => family;
  }
  const rolesByFamily = new Map<string, FontRole[]>();
  for (const role of ['display', 'body', 'label'] as const) {
    rolesByFamily.set(from[role], [...(rolesByFamily.get(from[role]) ?? []), role]);
  }
  return (family, path = '') => {
    if (family === 'system-ui') return family;
    const roles = rolesByFamily.get(family);
    const hint = roleHintFromPath(path);
    if (roles?.length === 1) return to[roles[0]!];
    if (roles && roles.length > 1) return to[roles.includes(hint) ? hint : roles[0]!];
    return to[hint];
  };
}

const CORNER_FACTOR: Record<MarketingThemeCorners, number> = { sharp: 0.2, soft: 0.6, round: 1 };
/** Radii at or above this are pills/circles (999), not tunable corners. */
const PILL_RADIUS = 200;

export function createThemeRadiusRemapper(
  from: MarketingThemeCorners,
  to: MarketingThemeCorners
): (radius: number) => number {
  if (from === to) return (radius) => radius;
  return (radius) => {
    if (radius <= 0) return radius;
    if (radius >= PILL_RADIUS) return to === 'sharp' ? 6 : radius;
    return Math.max(0, Math.round((radius * CORNER_FACTOR[to]) / CORNER_FACTOR[from]));
  };
}

export type RemapThemeTreeOptions = {
  /** Dot paths (or prefixes) the host set by hand: left untouched. */
  isLocked?: (path: string) => boolean;
  /** Top-level keys to skip entirely (e.g. the calendar canvas frame, themed separately). */
  skipKeys?: ReadonlySet<string>;
};

/**
 * Returns a re-themed copy of `tree` (never mutates). Same theme → same reference.
 */
export function remapThemeTree<T>(
  tree: T,
  from: MarketingThemeTokens,
  to: MarketingThemeTokens,
  options: RemapThemeTreeOptions = {}
): T {
  if (sameMarketingTheme(from, to)) return tree;
  const color = createThemeColorRemapper(from.palette, to.palette);
  const font = createThemeFontRemapper(from.fonts, to.fonts);
  const radius = createThemeRadiusRemapper(from.corners, to.corners);
  const { isLocked, skipKeys } = options;

  const walk = (node: unknown, key: string, path: string, depth: number): unknown => {
    if (isLocked?.(path)) return node;
    if (typeof node === 'string') {
      if (FONT_KEYS.has(key)) return font(node, path);
      if (COLOR_SKIP_KEYS.has(key)) return node;
      return color(node);
    }
    if (typeof node === 'number') {
      return RADIUS_KEYS.has(key) ? radius(node) : node;
    }
    if (Array.isArray(node)) {
      return node.map((child, index) => walk(child, key, `${path}.${index}`, depth + 1));
    }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [childKey, child] of Object.entries(node as Record<string, unknown>)) {
        if (depth === 0 && skipKeys?.has(childKey)) {
          out[childKey] = child;
          continue;
        }
        out[childKey] = walk(child, childKey, path ? `${path}.${childKey}` : childKey, depth + 1);
      }
      return out;
    }
    return node;
  };

  return walk(tree, '', '', 0) as T;
}

/** Locked-path matcher: a lock on `today.border` also covers `today.border.color`. */
export function lockedPathMatcher(lockedPaths: readonly string[] | undefined) {
  if (!lockedPaths || lockedPaths.length === 0) return undefined;
  const set = new Set(lockedPaths);
  return (path: string) => {
    if (set.has(path)) return true;
    let index = path.lastIndexOf('.');
    while (index > 0) {
      if (set.has(path.slice(0, index))) return true;
      index = path.lastIndexOf('.', index - 1);
    }
    return false;
  };
}
