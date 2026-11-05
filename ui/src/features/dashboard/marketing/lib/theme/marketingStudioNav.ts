/**
 * Marketing Studio navigation state that is not routing: tab ids (kept stable
 * for links and tests while labels change), the per-property last theme and the
 * per-property last tab.
 */

/** Display order: AI Studio first, daily tools next, the monthly calendar last. */
export const MARKETING_STUDIO_TABS = ['generate', 'design', 'video', 'calendar'] as const;
export type MarketingStudioTab = (typeof MARKETING_STUDIO_TABS)[number];

/** Tabs that open an editor on a saved item (`?item=`). AI Studio has no items. */
export type MarketingEditorTab = Exclude<MarketingStudioTab, 'generate'>;

export const MARKETING_STUDIO_TAB_LABELS: Record<MarketingStudioTab, string> = {
  generate: 'AI Studio',
  design: 'Posts',
  video: 'Videos',
  calendar: 'Calendar',
};

export function isMarketingStudioTab(value: unknown): value is MarketingStudioTab {
  return (MARKETING_STUDIO_TABS as readonly unknown[]).includes(value);
}

export function isMarketingEditorTab(value: unknown): value is MarketingEditorTab {
  return value === 'design' || value === 'video' || value === 'calendar';
}

/**
 * Tab to open when the URL has none: the last tab used on this property, else
 * AI Studio when the host can generate anything, else Posts.
 */
export function resolveDefaultMarketingStudioTab(input: {
  lastTab: string | null;
  aiAvailable: boolean;
}): MarketingStudioTab {
  if (isMarketingStudioTab(input.lastTab)) return input.lastTab;
  return input.aiAvailable ? 'generate' : 'design';
}

export function normalizeMarketingStudioTab(
  value: string | null | undefined,
  fallback: MarketingStudioTab = 'generate'
): MarketingStudioTab {
  return isMarketingStudioTab(value) ? value : fallback;
}

function readKey(key: string | null, maxLength: number): string | null {
  if (!key) return null;
  try {
    const value = window.localStorage.getItem(key);
    return value && value.length <= maxLength ? value : null;
  } catch {
    return null;
  }
}

function writeKey(key: string | null, value: string): void {
  if (!key) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage: the default applies next visit. Fine.
  }
}

function lastThemeStorageKey(propertyId: string | null): string | null {
  return propertyId ? `marketing-last-theme:${propertyId}` : null;
}

function lastTabStorageKey(propertyId: string | null): string | null {
  return propertyId ? `marketing-last-tab:${propertyId}` : null;
}

/** Last theme opened for this property, or null (first visit / storage blocked). */
export function readLastMarketingTheme(propertyId: string | null): string | null {
  return readKey(lastThemeStorageKey(propertyId), 80);
}

export function writeLastMarketingTheme(propertyId: string | null, themeKey: string): void {
  writeKey(lastThemeStorageKey(propertyId), themeKey);
}

/** Last tab opened for this property, or null. */
export function readLastMarketingTab(propertyId: string | null): MarketingStudioTab | null {
  const value = readKey(lastTabStorageKey(propertyId), 20);
  return isMarketingStudioTab(value) ? value : null;
}

export function writeLastMarketingTab(propertyId: string | null, tab: MarketingStudioTab): void {
  writeKey(lastTabStorageKey(propertyId), tab);
}
