import type { MarketingTemplateRecord } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { CALENDAR_DESIGNER_PRESET_IDS } from '@/features/dashboard/marketing/lib/calendarPresetCatalog';
import {
  marketingThemeHash,
  parseMarketingThemeTokens,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  BUILTIN_PROPERTY_COLORS_THEME_KEY,
  starterThemeKey,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeKeys';

/**
 * Saved items (marketing_templates rows) ↔ themes.
 *
 * New saves carry `theme_key` plus a snapshot of the theme they were made in
 * (`designJson.themeTokens`) and the paths the host set by hand
 * (`designJson.lockedPaths`). The snapshot is what lets an item follow later
 * theme edits: we re-theme from the snapshot to the current tokens.
 */

const DESIGNER_PRESETS = new Set<string>(CALENDAR_DESIGNER_PRESET_IDS);

function sourcePreset(record: Pick<MarketingTemplateRecord, 'designJson'>): string | null {
  const value = record.designJson?.sourcePresetId;
  return typeof value === 'string' && value ? value : null;
}

/**
 * The theme an item lives in. Rows from before themes have no key: a calendar
 * edited from a designer look belongs to that look's starter theme (so it keeps
 * its colors); everything else was brand-tinted and belongs to Property colors.
 */
export function effectiveTemplateThemeKey(
  record: Pick<MarketingTemplateRecord, 'themeKey' | 'contentType' | 'designJson'>
): string {
  if (record.themeKey) return record.themeKey;
  const preset = sourcePreset(record);
  if (record.contentType === 'calendar' && preset && DESIGNER_PRESETS.has(preset)) {
    return starterThemeKey(preset);
  }
  return BUILTIN_PROPERTY_COLORS_THEME_KEY;
}

export function templatesInTheme<T extends MarketingTemplateRecord>(
  templates: readonly T[],
  themeKey: string
): T[] {
  return templates.filter((template) => effectiveTemplateThemeKey(template) === themeKey);
}

export type TemplateThemeSnapshot = {
  tokens: MarketingThemeTokens | null;
  lockedPaths: string[];
};

export function readTemplateThemeSnapshot(
  designJson: Record<string, unknown> | undefined
): TemplateThemeSnapshot {
  const lockedRaw = designJson?.lockedPaths;
  return {
    tokens: parseMarketingThemeTokens(designJson?.themeTokens),
    lockedPaths: Array.isArray(lockedRaw)
      ? lockedRaw.filter((path): path is string => typeof path === 'string').slice(0, 500)
      : [],
  };
}

/** Fields every save adds to `designJson` so the item can follow its theme later. */
export function themeStampForSave(
  tokens: MarketingThemeTokens,
  lockedPaths: readonly string[] = []
): { themeTokens: MarketingThemeTokens; themeHash: string; lockedPaths: string[] } {
  return {
    themeTokens: tokens,
    themeHash: marketingThemeHash(tokens),
    lockedPaths: [...new Set(lockedPaths)].slice(0, 500),
  };
}
