import { memo, useMemo, useState } from 'react';

import { CalendarMiniPreview } from '@/features/dashboard/marketing/components/shared/CalendarMiniPreview';
import type { MarketingContentType } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import {
  useNearViewport,
  usePresetThumbnail,
} from '@/features/dashboard/marketing/hooks/usePresetThumbnail';
import type { CalendarCanvasFormat } from '@/features/dashboard/marketing/lib/calendarCanvasFormats';
import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { sizeOption } from '@/features/dashboard/marketing/lib/marketingLibrary';
import type { PresetThumbRequest } from '@/features/dashboard/marketing/lib/marketingPresetThumbs';
import { resolveThemedCalendarLayout } from '@/features/dashboard/marketing/lib/theme/calendarThemeAdapter';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import type { VideoFormat } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

import { cn } from '@/lib/utils';

type Props = {
  contentType: MarketingContentType;
  /** Concrete preset id for this size (posts) or the layout / recipe id. */
  presetId: string;
  size: string;
  theme: MarketingThemeTokens;
  themeHash: string;
  /** Video stills use the property's photos when available. */
  binding?: DesignBinding;
  propertyPhotoUrl?: string;
  className?: string;
};

export function calendarFormatForSize(size: string): CalendarCanvasFormat {
  if (size === 'instagram-story') return 'portrait';
  if (size === 'landscape') return 'landscape';
  return 'square';
}

/** Themed outline shown before (or instead of, on low-spec devices) a rendered still. */
export const PresetWireframe = memo(function PresetWireframe({
  theme,
  width,
  height,
  className,
}: {
  theme: MarketingThemeTokens;
  width: number;
  height: number;
  className?: string;
}) {
  const w = width / 10;
  const h = height / 10;
  const pad = Math.min(w, h) * 0.08;
  const { primary, accent, surface, ink, secondary } = theme.palette;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      focusable="false"
    >
      <rect width={w} height={h} fill={surface} />
      <rect x={0} y={0} width={w} height={h * 0.58} fill={secondary} />
      <rect x={0} y={h * 0.4} width={w} height={h * 0.18} fill={primary} opacity={0.18} />
      <rect x={pad} y={h * 0.64} width={w * 0.62} height={h * 0.06} rx={h * 0.015} fill={ink} />
      <rect
        x={pad}
        y={h * 0.74}
        width={w * 0.42}
        height={h * 0.035}
        rx={h * 0.01}
        fill={ink}
        opacity={0.5}
      />
      <rect
        x={pad}
        y={h * 0.84}
        width={w * 0.3}
        height={h * 0.06}
        rx={h * 0.03}
        fill="none"
        stroke={accent}
        strokeWidth={Math.max(0.4, h * 0.006)}
      />
    </svg>
  );
});

/**
 * Card art for a built-in template: calendar layouts draw as SVG; post and video
 * templates show a stored / rendered still once on screen, an outline until then.
 */
export const MarketingTemplateThumb = memo(function MarketingTemplateThumb({
  contentType,
  presetId,
  size,
  theme,
  themeHash,
  binding,
  propertyPhotoUrl,
  className,
}: Props) {
  if (contentType === 'calendar') {
    return (
      <CalendarLayoutThumb
        layoutId={presetId}
        size={size}
        theme={theme}
        propertyPhotoUrl={propertyPhotoUrl}
        className={className}
      />
    );
  }
  return (
    <RenderedPresetThumb
      contentType={contentType}
      presetId={presetId}
      size={size}
      theme={theme}
      themeHash={themeHash}
      binding={binding}
      className={className}
    />
  );
});

const CalendarLayoutThumb = memo(function CalendarLayoutThumb({
  layoutId,
  size,
  theme,
  propertyPhotoUrl,
  className,
}: {
  layoutId: string;
  size: string;
  theme: MarketingThemeTokens;
  propertyPhotoUrl?: string;
  className?: string;
}) {
  const styles = useMemo(
    () =>
      resolveThemedCalendarLayout({
        layoutId,
        theme,
        format: calendarFormatForSize(size),
        propertyPhotoUrl,
      }),
    [layoutId, theme, size, propertyPhotoUrl]
  );
  return <CalendarMiniPreview styles={styles} className={cn('size-full', className)} />;
});

function RenderedPresetThumb({
  contentType,
  presetId,
  size,
  theme,
  themeHash,
  binding,
  className,
}: {
  contentType: 'design' | 'video';
  presetId: string;
  size: string;
  theme: MarketingThemeTokens;
  themeHash: string;
  binding?: DesignBinding;
  className?: string;
}) {
  const { ref, visible } = useNearViewport<HTMLDivElement>();
  const [intent, setIntent] = useState(false);
  const request = useMemo<PresetThumbRequest>(
    () =>
      contentType === 'design'
        ? { contentType, presetId, theme, themeHash }
        : { contentType, presetId, size: size as VideoFormat, theme, themeHash, binding },
    [contentType, presetId, size, theme, themeHash, binding]
  );
  const { url } = usePresetThumbnail(request, { visible, intent });
  const dims = sizeOption(contentType, size) ?? { width: 1080, height: 1080 };

  return (
    <div
      ref={ref}
      className={cn('relative size-full', className)}
      onPointerEnter={() => setIntent(true)}
      onFocus={() => setIntent(true)}
    >
      {url ? (
        <img
          src={url}
          alt=""
          className="size-full select-none object-contain"
          draggable={false}
          decoding="async"
        />
      ) : (
        <PresetWireframe
          theme={theme}
          width={dims.width}
          height={dims.height}
          className="size-full"
        />
      )}
    </div>
  );
}
