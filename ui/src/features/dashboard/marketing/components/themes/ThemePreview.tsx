import type { CSSProperties } from 'react';

import { useResolvedMarketingTheme } from '@/features/dashboard/marketing/hooks/useResolvedMarketingTheme';
import type {
  MarketingThemeTokens,
  ResolvedMarketingTheme,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { themeSurfaceBackground } from '@/features/dashboard/marketing/lib/theme/marketingThemeCss';

import { cn } from '@/lib/utils';

/**
 * Small theme art drawn with plain DOM + CSS: no canvas, no capture queue, so
 * it costs nothing to repaint while the host edits a theme.
 */

export function ThemeSwatchDots({
  tokens,
  className,
}: {
  tokens: MarketingThemeTokens;
  className?: string;
}) {
  const { primary, secondary, accent } = tokens.palette;
  return (
    <span className={cn('flex shrink-0 -space-x-1', className)} aria-hidden>
      {[primary, secondary, accent].map((color, index) => (
        <span
          key={index}
          className="ring-card size-3.5 rounded-full ring-2"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

function themeType(theme: ResolvedMarketingTheme) {
  const display: CSSProperties = { fontFamily: `"${theme.fonts.display}", serif` };
  const label: CSSProperties = { fontFamily: `"${theme.fonts.label}", sans-serif` };
  const chipRadius = theme.radius.lg >= 999 ? 999 : Math.min(theme.radius.sm, 6);
  return { display, label, chipRadius };
}

/**
 * A promo post in the theme, sized by its container (container-query units),
 * the sample art on theme cards.
 */
export function ThemePostArt({
  theme,
  title,
  photoUrl,
}: {
  theme: ResolvedMarketingTheme;
  title: string;
  photoUrl?: string;
}) {
  const { display, label, chipRadius } = themeType(theme);
  return (
    <div
      className="@container flex size-full flex-col overflow-hidden"
      style={{ background: themeSurfaceBackground(theme) }}
    >
      <div
        className="relative mx-[7cqw] mt-[7cqw] flex-1 overflow-hidden"
        style={{
          backgroundColor: theme.secondary,
          borderRadius: Math.min(theme.radius.md, 10),
        }}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : null}
      </div>
      <div className="space-y-[2.5cqw] px-[7cqw] pb-[8cqw] pt-[5cqw]">
        <span
          className="block text-[7cqw] font-semibold uppercase leading-none tracking-wider"
          style={{ ...label, color: theme.primary }}
        >
          Weekend deal
        </span>
        <span
          className="block truncate text-[12cqw] leading-none"
          style={{ ...display, color: theme.readableInk }}
        >
          {title}
        </span>
        <span
          className="inline-block px-[4cqw] py-[1.5cqw] text-[6.5cqw] font-semibold leading-tight"
          style={{
            ...label,
            backgroundColor: theme.primary,
            color: theme.onPrimary,
            borderRadius: chipRadius,
          }}
        >
          Book now
        </span>
      </div>
    </div>
  );
}

/** A story-style video frame in the theme (sample art on theme cards). */
export function ThemeVideoArt({
  theme,
  photoUrl,
}: {
  theme: ResolvedMarketingTheme;
  photoUrl?: string;
}) {
  const { display, label, chipRadius } = themeType(theme);
  return (
    <div
      className="@container relative flex size-full items-end overflow-hidden"
      style={{ backgroundColor: theme.primaryDark }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <div className="absolute inset-x-[8cqw] top-[7cqw] flex gap-[2cqw]">
        {[1, 0.45, 0.45].map((opacity, index) => (
          <span
            key={index}
            className="h-[1.6cqw] flex-1 rounded-full bg-white"
            style={{ opacity }}
          />
        ))}
      </div>
      <div
        className="relative w-full space-y-[3cqw] px-[8cqw] pb-[10cqw] pt-[24cqw]"
        style={{ background: `linear-gradient(to top, ${theme.primaryDark}f0, transparent)` }}
      >
        <span className="block text-[15cqw] leading-[0.95] text-white" style={display}>
          Slow mornings
        </span>
        <span
          className="inline-block px-[5cqw] py-[2cqw] text-[8cqw] font-semibold leading-tight"
          style={{
            ...label,
            backgroundColor: theme.accent,
            color: theme.onAccent,
            borderRadius: chipRadius,
          }}
        >
          Stay with us
        </span>
      </div>
    </div>
  );
}

/** Headline, body and buttons in the theme: how the fonts and text colors read together. */
export function ThemeTypeSpecimen({
  tokens,
  className,
}: {
  tokens: MarketingThemeTokens;
  className?: string;
}) {
  const theme = useResolvedMarketingTheme(tokens);
  const { display, label, chipRadius } = themeType(theme);
  const body: CSSProperties = { fontFamily: `"${theme.fonts.body}", sans-serif` };
  return (
    <div
      className={cn('space-y-2 overflow-hidden rounded-xl p-4', className)}
      style={{ background: themeSurfaceBackground(theme) }}
      aria-hidden
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ ...label, color: theme.primary }}
      >
        This weekend
      </p>
      <p className="text-2xl leading-tight" style={{ ...display, color: theme.readableInk }}>
        Slow mornings by the sea
      </p>
      <p className="text-sm leading-relaxed" style={{ ...body, color: theme.muted }}>
        Two nights with breakfast, ten minutes from the beach.
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <span
          className="px-3 py-1.5 text-xs font-semibold"
          style={{
            ...label,
            backgroundColor: theme.primary,
            color: theme.onPrimary,
            borderRadius: chipRadius,
          }}
        >
          Book now
        </span>
        <span
          className="px-3 py-1.5 text-xs font-semibold"
          style={{
            ...label,
            backgroundColor: theme.accent,
            color: theme.onAccent,
            borderRadius: chipRadius,
          }}
        >
          Few dates left
        </span>
      </div>
    </div>
  );
}
