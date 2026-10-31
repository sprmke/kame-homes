import { resolveCalendarPresetStyles } from '@/features/dashboard/marketing/components/calendar-builder/stores/calendarBuilderStore';
import {
  normalizeCalendarStyles,
  type BackgroundConfig,
  type CalendarStyles,
} from '@/features/dashboard/marketing/components/calendar-builder/types';
import {
  canvasFrameDefaultsForFormat,
  type CalendarCanvasFormat,
} from '@/features/dashboard/marketing/lib/calendarCanvasFormats';
import { applyPropertyPhotoToCalendarStyles } from '@/features/dashboard/marketing/lib/calendarPropertyPhoto';
import {
  sameMarketingTheme,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  contrastRatio,
  ensureContrast,
  mixTowardWhite,
  normalizeThemeHex,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';
import { readTemplateThemeSnapshot } from '@/features/dashboard/marketing/lib/theme/marketingThemeItems';
import {
  calendarLayoutSourceTokens,
  findStarterTheme,
} from '@/features/dashboard/marketing/lib/theme/starterThemes';
import {
  lockedPathMatcher,
  remapThemeTree,
} from '@/features/dashboard/marketing/lib/theme/themeRemap';

import { parseHexRgb } from '@/lib/theme/colorConvert';

/**
 * Calendar ↔ theme. A calendar layout is a designer preset read as structure;
 * its colors and fonts are re-expressed in the active theme by `remapThemeTree`.
 */

const CANVAS_FRAME_KEY = new Set(['canvasFrame']);

/** Canvas around the calendar card: white on square, the theme's main color otherwise. */
export function themedCanvasFrameBackground(
  format: CalendarCanvasFormat,
  theme: MarketingThemeTokens
): BackgroundConfig {
  return canvasFrameDefaultsForFormat(format, theme.palette.primary).background;
}

function themedContainerBackground(
  theme: MarketingThemeTokens,
  current: BackgroundConfig,
  propertyPhotoUrl?: string
): BackgroundConfig {
  const { primary, surface } = theme.palette;
  switch (theme.background) {
    case 'soft-gradient':
      return {
        type: 'gradient',
        color: surface,
        gradient: {
          type: 'linear',
          angle: 165,
          stops: [
            { color: surface, position: 0 },
            { color: mixTowardWhite(primary, 0.84), position: 100 },
          ],
        },
      };
    case 'pattern':
      return {
        type: 'pattern',
        color: surface,
        pattern: {
          type:
            current.pattern?.type && current.pattern.type !== 'none'
              ? current.pattern.type
              : 'dots',
          color: mixTowardWhite(primary, 0.5),
          size: current.pattern?.size ?? 10,
          opacity: 0.28,
        },
      };
    case 'photo-wash': {
      const imageUrl = propertyPhotoUrl ?? current.imageUrl;
      if (!imageUrl)
        return themedContainerBackground({ ...theme, background: 'soft-gradient' }, current);
      const rgb = parseHexRgb(surface) ?? { r: 255, g: 255, b: 255 };
      return {
        type: 'image',
        color: surface,
        imageUrl,
        imageSize: 'cover',
        imagePosition: 'center',
        overlay: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.82)`,
        opacity: 1,
      };
    }
    default:
      return { type: 'solid', color: surface };
  }
}

// ── Readability ──────────────────────────────────────────────────────────────

type ReadablePair = { fg: string; bg: string[]; min: number };

/** Text color path → background paths (first solid one wins) → target ratio. */
const READABLE_PAIRS: ReadablePair[] = [
  { fg: 'header.monthYear.color', bg: ['header.background', 'container.background'], min: 4.5 },
  { fg: 'header.propertyName.color', bg: ['header.background', 'container.background'], min: 3 },
  { fg: 'header.subtitle.color', bg: ['header.background', 'container.background'], min: 3 },
  { fg: 'dayNames.color', bg: ['dayNames.background', 'container.background'], min: 3 },
  { fg: 'cell.dayNumber.color', bg: ['cell.background', 'container.background'], min: 4.5 },
  {
    fg: 'available.dayNumberColor',
    bg: ['available.background', 'cell.background', 'container.background'],
    min: 4.5,
  },
  {
    fg: 'available.price.color',
    bg: ['available.background', 'cell.background', 'container.background'],
    min: 3,
  },
  {
    fg: 'today.dayNumberColor',
    bg: ['today.background', 'cell.background', 'container.background'],
    min: 4.5,
  },
  {
    fg: 'booked.dayNumberColor',
    bg: ['booked.background', 'cell.background', 'container.background'],
    min: 3,
  },
  {
    fg: 'booked.text.color',
    bg: ['booked.background', 'cell.background', 'container.background'],
    min: 3,
  },
  {
    fg: 'blocked.dayNumberColor',
    bg: ['blocked.background', 'cell.background', 'container.background'],
    min: 1.5,
  },
  { fg: 'legend.item.labelColor', bg: ['legend.background', 'container.background'], min: 3 },
  { fg: 'legend.title.color', bg: ['legend.background', 'container.background'], min: 3 },
];

function getPath(root: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
      root
    );
}

function setPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let node = root;
  for (const key of keys.slice(0, -1)) {
    const next = node[key];
    if (!next || typeof next !== 'object') return;
    node = next as Record<string, unknown>;
  }
  node[keys[keys.length - 1]!] = value;
}

function solidFill(value: unknown): string | null {
  if (typeof value === 'string') return normalizeThemeHex(value);
  if (!value || typeof value !== 'object') return null;
  const background = value as BackgroundConfig;
  if (background.type === 'gradient') {
    return (
      normalizeThemeHex(background.gradient?.stops?.[0]?.color) ??
      normalizeThemeHex(background.color)
    );
  }
  return normalizeThemeHex(background.color);
}

function firstSolid(root: unknown, paths: string[]): string | null {
  for (const path of paths) {
    const fill = solidFill(getPath(root, path));
    if (fill) return fill;
  }
  return null;
}

/**
 * Keeps every text pair at least as readable as the designer made it (capped at
 * the WCAG target). Faint-by-design text (booked days) stays faint; text the
 * remap made worse is pushed back. `source` is the styles before re-theming.
 */
export function preserveCalendarReadability(
  styles: CalendarStyles,
  source: CalendarStyles,
  options: { isLocked?: (path: string) => boolean } = {}
): CalendarStyles {
  const next = structuredClone(styles) as unknown as Record<string, unknown>;
  for (const pair of READABLE_PAIRS) {
    if (options.isLocked?.(pair.fg)) continue;
    const fg = normalizeThemeHex(getPath(next, pair.fg));
    const bg = firstSolid(next, pair.bg);
    if (!fg || !bg) continue;
    const sourceFg = normalizeThemeHex(getPath(source, pair.fg));
    const sourceBg = firstSolid(source, pair.bg);
    const designed = sourceFg && sourceBg ? contrastRatio(sourceFg, sourceBg) : pair.min;
    const required = Math.min(pair.min, designed);
    if (contrastRatio(fg, bg) < required) {
      setPath(next, pair.fg, ensureContrast(fg, bg, required));
    }
  }
  return next as unknown as CalendarStyles;
}

// ── Public API ───────────────────────────────────────────────────────────────

export type RethemeCalendarOptions = {
  /** Paths the host set by hand in Advanced; never overwritten. */
  lockedPaths?: readonly string[];
  propertyPhotoUrl?: string;
};

/**
 * Moves calendar styles from the theme they were made in to another theme.
 * Same theme → the same object back (nothing re-rendered, nothing marked dirty).
 */
export function rethemeCalendarStyles(
  styles: CalendarStyles,
  from: MarketingThemeTokens,
  to: MarketingThemeTokens,
  options: RethemeCalendarOptions = {}
): CalendarStyles {
  if (sameMarketingTheme(from, to)) return styles;
  const isLocked = lockedPathMatcher(options.lockedPaths);
  let next = remapThemeTree(styles, from, to, { isLocked, skipKeys: CANVAS_FRAME_KEY });

  if (from.background !== to.background && !isLocked?.('container.background')) {
    next = {
      ...next,
      container: {
        ...next.container,
        background: themedContainerBackground(
          to,
          next.container.background,
          options.propertyPhotoUrl
        ),
      },
    };
  }

  next = preserveCalendarReadability(next, styles, { isLocked });

  const frame = next.canvasFrame;
  if (frame && frame.format !== 'square' && !isLocked?.('canvasFrame.background')) {
    next = {
      ...next,
      canvasFrame: { ...frame, background: themedCanvasFrameBackground(frame.format, to) },
    };
  }
  return normalizeCalendarStyles(next);
}

export type ThemedCalendarLayoutInput = {
  layoutId: string;
  theme: MarketingThemeTokens;
  format: CalendarCanvasFormat;
  propertyPhotoUrl?: string;
};

/** A calendar layout dressed in a theme, framed for one canvas format. */
export function resolveThemedCalendarLayout({
  layoutId,
  theme,
  format,
  propertyPhotoUrl,
}: ThemedCalendarLayoutInput): CalendarStyles {
  const base = resolveCalendarPresetStyles(layoutId);
  const source = calendarLayoutSourceTokens(layoutId);
  const frameDefaults = canvasFrameDefaultsForFormat(format, theme.palette.primary);
  const framed = normalizeCalendarStyles({
    ...base,
    canvasFrame: {
      format,
      padding: frameDefaults.padding,
      calendarScale: frameDefaults.calendarScale,
      background: frameDefaults.background,
    },
  });
  const themed = rethemeCalendarStyles(framed, source, theme, { propertyPhotoUrl });
  return applyPropertyPhotoToCalendarStyles(themed, propertyPhotoUrl);
}

export type ThemedSavedCalendar = {
  styles: CalendarStyles;
  /** True when the stored styles were made in another version of the theme. */
  rethemed: boolean;
  lockedPaths: string[];
};

/**
 * A saved calendar shown in the current theme. Uses the theme snapshot stored
 * with the item; rows saved before themes fall back to their designer look's
 * palette (or stay as they are when no source theme is known).
 */
export function themedSavedCalendarStyles(
  designJson: Record<string, unknown> | undefined,
  styles: CalendarStyles,
  target: MarketingThemeTokens,
  propertyPhotoUrl?: string
): ThemedSavedCalendar {
  const snapshot = readTemplateThemeSnapshot(designJson);
  const preset = typeof designJson?.sourcePresetId === 'string' ? designJson.sourcePresetId : null;
  const from =
    snapshot.tokens ??
    (preset && findStarterTheme(preset) ? calendarLayoutSourceTokens(preset) : null);
  const normalized = normalizeCalendarStyles(styles);
  if (!from) return { styles: normalized, rethemed: false, lockedPaths: snapshot.lockedPaths };
  const next = rethemeCalendarStyles(normalized, from, target, {
    lockedPaths: snapshot.lockedPaths,
    propertyPhotoUrl,
  });
  return { styles: next, rethemed: next !== normalized, lockedPaths: snapshot.lockedPaths };
}
