import type { PosterFontPairing } from '@/features/dashboard/marketing/lib/poster/posterFonts';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';

/**
 * AI Post inside a theme: the archetype keeps its composition craft and the AI's
 * script accent; palette and the headline / body / label faces come from the theme.
 */

export function posterPaletteInputFromTheme(theme: MarketingThemeTokens) {
  return {
    accent: theme.palette.primary,
    secondary: theme.palette.accent,
    field: theme.palette.surface,
  };
}

/**
 * The pairing with the theme's faces in the headline, body and label roles.
 * Sizes, tracking and effects stay; text fitting re-measures with real fonts.
 */
export function themedPosterFontPairing(
  pairing: PosterFontPairing,
  theme: MarketingThemeTokens
): PosterFontPairing {
  return {
    ...pairing,
    display: { ...pairing.display, family: theme.fonts.display },
    body: { ...pairing.body, family: theme.fonts.body },
    eyebrow: { ...pairing.eyebrow, family: theme.fonts.label },
    chip: { ...pairing.chip, family: theme.fonts.label },
  };
}
