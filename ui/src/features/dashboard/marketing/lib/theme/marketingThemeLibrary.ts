import type { MarketingThemeRecord } from '@/features/dashboard/marketing/hooks/useMarketingThemes';
import {
  coerceMarketingThemeTokens,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  BUILTIN_PROPERTY_COLORS_THEME_KEY,
  parseMarketingThemeKey,
  starterThemeKey,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeKeys';
import {
  findStarterTheme,
  listStarterThemes,
} from '@/features/dashboard/marketing/lib/theme/starterThemes';

/**
 * The theme catalog a property sees: the built-in Property colors theme, the
 * themes the host saved, and the starter looks. Pure: the provider feeds it the
 * server rows and the property's photo-derived tokens.
 */

export type MarketingThemeKind = 'property-colors' | 'starter' | 'custom';

export type MarketingThemeEntry = {
  key: string;
  name: string;
  tokens: MarketingThemeTokens;
  kind: MarketingThemeKind;
  /** Starter looks only: the calendar layout this look was designed for. */
  calendarLayoutId?: string;
  /** Starter group label (picker section). */
  group?: string;
  itemCount: number;
  /** Only custom themes are edited in place; built-ins are copied on save. */
  editable: boolean;
  record?: MarketingThemeRecord;
};

export type MarketingThemeLibrary = {
  /** Property colors, then saved themes, then starters that already hold items. */
  mine: MarketingThemeEntry[];
  starters: MarketingThemeEntry[];
  byKey: Map<string, MarketingThemeEntry>;
};

export const PROPERTY_COLORS_THEME_NAME = 'Property colors';

export function buildMarketingThemeLibrary(input: {
  propertyColorsTokens: MarketingThemeTokens;
  records: MarketingThemeRecord[];
  itemCounts: Record<string, number>;
}): MarketingThemeLibrary {
  const count = (key: string) => input.itemCounts[key] ?? 0;

  const propertyColors: MarketingThemeEntry = {
    key: BUILTIN_PROPERTY_COLORS_THEME_KEY,
    name: PROPERTY_COLORS_THEME_NAME,
    tokens: input.propertyColorsTokens,
    kind: 'property-colors',
    itemCount: count(BUILTIN_PROPERTY_COLORS_THEME_KEY),
    editable: false,
  };

  const custom = input.records.map((record): MarketingThemeEntry => ({
    key: record.id,
    name: record.name,
    tokens: coerceMarketingThemeTokens(record.tokens),
    kind: 'custom',
    itemCount: count(record.id),
    editable: true,
    record,
  }));

  const starters = listStarterThemes().map((starter): MarketingThemeEntry => ({
    key: starterThemeKey(starter.id),
    name: starter.label,
    tokens: starter.tokens,
    kind: 'starter',
    calendarLayoutId: starter.calendarLayoutId,
    group: starter.group,
    itemCount: count(starterThemeKey(starter.id)),
    editable: false,
  }));

  const usedStarters = starters.filter((entry) => entry.itemCount > 0);
  const mine = [propertyColors, ...custom, ...usedStarters];
  const byKey = new Map<string, MarketingThemeEntry>();
  for (const entry of [propertyColors, ...custom, ...starters]) byKey.set(entry.key, entry);
  return { mine, starters, byKey };
}

/**
 * Resolves a key against the library. Unknown starters and deleted custom
 * themes return null so the caller can fall back (and tell the host).
 */
export function findMarketingThemeEntry(
  library: MarketingThemeLibrary,
  key: string | null | undefined
): MarketingThemeEntry | null {
  const ref = parseMarketingThemeKey(key);
  if (!ref) return null;
  if (ref.kind === 'starter' && !findStarterTheme(ref.starterId)) return null;
  return library.byKey.get(key || BUILTIN_PROPERTY_COLORS_THEME_KEY) ?? null;
}

/** "Bubble Pop" → "Bubble Pop 2" when taken (case-insensitive). */
export function uniqueThemeName(base: string, taken: readonly string[]): string {
  const trimmed = base.replace(/\s+/g, ' ').trim().slice(0, 56) || 'My theme';
  const lower = new Set(taken.map((name) => name.toLowerCase()));
  if (!lower.has(trimmed.toLowerCase())) return trimmed;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${trimmed} ${n}`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
  return `${trimmed} ${Date.now() % 1000}`;
}
