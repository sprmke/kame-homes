import type { CampaignPalette } from '@/features/dashboard/marketing/lib/designBrandColors';
import {
  resolveMarketingTheme,
  sameMarketingTheme,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { remapThemeTree } from '@/features/dashboard/marketing/lib/theme/themeRemap';

/**
 * Theme → inputs the Polotno campaign builders and the Remotion compositions
 * already understand (`CampaignPalette` + four font roles).
 */

export type CampaignFonts = {
  display: string;
  label: string;
  body: string;
  /** Big promo numbers ("₱500 OFF"). */
  numeral: string;
};

export function themeToCampaignPalette(theme: MarketingThemeTokens): CampaignPalette {
  const resolved = resolveMarketingTheme(theme);
  return {
    accent: resolved.primary,
    accentDark: resolved.primaryDark,
    accentForeground: resolved.onPrimary,
    ink: resolved.readableInk,
    cream: resolved.surface,
    success: '#16a34a',
    danger: '#dc2626',
  };
}

/** The four Quiet Coast campaign faces → the theme's type roles. */
export function campaignFontMap(
  theme: MarketingThemeTokens,
  faces: { display: string; label: string; body: string; numeral: string }
): Map<string, string> {
  const fonts = themeToCampaignFonts(theme);
  return new Map([
    [faces.display, fonts.display],
    [faces.label, fonts.label],
    [faces.body, fonts.body],
    [faces.numeral, fonts.numeral],
  ]);
}

export function themeToCampaignFonts(theme: MarketingThemeTokens): CampaignFonts {
  return {
    display: theme.fonts.display,
    label: theme.fonts.label,
    body: theme.fonts.body,
    // Numerals read best in the display face; it is the one designed to be big.
    numeral: theme.fonts.display,
  };
}

// ── Polotno documents ────────────────────────────────────────────────────────

type PolotnoNode = Record<string, unknown> & { id?: string; children?: PolotnoNode[] };
type PolotnoDoc = { pages?: Array<PolotnoNode & { background?: unknown }> } & Record<
  string,
  unknown
>;

/** Visual props a theme controls on a Polotno element. */
const THEMED_ELEMENT_PROPS = [
  'fill',
  'stroke',
  'fontFamily',
  'shadowColor',
  'backgroundColor',
  'cornerRadius',
] as const;

function elementThemeSignature(node: PolotnoNode): string {
  return JSON.stringify(THEMED_ELEMENT_PROPS.map((prop) => node[prop] ?? null));
}

function forEachElement(doc: PolotnoDoc, visit: (node: PolotnoNode) => void): void {
  const walk = (nodes: PolotnoNode[] | undefined) => {
    for (const node of nodes ?? []) {
      visit(node);
      if (Array.isArray(node.children)) walk(node.children);
    }
  };
  for (const page of doc.pages ?? []) walk(page.children);
}

/** Theme-relevant look of every element, keyed by id (taken right after a themed load). */
export function polotnoThemeBaseline(doc: unknown): Map<string, string> {
  const baseline = new Map<string, string>();
  if (!doc || typeof doc !== 'object') return baseline;
  forEachElement(doc as PolotnoDoc, (node) => {
    if (typeof node.id === 'string') baseline.set(node.id, elementThemeSignature(node));
  });
  return baseline;
}

/**
 * Elements the host changed by hand since the baseline (or added themselves).
 * Those keep their colors and fonts when the theme changes.
 */
export function polotnoHandEditedIds(doc: unknown, baseline: Map<string, string>): string[] {
  if (!doc || typeof doc !== 'object') return [];
  const edited: string[] = [];
  forEachElement(doc as PolotnoDoc, (node) => {
    if (typeof node.id !== 'string') return;
    const before = baseline.get(node.id);
    if (before === undefined || before !== elementThemeSignature(node)) edited.push(node.id);
  });
  return edited;
}

/**
 * A saved Polotno document moved to another theme. Locked elements (hand-edited)
 * and photos are untouched; page backgrounds that are colors follow the theme.
 */
export function rethemePolotnoDocument<T>(
  doc: T,
  from: MarketingThemeTokens,
  to: MarketingThemeTokens,
  lockedIds: readonly string[] = []
): T {
  if (sameMarketingTheme(from, to) || !doc || typeof doc !== 'object') return doc;
  const locked = new Set(lockedIds);
  const source = doc as unknown as PolotnoDoc;
  const remapNode = (node: PolotnoNode): PolotnoNode => {
    if (typeof node.id === 'string' && locked.has(node.id)) return node;
    const { children, ...rest } = node;
    const themed = remapThemeTree(rest, from, to);
    return Array.isArray(children) ? { ...themed, children: children.map(remapNode) } : themed;
  };
  return {
    ...source,
    pages: (source.pages ?? []).map((page) => ({
      ...page,
      background:
        typeof page.background === 'string'
          ? remapThemeTree({ color: page.background }, from, to).color
          : page.background,
      children: (page.children ?? []).map(remapNode),
    })),
  } as unknown as T;
}

/** Swaps the four campaign faces for the theme's roles in a freshly built document. */
export function applyCampaignFontsToDocument<T>(doc: T, fontMap: ReadonlyMap<string, string>): T {
  if (!doc || typeof doc !== 'object' || fontMap.size === 0) return doc;
  const source = doc as unknown as PolotnoDoc;
  const mapNode = (node: PolotnoNode): PolotnoNode => {
    const family = typeof node.fontFamily === 'string' ? fontMap.get(node.fontFamily) : undefined;
    const next = family ? { ...node, fontFamily: family } : node;
    return Array.isArray(node.children) ? { ...next, children: node.children.map(mapNode) } : next;
  };
  return {
    ...source,
    pages: (source.pages ?? []).map((page) => ({
      ...page,
      children: (page.children ?? []).map(mapNode),
    })),
  } as unknown as T;
}
