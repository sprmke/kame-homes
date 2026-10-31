import {
  posterFontFamilies,
  type PosterTypeRole,
} from '@/features/dashboard/marketing/lib/poster/posterFonts';
import { setPosterTextMeasurer } from '@/features/dashboard/marketing/lib/poster/posterText';

/**
 * Loads every poster font up front and switches text fitting to real canvas
 * measurement (browser only). Compiling before fonts load would size copy from
 * width estimates, which is how pills clip ("Take a staycation with") and labels
 * break mid-word.
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
]);

const LOAD_TIMEOUT_MS = 6_000;
let loading: Promise<void> | null = null;

function injectStylesheet(family: string): void {
  const id = `poster-font-${family.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const spec = SINGLE_WEIGHT_FAMILIES.has(family)
    ? family.replace(/ /g, '+')
    : `${family.replace(/ /g, '+')}:wght@400;700`;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  document.head.appendChild(link);
}

function createCanvasMeasurer() {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return null;
  return (value: string, role: PosterTypeRole, fontSize: number): number | null => {
    if (!document.fonts.check(`${role.weight} ${fontSize}px "${role.family}"`)) return null;
    const text = role.uppercase ? value.toUpperCase() : value;
    context.font = `${role.style ?? 'normal'} ${role.weight} ${fontSize}px "${role.family}"`;
    const tracking = role.letterSpacing * fontSize * Math.max(0, [...text].length - 1);
    // 3% headroom: Konva's layout rounds differently from canvas measureText.
    return (context.measureText(text).width + tracking) * 1.03;
  };
}

export function preloadPosterFonts(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (loading) return loading;
  const families = posterFontFamilies();
  families.forEach(injectStylesheet);
  const loads = families.flatMap((family) =>
    (SINGLE_WEIGHT_FAMILIES.has(family) ? ['400'] : ['400', '700']).map((weight) =>
      document.fonts.load(`${weight} 40px "${family}"`).catch(() => [])
    )
  );
  loading = Promise.race([
    Promise.all(loads).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, LOAD_TIMEOUT_MS)),
  ]).then(() => {
    setPosterTextMeasurer(createCanvasMeasurer());
  });
  return loading;
}
