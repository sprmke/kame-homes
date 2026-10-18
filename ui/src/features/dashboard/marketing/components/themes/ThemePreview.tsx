import { useEffect, useMemo, type CSSProperties } from 'react';

import {
  resolveMarketingTheme,
  type MarketingThemeTokens,
  type ResolvedMarketingTheme,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { loadMarketingFonts } from '@/features/dashboard/marketing/lib/theme/marketingFontLoader';
import { mixTowardWhite } from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';
import { marketingThemeFontList } from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';

import { cn } from '@/lib/utils';

/**
 * Theme previews drawn with plain DOM + CSS: no canvas, no capture queue, so a
 * grid of 20 themes costs nothing and always matches the tokens exactly.
 */

function surfaceBackground(theme: ResolvedMarketingTheme): string {
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

function useThemeFonts(tokens: MarketingThemeTokens) {
  useEffect(() => {
    void loadMarketingFonts(marketingThemeFontList(tokens.fonts));
  }, [tokens.fonts]);
}

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

/** Card art for the theme library: a tiny poster in the theme. */
export function ThemeCardPreview({
  tokens,
  className,
}: {
  tokens: MarketingThemeTokens;
  className?: string;
}) {
  useThemeFonts(tokens);
  const theme = useMemo(() => resolveMarketingTheme(tokens), [tokens]);
  const radius = Math.min(theme.radius.md, 14);

  return (
    <div
      className={cn(
        'relative flex aspect-[4/3] flex-col justify-between overflow-hidden p-3',
        className
      )}
      style={{ background: surfaceBackground(theme) }}
      aria-hidden
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="truncate text-[22px] leading-none"
          style={{ fontFamily: `"${theme.fonts.display}", serif`, color: theme.readableInk }}
        >
          Aa
        </span>
        <span
          className="h-3.5 w-8 shrink-0"
          style={{
            backgroundColor: theme.accent,
            borderRadius: theme.radius.lg >= 999 ? 999 : theme.radius.sm,
          }}
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex gap-1">
          {[theme.primary, theme.secondary, theme.accent].map((color, index) => (
            <span
              key={index}
              className="h-4 flex-1"
              style={{ backgroundColor: color, borderRadius: Math.min(radius, 8) }}
            />
          ))}
        </div>
        <p
          className="truncate text-[10px] leading-tight"
          style={{ fontFamily: `"${theme.fonts.body}", sans-serif`, color: theme.muted }}
        >
          {theme.fonts.display} · {theme.fonts.body}
        </p>
      </div>
    </div>
  );
}

const DAYS = Array.from({ length: 14 }, (_, i) => i + 1);

/** Calendar, post and video frames side by side: the "does it work everywhere" check. */
export function ThemeMiniPreviews({
  tokens,
  propertyName,
  photoUrl,
  className,
}: {
  tokens: MarketingThemeTokens;
  propertyName: string;
  photoUrl?: string;
  className?: string;
}) {
  useThemeFonts(tokens);
  const theme = useMemo(() => resolveMarketingTheme(tokens), [tokens]);
  const cardRadius = Math.min(theme.radius.lg, 18);
  const chipRadius = theme.radius.lg >= 999 ? 999 : theme.radius.sm;
  const display: CSSProperties = { fontFamily: `"${theme.fonts.display}", serif` };
  const label: CSSProperties = { fontFamily: `"${theme.fonts.label}", sans-serif` };
  const body: CSSProperties = { fontFamily: `"${theme.fonts.body}", sans-serif` };

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)} aria-label="Theme preview">
      {/* Calendar */}
      <figure className="space-y-1">
        <div
          className="flex aspect-square flex-col gap-1 overflow-hidden p-2"
          style={{ background: surfaceBackground(theme), borderRadius: cardRadius }}
        >
          <span
            className="truncate text-[11px] leading-none"
            style={{ ...display, color: theme.readableInk }}
          >
            October
          </span>
          <div className="grid flex-1 grid-cols-7 content-start gap-[2px]">
            {DAYS.map((day) => {
              const booked = day % 5 === 0 || day === 6;
              const today = day === 3;
              return (
                <span
                  key={day}
                  className="flex aspect-square items-center justify-center text-[6px] leading-none"
                  style={{
                    ...body,
                    borderRadius: chipRadius,
                    backgroundColor: today
                      ? theme.accent
                      : booked
                        ? theme.secondary
                        : theme.primary,
                    color: today ? theme.onAccent : booked ? theme.muted : theme.onPrimary,
                    opacity: booked ? 0.85 : 1,
                  }}
                >
                  {day}
                </span>
              );
            })}
          </div>
        </div>
        <figcaption className="text-muted-foreground text-center text-[10px]">Calendar</figcaption>
      </figure>

      {/* Post */}
      <figure className="space-y-1">
        <div
          className="relative flex aspect-square flex-col justify-end overflow-hidden"
          style={{ borderRadius: cardRadius, backgroundColor: theme.secondary }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
              loading="lazy"
            />
          ) : null}
          <div
            className="relative m-1.5 space-y-0.5 p-1.5"
            style={{ backgroundColor: theme.surface, borderRadius: Math.min(cardRadius, 10) }}
          >
            <span
              className="block text-[6px] uppercase tracking-wider"
              style={{ ...label, color: theme.primary }}
            >
              Weekend deal
            </span>
            <span
              className="block truncate text-[11px] leading-none"
              style={{ ...display, color: theme.readableInk }}
            >
              {propertyName}
            </span>
            <span
              className="inline-block px-1.5 py-[1px] text-[6px] font-semibold"
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
        <figcaption className="text-muted-foreground text-center text-[10px]">Post</figcaption>
      </figure>

      {/* Video */}
      <figure className="space-y-1">
        <div
          className="relative flex aspect-square items-end overflow-hidden"
          style={{ borderRadius: cardRadius, backgroundColor: theme.primaryDark }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
              loading="lazy"
            />
          ) : null}
          <div
            className="relative w-full p-1.5"
            style={{ background: `linear-gradient(to top, ${theme.primaryDark}e6, transparent)` }}
          >
            <span className="block truncate text-[11px] leading-none text-white" style={display}>
              Slow mornings
            </span>
            <span
              className="mt-0.5 inline-block px-1.5 py-[1px] text-[6px] font-semibold"
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
        <figcaption className="text-muted-foreground text-center text-[10px]">Video</figcaption>
      </figure>
    </div>
  );
}
