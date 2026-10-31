import type { CalendarCanvasFormat } from '@/features/dashboard/marketing/lib/calendarCanvasFormats';

/**
 * AI calendar tokens. Inside a theme the AI only chooses the layout and the words:
 * `themedAiCalendarStyles` (lib/theme/aiThemeAdapter.ts) dresses the chosen layout in
 * the theme, so the token palette and font pairing are kept for the record only.
 */

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

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function safeHex(value: string | undefined, fallback: string): string {
  return value && HEX_RE.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

/** Truncates at the last whitespace before `max` so AI copy never gets cut mid-word. */
function truncateAtWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return lastSpace > max * 0.4 ? slice.slice(0, lastSpace).trimEnd() : slice;
}
export function normalizeCalendarTemplateTokens(
  raw: Partial<CalendarTemplateTokens> | null | undefined
): CalendarTemplateTokens {
  const palette = raw?.palette ?? { primary: '#a48ee0', secondary: '#f3edfd', accent: '#ff8fa8' };
  return {
    layoutArchetype:
      raw?.layoutArchetype && raw.layoutArchetype in ARCHETYPE_SEED
        ? raw.layoutArchetype
        : 'bubble',
    palette: {
      primary: safeHex(palette.primary, '#a48ee0'),
      secondary: safeHex(palette.secondary, '#f3edfd'),
      accent: safeHex(palette.accent, '#ff8fa8'),
    },
    fontPairing: raw?.fontPairing ?? 'soft-sans',
    backgroundMood: raw?.backgroundMood ?? 'solid-cream',
    subtitle:
      truncateAtWordBoundary((raw?.subtitle ?? 'Available dates').trim(), 48) || 'Available dates',
    label: truncateAtWordBoundary((raw?.label ?? 'AI calendar').trim(), 40) || 'AI calendar',
  };
}

/** One AI result is saved in all three calendar formats (no extra AI calls). */
export const CALENDAR_AI_FORMATS: CalendarCanvasFormat[] = ['square', 'portrait', 'landscape'];
