/**
 * Fonts a marketing theme may use. One list for every surface (calendar DOM,
 * Polotno/Konva, Remotion) so a theme never names a face one editor can't draw.
 * Families not preloaded in `ui/index.html` load on demand via `marketingFontLoader`.
 */

export const MARKETING_THEME_FONT_FAMILIES = [
  'Fraunces',
  'Playfair Display',
  'Cormorant Garamond',
  'Lora',
  'Instrument Serif',
  'DM Sans',
  'Plus Jakarta Sans',
  'Outfit',
  'Manrope',
  'Sora',
  'Jost',
  'Figtree',
  'Nunito Sans',
  'Inter Tight',
  'Space Grotesk',
  'Poppins',
  'Montserrat',
  'Lato',
  'Open Sans',
  'Inter',
] as const;

export type MarketingThemeFontFamily = (typeof MARKETING_THEME_FONT_FAMILIES)[number];

const FAMILY_SET = new Set<string>(MARKETING_THEME_FONT_FAMILIES);

export function isMarketingThemeFontFamily(value: unknown): value is MarketingThemeFontFamily {
  return typeof value === 'string' && FAMILY_SET.has(value);
}

/** Families already requested by `ui/index.html` (no extra stylesheet needed). */
export const PRELOADED_MARKETING_FONT_FAMILIES: ReadonlySet<string> = new Set([
  'Cormorant Garamond',
  'DM Sans',
  'Figtree',
  'Fraunces',
  'Instrument Serif',
  'Inter Tight',
  'Jost',
  'Lora',
  'Manrope',
  'Nunito Sans',
  'Outfit',
  'Playfair Display',
  'Plus Jakarta Sans',
  'Sora',
  'Space Grotesk',
]);

export type MarketingThemeFonts = {
  /** Headlines, month name, big promo numbers. */
  display: string;
  /** Sentences, day numbers, captions. */
  body: string;
  /** Small caps labels, day names, chips. */
  label: string;
};

export type MarketingFontPairing = {
  id: string;
  label: string;
  fonts: MarketingThemeFonts;
};

/** Curated pairings for the simple theme editor. Advanced mode can set each role. */
export const MARKETING_FONT_PAIRINGS: readonly MarketingFontPairing[] = [
  {
    id: 'soft-editorial',
    label: 'Soft editorial',
    fonts: { display: 'Fraunces', body: 'Plus Jakarta Sans', label: 'Jost' },
  },
  {
    id: 'classic-serif',
    label: 'Classic serif',
    fonts: { display: 'Playfair Display', body: 'Lora', label: 'Montserrat' },
  },
  {
    id: 'elegant',
    label: 'Elegant',
    fonts: { display: 'Cormorant Garamond', body: 'Manrope', label: 'Jost' },
  },
  {
    id: 'friendly',
    label: 'Friendly',
    fonts: { display: 'Poppins', body: 'Nunito Sans', label: 'Poppins' },
  },
  {
    id: 'modern',
    label: 'Modern',
    fonts: { display: 'Sora', body: 'DM Sans', label: 'Space Grotesk' },
  },
  {
    id: 'clean',
    label: 'Clean',
    fonts: { display: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans', label: 'Jost' },
  },
  {
    id: 'bold-geometric',
    label: 'Bold geometric',
    fonts: { display: 'Outfit', body: 'Figtree', label: 'Outfit' },
  },
  {
    id: 'magazine',
    label: 'Magazine',
    fonts: { display: 'Instrument Serif', body: 'Inter Tight', label: 'Inter Tight' },
  },
] as const;

export const DEFAULT_MARKETING_THEME_FONTS: MarketingThemeFonts = MARKETING_FONT_PAIRINGS[0]!.fonts;

/** Pairing whose three roles match exactly, if any (for the simple picker's selection). */
export function findMarketingFontPairing(fonts: MarketingThemeFonts): MarketingFontPairing | null {
  return (
    MARKETING_FONT_PAIRINGS.find(
      (p) =>
        p.fonts.display === fonts.display &&
        p.fonts.body === fonts.body &&
        p.fonts.label === fonts.label
    ) ?? null
  );
}

export function marketingThemeFontList(fonts: MarketingThemeFonts): string[] {
  return [...new Set([fonts.display, fonts.body, fonts.label])];
}
