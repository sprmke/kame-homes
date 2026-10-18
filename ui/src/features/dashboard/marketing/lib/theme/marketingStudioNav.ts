/**
 * Marketing Studio navigation state that is not routing: tab ids (kept stable
 * for links and tests while labels change) and the per-property last theme.
 */

export const MARKETING_STUDIO_TABS = ['calendar', 'design', 'video', 'generate'] as const;
export type MarketingStudioTab = (typeof MARKETING_STUDIO_TABS)[number];

export const MARKETING_STUDIO_TAB_LABELS: Record<MarketingStudioTab, string> = {
  calendar: 'Calendar',
  design: 'Posts',
  video: 'Videos',
  generate: 'AI Studio',
};

export function normalizeMarketingStudioTab(value: string | null | undefined): MarketingStudioTab {
  return (MARKETING_STUDIO_TABS as readonly string[]).includes(value ?? '')
    ? (value as MarketingStudioTab)
    : 'calendar';
}

function lastThemeStorageKey(propertyId: string | null): string | null {
  return propertyId ? `marketing-last-theme:${propertyId}` : null;
}

/** Last theme opened for this property, or null (first visit / storage blocked). */
export function readLastMarketingTheme(propertyId: string | null): string | null {
  const key = lastThemeStorageKey(propertyId);
  if (!key) return null;
  try {
    const value = window.localStorage.getItem(key);
    return value && value.length <= 80 ? value : null;
  } catch {
    return null;
  }
}

export function writeLastMarketingTheme(propertyId: string | null, themeKey: string): void {
  const key = lastThemeStorageKey(propertyId);
  if (!key) return;
  try {
    window.localStorage.setItem(key, themeKey);
  } catch {
    // Private mode / blocked storage: the picker shows again next visit. Fine.
  }
}
