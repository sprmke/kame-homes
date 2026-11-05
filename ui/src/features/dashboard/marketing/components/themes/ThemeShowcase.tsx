import { memo, useMemo, type ReactNode } from 'react';

import { Play } from 'lucide-react';

import { CalendarMiniPreview } from '@/features/dashboard/marketing/components/shared/CalendarMiniPreview';
import {
  ThemePostArt,
  ThemeVideoArt,
} from '@/features/dashboard/marketing/components/themes/ThemePreview';
import { useResolvedMarketingTheme } from '@/features/dashboard/marketing/hooks/useResolvedMarketingTheme';
import { resolveThemedCalendarLayout } from '@/features/dashboard/marketing/lib/theme/calendarThemeAdapter';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { mixTowardWhite } from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';

import { cn } from '@/lib/utils';

const BLANK_LAYOUT_ID = 'default';

function Frame({
  className,
  rounded,
  children,
}: {
  className: string;
  rounded: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.45)] ring-1 ring-black/5',
        rounded,
        className
      )}
    >
      {children}
    </div>
  );
}

type Props = {
  tokens: MarketingThemeTokens;
  /** Layout the calendar tab opens with in this theme. */
  calendarLayoutId?: string;
  propertyName: string;
  photoUrl?: string;
  size?: 'card' | 'large';
  className?: string;
};

/**
 * Theme card art: a post, a calendar and a clip drawn from the theme itself.
 * Saved designs stay in the library. A half-finished canvas must not become the
 * card, so these three frames never swap in a stored thumbnail.
 */
export const ThemeShowcase = memo(function ThemeShowcase({
  tokens,
  calendarLayoutId,
  propertyName,
  photoUrl,
  size = 'card',
  className,
}: Props) {
  const theme = useResolvedMarketingTheme(tokens);
  const calendarStyles = useMemo(
    () =>
      resolveThemedCalendarLayout({
        layoutId: calendarLayoutId ?? BLANK_LAYOUT_ID,
        theme: tokens,
        format: 'square',
        propertyPhotoUrl: photoUrl,
      }),
    [tokens, photoUrl, calendarLayoutId]
  );

  const rounded = size === 'large' ? 'rounded-[10px]' : 'rounded-md';

  return (
    <div
      className={cn(
        'relative flex aspect-[16/9] items-center justify-center gap-[3%] overflow-hidden px-[4%]',
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${mixTowardWhite(theme.primary, 0.8)} 0%, ${mixTowardWhite(theme.accent, 0.86)} 100%)`,
      }}
      aria-hidden
    >
      <Frame className="aspect-[4/5] h-[56%]" rounded={rounded}>
        <ThemePostArt theme={theme} title={propertyName} photoUrl={photoUrl} />
      </Frame>

      <Frame className="aspect-square h-[70%]" rounded={rounded}>
        <CalendarMiniPreview styles={calendarStyles} className="absolute inset-0 size-full" />
      </Frame>

      <Frame className="aspect-[9/16] h-[64%]" rounded={rounded}>
        <ThemeVideoArt theme={theme} photoUrl={photoUrl} />
        <span className="absolute inset-x-0 top-[22%] flex justify-center">
          <span className="flex aspect-square w-[28%] items-center justify-center rounded-full bg-black/35 backdrop-blur-sm">
            <Play className="size-1/2 fill-white text-white" aria-hidden />
          </span>
        </span>
      </Frame>
    </div>
  );
});
