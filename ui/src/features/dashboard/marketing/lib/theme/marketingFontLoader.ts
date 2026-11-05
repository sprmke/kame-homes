import { PRELOADED_MARKETING_FONT_FAMILIES } from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';

/**
 * On-demand Google Fonts for marketing surfaces. Canvas (Konva) and Remotion
 * draw with whatever face is loaded at paint time, so callers await
 * `loadMarketingFonts` before rendering or capturing.
 */

/** Families published with a single weight: requesting `wght@400;700` would 400 the stylesheet. */
const SINGLE_WEIGHT_FAMILIES = new Set([
  'Great Vibes',
  'Allura',
  'Sacramento',
  'Parisienne',
  'Kaushan Script',
  'Lilita One',
  'DM Serif Display',
  'Instrument Serif',
]);

const LOAD_TIMEOUT_MS = 6_000;
const pending = new Map<string, Promise<void>>();

function stylesheetId(family: string): string {
  return `marketing-font-${family.replace(/\s+/g, '-').toLowerCase()}`;
}

/** Adds the Google Fonts stylesheet for `family` once (no-op when preloaded or present). */
function injectGoogleFontStylesheet(family: string): void {
  if (typeof document === 'undefined') return;
  if (PRELOADED_MARKETING_FONT_FAMILIES.has(family)) return;
  const id = stylesheetId(family);
  if (document.getElementById(id)) return;
  const spec = SINGLE_WEIGHT_FAMILIES.has(family)
    ? family.replace(/ /g, '+')
    : `${family.replace(/ /g, '+')}:wght@400;500;600;700`;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  document.head.appendChild(link);
}

function loadFamily(family: string): Promise<void> {
  const existing = pending.get(family);
  if (existing) return existing;
  injectGoogleFontStylesheet(family);
  const weights = SINGLE_WEIGHT_FAMILIES.has(family) ? ['400'] : ['400', '600', '700'];
  const load = Promise.all(
    weights.map((weight) => document.fonts.load(`${weight} 40px "${family}"`).catch(() => []))
  ).then(() => undefined);
  pending.set(family, load);
  return load;
}

/**
 * Resolves once every family is usable or after a timeout (offline / blocked CDN
 * falls back to system faces rather than hanging a render).
 */
export function loadMarketingFonts(families: readonly string[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const unique = [...new Set(families.filter((f) => f && f !== 'system-ui'))];
  if (unique.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.all(unique.map(loadFamily)).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, LOAD_TIMEOUT_MS)),
  ]);
}
