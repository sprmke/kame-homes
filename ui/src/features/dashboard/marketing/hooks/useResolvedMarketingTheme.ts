import { useEffect, useMemo } from 'react';

import { loadMarketingFonts } from '@/features/dashboard/marketing/lib/theme/marketingFontLoader';
import {
  resolveMarketingTheme,
  type MarketingThemeTokens,
  type ResolvedMarketingTheme,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { marketingThemeFontList } from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';

/** Resolved roles for previews; also loads the theme's fonts (most are preloaded). */
export function useResolvedMarketingTheme(tokens: MarketingThemeTokens): ResolvedMarketingTheme {
  useEffect(() => {
    void loadMarketingFonts(marketingThemeFontList(tokens.fonts));
  }, [tokens.fonts]);
  return useMemo(() => resolveMarketingTheme(tokens), [tokens]);
}
