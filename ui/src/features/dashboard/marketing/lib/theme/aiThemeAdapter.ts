import type { CalendarStyles } from '@/features/dashboard/marketing/components/calendar-builder/types';
import { calendarAiArchetypeSeed } from '@/features/dashboard/marketing/lib/calendarAiTokens';
import type { CalendarTemplateTokens } from '@/features/dashboard/marketing/lib/calendarAiTokens';
import type { CalendarCanvasFormat } from '@/features/dashboard/marketing/lib/calendarCanvasFormats';
import type {
  DesignBackgroundMood,
  DesignTemplateTokens,
} from '@/features/dashboard/marketing/lib/designAiTokens';
import { resolveThemedCalendarLayout } from '@/features/dashboard/marketing/lib/theme/calendarThemeAdapter';
import type {
  MarketingThemeBackground,
  MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';

/**
 * AI inside a theme: the model still picks layout, copy and photos, but colors
 * and fonts always come from the theme, so AI results sit next to everything
 * else the host made in it.
 */

// ── Calendar ─────────────────────────────────────────────────────────────────

/** The AI's layout choice, dressed in the theme, with the AI subtitle. */
export function themedAiCalendarStyles(
  tokens: CalendarTemplateTokens,
  theme: MarketingThemeTokens,
  format: CalendarCanvasFormat,
  propertyPhotoUrl?: string
): CalendarStyles {
  const styles = resolveThemedCalendarLayout({
    layoutId: calendarAiArchetypeSeed(tokens.layoutArchetype),
    theme,
    format,
    propertyPhotoUrl,
  });
  return {
    ...styles,
    header: {
      ...styles.header,
      subtitle: { ...styles.header.subtitle, show: true, text: tokens.subtitle },
    },
  };
}

// ── Posts (AI design) ────────────────────────────────────────────────────────

const DESIGN_BACKGROUND_BY_THEME: Record<MarketingThemeBackground, DesignBackgroundMood> = {
  solid: 'solid',
  'soft-gradient': 'gradient',
  pattern: 'color-wash',
  'photo-wash': 'photo',
};

/**
 * AI design tokens with the theme's palette and background. Fonts use the
 * editorial pairing (four distinct faces) so `themeCampaignFontMap` can swap
 * each one for its theme role after compiling.
 */
export function themedAiDesignTokens(
  tokens: DesignTemplateTokens,
  theme: MarketingThemeTokens
): DesignTemplateTokens {
  return {
    ...tokens,
    palette: {
      primary: theme.palette.primary,
      secondary: theme.palette.secondary,
      accent: theme.palette.accent,
    },
    fontPairing: 'serif-editorial',
    backgroundMood: DESIGN_BACKGROUND_BY_THEME[theme.background],
  };
}
