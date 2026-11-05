import type { ResolvedMarketingTheme } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { mixTowardWhite } from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';

/** CSS `background` for the theme's paper in small previews (matches the background style). */
export function themeSurfaceBackground(theme: ResolvedMarketingTheme): string {
  switch (theme.tokens.background) {
    case 'soft-gradient':
      return `linear-gradient(165deg, ${theme.surface} 0%, ${mixTowardWhite(theme.primary, 0.82)} 100%)`;
    case 'pattern':
      return `radial-gradient(${mixTowardWhite(theme.primary, 0.45)} 1.2px, transparent 1.3px) 0 0 / 10px 10px, ${theme.surface}`;
    case 'photo-wash':
      return `linear-gradient(160deg, ${mixTowardWhite(theme.primary, 0.7)} 0%, ${theme.surface} 70%)`;
    default:
      return theme.surface;
  }
}
