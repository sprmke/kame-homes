import { resolveCalendarPresetStyles } from '@/features/dashboard/marketing/components/calendar-builder/stores/calendarBuilderStore';
import {
  normalizeCalendarStyles,
  type CalendarStyles,
} from '@/features/dashboard/marketing/components/calendar-builder/types';
import {
  calendarFormatToAspectPreset,
  canvasFrameDefaultsForFormat,
  type CalendarCanvasFormat,
} from '@/features/dashboard/marketing/lib/calendarCanvasFormats';
import { applyPropertyPhotoToCalendarStyles } from '@/features/dashboard/marketing/lib/calendarPropertyPhoto';

import { mixHexToward, parseHexRgb, type Rgb } from '@/lib/theme/colorConvert';

export type CalendarLayoutArchetype =
  | 'bubble'
  | 'widget'
  | 'type-forward'
  | 'geo-pattern'
  | 'botanical'
  | 'photo-wash'
  | 'dusk-gradient';

export type CalendarFontPairing =
  'soft-sans' | 'editorial-serif' | 'playful-rounded' | 'modern-clean';

export type CalendarBackgroundMood =
  'solid-cream' | 'soft-gradient' | 'pattern-dots' | 'photo-wash';

export type CalendarTemplateTokens = {
  layoutArchetype: CalendarLayoutArchetype;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  fontPairing: CalendarFontPairing;
  backgroundMood: CalendarBackgroundMood;
  subtitle: string;
  label: string;
};

const ARCHETYPE_SEED: Record<CalendarLayoutArchetype, string> = {
  bubble: 'social-availability',
  widget: 'sunrise-select',
  'type-forward': 'desk-type',
  'geo-pattern': 'bauhaus-geo',
  botanical: 'garden-glow',
  'photo-wash': 'property-hero',
  'dusk-gradient': 'velvet-guest',
};

/** The designer layout an AI archetype is built on. */
export function calendarAiArchetypeSeed(archetype: CalendarLayoutArchetype): string {
  return ARCHETYPE_SEED[archetype] ?? ARCHETYPE_SEED.bubble;
}

const FONT_PAIRINGS: Record<CalendarFontPairing, { display: string; body: string; label: string }> =
  {
    'soft-sans': { display: 'Poppins', body: 'Nunito Sans', label: 'Poppins' },
    'editorial-serif': { display: 'Fraunces', body: 'Nunito Sans', label: 'Jost' },
    'playful-rounded': { display: 'Nunito', body: 'Nunito Sans', label: 'Poppins' },
    'modern-clean': { display: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans', label: 'Jost' },
  };

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** Truncates at the last whitespace before `max` so AI copy never gets cut mid-word. */
function truncateAtWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return lastSpace > max * 0.4 ? slice.slice(0, lastSpace).trimEnd() : slice;
}
const INK_FALLBACK = '#1e293b';
const WHITE = '#ffffff';
/** WCAG AA for normal text on fills (date numbers, labels). */
const MIN_TEXT_CONTRAST = 4.5;
/** Large / decorative meta can sit at AA large-text floor. */
const MIN_META_CONTRAST = 3;

function parseHex(hex: string): Rgb | null {
  return parseHexRgb(hex);
}

function safeHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (HEX_RE.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return fallback;
}

function mixHex(base: string, target: Rgb, targetWeight: number): string {
  return mixHexToward(base, target, targetWeight);
}

function mixTowardWhite(hex: string, amount: number): string {
  return mixHex(hex, { r: 255, g: 255, b: 255 }, amount);
}

function mixTowardBlack(hex: string, amount: number): string {
  return mixHex(hex, { r: 0, g: 0, b: 0 }, amount);
}

function relativeLuminance(rgb: Rgb): number {
  const linearize = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

function contrastRatio(left: string, right: string): number {
  const a = parseHex(left);
  const b = parseHex(right);
  if (!a || !b) return 1;
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

function luminanceOf(hex: string): number {
  const rgb = parseHex(hex);
  return rgb ? relativeLuminance(rgb) : 0.5;
}

/** Pick white or dark ink for best contrast on a fill. */
function foregroundOn(background: string, ink = INK_FALLBACK): string {
  const whiteRatio = contrastRatio(background, WHITE);
  const inkRatio = contrastRatio(background, ink);
  return whiteRatio >= inkRatio ? WHITE : ink;
}

/**
 * Darken (or lighten) `candidate` until it reaches `minRatio` against `background`.
 * Pastel AI palettes often fail AA — this is the hard floor for date numbers / labels.
 */
function ensureContrast(candidate: string, background: string, minRatio: number): string {
  if (contrastRatio(candidate, background) >= minRatio) return candidate;

  const bgLum = luminanceOf(background);
  let best = candidate;

  // Prefer darkening on light surfaces (typical pastel calendars).
  if (bgLum >= 0.45) {
    for (let step = 0.08; step <= 0.92; step += 0.04) {
      const next = mixTowardBlack(candidate, step);
      if (contrastRatio(next, background) >= minRatio) return next;
      best = next;
    }
    if (contrastRatio(INK_FALLBACK, background) >= minRatio) return INK_FALLBACK;
    return best;
  }

  for (let step = 0.08; step <= 0.92; step += 0.04) {
    const next = mixTowardWhite(candidate, step);
    if (contrastRatio(next, background) >= minRatio) return next;
    best = next;
  }
  if (contrastRatio(WHITE, background) >= minRatio) return WHITE;
  return best;
}

/** Force AI palette into Instagrammable pastel roles with usable depth. */
function sanitizePalette(palette: { primary: string; secondary: string; accent: string }): {
  primary: string;
  secondary: string;
  accent: string;
  ink: string;
} {
  let primary = safeHex(palette.primary, '#a48ee0');
  let secondary = safeHex(palette.secondary, '#f3edfd');
  let accent = safeHex(palette.accent, '#ff8fa8');

  // Secondary must be a light wash (canvas / empty cells).
  if (luminanceOf(secondary) < 0.88) {
    secondary = mixTowardWhite(secondary, 0.72);
  }
  if (luminanceOf(secondary) < 0.9) {
    secondary = mixTowardWhite(primary, 0.9);
  }

  // Primary must have enough chroma/depth for available-day fills (not ice-pale).
  if (luminanceOf(primary) > 0.78) {
    primary = mixTowardBlack(primary, 0.32);
  }
  if (luminanceOf(primary) > 0.7) {
    primary = mixTowardBlack(primary, 0.22);
  }
  if (luminanceOf(primary) > 0.64) {
    primary = mixTowardBlack(primary, 0.12);
  }

  // Accent (today) distinct from primary; soft but not washed out.
  if (contrastRatio(accent, primary) < 1.35) {
    accent = mixTowardBlack(accent, 0.12);
  }
  if (luminanceOf(accent) > 0.78) {
    accent = mixTowardBlack(accent, 0.22);
  }

  const ink = ensureContrast(mixTowardBlack(primary, 0.55), secondary, MIN_TEXT_CONTRAST);
  return { primary, secondary, accent, ink };
}

function replaceHexColors(
  value: string,
  primary: string,
  secondary: string,
  accent: string
): string {
  // Soft remap of common pastel seeds → AI palette (keeps non-hex / rgba intact).
  if (!HEX_RE.test(value)) return value;
  const lower = value.toLowerCase();
  const r = parseInt(lower.slice(1, 3), 16);
  const g = parseInt(lower.slice(3, 5), 16);
  const b = parseInt(lower.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 18 && max > 230) return secondary;
  if (max - min < 25 && max > 200) return mixTowardWhite(primary, 0.72);
  if (r > g + 20 && r > b + 10) return accent;
  if (max > 160) return primary;
  return mixTowardBlack(primary, 0.35);
}

function recolorStyles(
  styles: CalendarStyles,
  primary: string,
  secondary: string,
  accent: string
): CalendarStyles {
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return replaceHexColors(node, primary, secondary, accent);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        out[key] = walk(child);
      }
      return out;
    }
    return node;
  };
  return walk(styles) as CalendarStyles;
}

function applyFontPairing(styles: CalendarStyles, pairing: CalendarFontPairing): CalendarStyles {
  const fonts = FONT_PAIRINGS[pairing];
  return {
    ...styles,
    header: {
      ...styles.header,
      propertyName: {
        ...styles.header.propertyName,
        font: { ...styles.header.propertyName.font, family: fonts.label },
      },
      monthYear: {
        ...styles.header.monthYear,
        font: { ...styles.header.monthYear.font, family: fonts.display },
      },
      subtitle: {
        ...styles.header.subtitle,
        font: { ...styles.header.subtitle.font, family: fonts.body },
      },
    },
    dayNames: {
      ...styles.dayNames,
      font: { ...styles.dayNames.font, family: fonts.label },
    },
    cell: {
      ...styles.cell,
      dayNumber: {
        ...styles.cell.dayNumber,
        font: { ...styles.cell.dayNumber.font, family: fonts.body },
      },
    },
  };
}

function applyBackgroundMood(
  styles: CalendarStyles,
  mood: CalendarBackgroundMood,
  primary: string,
  secondary: string,
  propertyPhotoUrl?: string
): CalendarStyles {
  if (mood === 'photo-wash' && propertyPhotoUrl) {
    return {
      ...styles,
      container: {
        ...styles.container,
        background: {
          type: 'image',
          color: secondary,
          imageUrl: propertyPhotoUrl,
          imageSize: 'cover',
          imagePosition: 'center',
          overlay: 'rgba(255,255,255,0.82)',
          opacity: 1,
        },
      },
    };
  }

  if (mood === 'soft-gradient') {
    return {
      ...styles,
      container: {
        ...styles.container,
        background: {
          type: 'gradient',
          color: secondary,
          gradient: {
            type: 'linear',
            angle: 165,
            stops: [
              { color: secondary, position: 0 },
              { color: mixTowardWhite(primary, 0.86), position: 100 },
            ],
          },
        },
      },
    };
  }

  if (mood === 'pattern-dots') {
    return {
      ...styles,
      container: {
        ...styles.container,
        background: {
          type: 'pattern',
          color: secondary,
          pattern: {
            type: 'dots',
            color: mixTowardWhite(primary, 0.55),
            size: 10,
            opacity: 0.28,
          },
        },
      },
    };
  }

  return {
    ...styles,
    container: {
      ...styles.container,
      background: { type: 'solid', color: secondary },
    },
  };
}

/**
 * After AI recolor, overwrite every text/day-number color so dates stay readable
 * on pastel fills — Instagrammable wash, never washed-out ink.
 */
function ensureReadableCalendarContrast(
  styles: CalendarStyles,
  palette: { primary: string; secondary: string; accent: string; ink: string }
): CalendarStyles {
  const { primary, secondary, accent, ink } = palette;

  // Available days: soft pastel chip with dark ink (hand-preset language), never ice-on-ice.
  const availableFill =
    luminanceOf(primary) > 0.55 ? mixTowardWhite(primary, 0.08) : mixTowardWhite(primary, 0.28);
  const availableInk = ensureContrast(
    foregroundOn(availableFill, ink),
    availableFill,
    MIN_TEXT_CONTRAST
  );

  const bookedFill = mixTowardWhite(primary, 0.78);
  const bookedInk = ensureContrast(mixTowardBlack(primary, 0.42), bookedFill, MIN_TEXT_CONTRAST);
  const bookedPattern = ensureContrast(mixTowardBlack(primary, 0.2), bookedFill, MIN_META_CONTRAST);

  const todayFill = mixTowardWhite(accent, 0.55);
  const todayInk = ensureContrast(mixTowardBlack(accent, 0.35), todayFill, MIN_TEXT_CONTRAST);
  const todayBorder = ensureContrast(accent, secondary, MIN_META_CONTRAST);

  const headerInk = ensureContrast(mixTowardBlack(primary, 0.48), secondary, MIN_TEXT_CONTRAST);
  const monthInk = ensureContrast(mixTowardBlack(primary, 0.58), secondary, MIN_TEXT_CONTRAST);
  const metaInk = ensureContrast(mixTowardBlack(primary, 0.32), secondary, MIN_META_CONTRAST);
  const dayNameInk = ensureContrast(mixTowardBlack(primary, 0.38), secondary, MIN_META_CONTRAST);
  const emptyInk = ensureContrast(mixTowardBlack(primary, 0.18), secondary, MIN_META_CONTRAST);
  const defaultDayInk = ensureContrast(mixTowardBlack(primary, 0.4), secondary, MIN_TEXT_CONTRAST);

  const legendInk = ensureContrast(mixTowardBlack(primary, 0.4), secondary, MIN_META_CONTRAST);

  return {
    ...styles,
    header: {
      ...styles.header,
      propertyName: {
        ...styles.header.propertyName,
        color: headerInk,
      },
      monthYear: {
        ...styles.header.monthYear,
        color: monthInk,
      },
      subtitle: {
        ...styles.header.subtitle,
        color: metaInk,
      },
    },
    dayNames: {
      ...styles.dayNames,
      color: dayNameInk,
      font: {
        ...styles.dayNames.font,
        weight: Math.max(
          styles.dayNames.font.weight,
          600
        ) as CalendarStyles['dayNames']['font']['weight'],
        size: Math.max(styles.dayNames.font.size, 13),
      },
    },
    cell: {
      ...styles.cell,
      dayNumber: {
        ...styles.cell.dayNumber,
        color: defaultDayInk,
        font: {
          ...styles.cell.dayNumber.font,
          weight: Math.max(
            styles.cell.dayNumber.font.weight,
            600
          ) as CalendarStyles['cell']['dayNumber']['font']['weight'],
          size: Math.max(styles.cell.dayNumber.font.size, 17),
        },
      },
    },
    available: {
      ...styles.available,
      background: { type: 'solid', color: availableFill },
      dayNumberColor: availableInk,
      border: {
        ...styles.available.border,
        color: mixTowardWhite(primary, 0.35),
      },
      price: {
        ...styles.available.price,
        color: availableInk,
      },
      indicator: {
        ...styles.available.indicator,
        color: availableInk,
      },
    },
    booked: {
      ...styles.booked,
      background: { type: 'solid', color: bookedFill },
      dayNumberColor: bookedInk,
      border: {
        ...styles.booked.border,
        color: mixTowardWhite(primary, 0.55),
      },
      pattern: styles.booked.pattern.show
        ? {
            ...styles.booked.pattern,
            color: bookedPattern,
            opacity: Math.min(styles.booked.pattern.opacity || 0.65, 0.55),
          }
        : styles.booked.pattern,
      text: {
        ...styles.booked.text,
        color: bookedInk,
      },
      guestInfo: {
        ...styles.booked.guestInfo,
        color: bookedInk,
      },
    },
    today: {
      ...styles.today,
      background: { type: 'solid', color: todayFill },
      border: {
        ...styles.today.border,
        color: todayBorder,
        width: Math.max(styles.today.border.width, 2),
      },
      dayNumberColor: todayInk,
      dayNumberBackground: 'transparent',
      indicator: {
        ...styles.today.indicator,
        color: todayBorder,
      },
    },
    blocked: {
      ...styles.blocked,
      background: { type: 'solid', color: mixTowardWhite(secondary, 0.4) },
      dayNumberColor: emptyInk,
    },
    legend: {
      ...styles.legend,
      item: {
        ...styles.legend.item,
        labelColor: legendInk,
        labelFont: {
          ...styles.legend.item.labelFont,
          weight: Math.max(
            styles.legend.item.labelFont.weight,
            600
          ) as CalendarStyles['legend']['item']['labelFont']['weight'],
          size: Math.max(styles.legend.item.labelFont.size, 13),
        },
      },
    },
  };
}

export function normalizeCalendarTemplateTokens(
  raw: Partial<CalendarTemplateTokens> | null | undefined
): CalendarTemplateTokens {
  const palette = raw?.palette ?? { primary: '#a48ee0', secondary: '#f3edfd', accent: '#ff8fa8' };
  const sanitized = sanitizePalette({
    primary: safeHex(palette.primary, '#a48ee0'),
    secondary: safeHex(palette.secondary, '#f3edfd'),
    accent: safeHex(palette.accent, '#ff8fa8'),
  });
  return {
    layoutArchetype: raw?.layoutArchetype ?? 'bubble',
    palette: {
      primary: sanitized.primary,
      secondary: sanitized.secondary,
      accent: sanitized.accent,
    },
    fontPairing: raw?.fontPairing ?? 'soft-sans',
    backgroundMood: raw?.backgroundMood ?? 'solid-cream',
    subtitle:
      truncateAtWordBoundary((raw?.subtitle ?? 'Available dates').trim(), 48) || 'Available dates',
    label: truncateAtWordBoundary((raw?.label ?? 'AI calendar').trim(), 40) || 'AI calendar',
  };
}

export type ResolveAiCalendarOptions = {
  format: CalendarCanvasFormat;
  brandColor?: string;
  propertyPhotoUrl?: string;
};

/** Compile AI tokens into editable CalendarStyles for one canvas format. */
export function resolveAiGeneratedCalendarStyles(
  tokensInput: Partial<CalendarTemplateTokens>,
  options: ResolveAiCalendarOptions
): CalendarStyles {
  const tokens = normalizeCalendarTemplateTokens(tokensInput);
  const palette = sanitizePalette(tokens.palette);
  const seedId = ARCHETYPE_SEED[tokens.layoutArchetype];
  let styles = resolveCalendarPresetStyles(seedId);

  styles = recolorStyles(styles, palette.primary, palette.secondary, palette.accent);
  styles = applyFontPairing(styles, tokens.fontPairing);
  styles = applyBackgroundMood(
    styles,
    tokens.backgroundMood,
    palette.primary,
    palette.secondary,
    options.propertyPhotoUrl
  );

  styles = {
    ...styles,
    header: {
      ...styles.header,
      subtitle: {
        ...styles.header.subtitle,
        show: true,
        text: tokens.subtitle,
      },
    },
  };

  styles = ensureReadableCalendarContrast(styles, palette);

  const frameDefaults = canvasFrameDefaultsForFormat(options.format, options.brandColor);
  styles = normalizeCalendarStyles({
    ...styles,
    canvasFrame: {
      format: options.format,
      padding: frameDefaults.padding,
      calendarScale: frameDefaults.calendarScale,
      background: frameDefaults.background,
    },
  });

  return applyPropertyPhotoToCalendarStyles(styles, options.propertyPhotoUrl);
}

export const CALENDAR_AI_FORMATS: CalendarCanvasFormat[] = ['square', 'portrait', 'landscape'];

/** One AI design → three format-ready style payloads (no extra AI calls). */
export function resolveAiGeneratedCalendarStylesForAllFormats(
  tokensInput: Partial<CalendarTemplateTokens>,
  options: Omit<ResolveAiCalendarOptions, 'format'>
): Array<{ format: CalendarCanvasFormat; aspectPreset: string; styles: CalendarStyles }> {
  return CALENDAR_AI_FORMATS.map((format) => ({
    format,
    aspectPreset: calendarFormatToAspectPreset(format),
    styles: resolveAiGeneratedCalendarStyles(tokensInput, { ...options, format }),
  }));
}
