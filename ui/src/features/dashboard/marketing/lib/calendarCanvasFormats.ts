import type { BackgroundConfig } from '@/features/dashboard/marketing/components/calendar-builder/types';
import type { MarketingFormatOption } from '@/features/dashboard/marketing/components/shared/MarketingFormatPicker';

import { DEFAULT_ORG_BRAND_COLOR } from '@/lib/theme/brandColor';

export type CalendarCanvasFormat = 'square' | 'portrait' | 'landscape';

export type CalendarCanvasFrameStyles = {
  format: CalendarCanvasFormat;
  background: BackgroundConfig;
  /** Padding between canvas edge and calendar card (export pixels at 1080 base). */
  padding: number;
  /** Calendar square size as % of usable inner area. */
  calendarScale: number;
};

export const CALENDAR_CANVAS_DIMENSIONS: Record<
  CalendarCanvasFormat,
  { width: number; height: number; label: string; aspect: string }
> = {
  square: { width: 1080, height: 1080, label: 'Square', aspect: '1:1' },
  portrait: { width: 1080, height: 1920, label: 'Portrait', aspect: '9:16' },
  landscape: { width: 1920, height: 1080, label: 'Landscape', aspect: '16:9' },
};

export const CALENDAR_FORMAT_OPTIONS: MarketingFormatOption[] = (
  Object.keys(CALENDAR_CANVAS_DIMENSIONS) as CalendarCanvasFormat[]
).map((key) => ({
  value: key,
  width: CALENDAR_CANVAS_DIMENSIONS[key].width,
  height: CALENDAR_CANVAS_DIMENSIONS[key].height,
}));

const FRAME_DEFAULTS: Record<
  CalendarCanvasFormat,
  Pick<CalendarCanvasFrameStyles, 'padding' | 'calendarScale'>
> = {
  square: {
    padding: 32,
    calendarScale: 96,
  },
  portrait: {
    padding: 96,
    calendarScale: 86,
  },
  landscape: {
    padding: 72,
    calendarScale: 84,
  },
};

function squareBackground(): BackgroundConfig {
  return { type: 'solid', color: '#ffffff' };
}

function brandBackground(brandColor: string): BackgroundConfig {
  return { type: 'solid', color: brandColor };
}

export function canvasFrameBackgroundForFormat(
  format: CalendarCanvasFormat,
  brandColor?: string
): BackgroundConfig {
  if (format === 'square') return squareBackground();
  return brandBackground(brandColor?.trim() || DEFAULT_ORG_BRAND_COLOR);
}

export function createDefaultCanvasFrame(
  format: CalendarCanvasFormat = 'square',
  brandColor?: string
): CalendarCanvasFrameStyles {
  return {
    format,
    ...FRAME_DEFAULTS[format],
    background: canvasFrameBackgroundForFormat(format, brandColor),
  };
}

export function canvasFrameDefaultsForFormat(
  format: CalendarCanvasFormat,
  brandColor?: string
): Pick<CalendarCanvasFrameStyles, 'padding' | 'calendarScale' | 'background'> {
  return {
    ...FRAME_DEFAULTS[format],
    background: canvasFrameBackgroundForFormat(format, brandColor),
  };
}

export function computeCalendarLayoutBounds(
  canvasWidth: number,
  canvasHeight: number,
  padding: number,
  calendarScalePercent: number
): { maxWidth: number; maxHeight: number } {
  const innerW = Math.max(0, canvasWidth - padding * 2);
  const innerH = Math.max(0, canvasHeight - padding * 2);
  const scale = calendarScalePercent / 100;
  return {
    maxWidth: Math.max(120, Math.floor(innerW * scale)),
    maxHeight: Math.max(120, Math.floor(innerH * scale)),
  };
}

export function calendarPreviewWidthForFormat(format: CalendarCanvasFormat): number {
  if (format === 'landscape') return 520;
  if (format === 'portrait') return 300;
  return 400;
}

/** Relative zoom steps — 100% always means "fit to the preview pane". */
export const CALENDAR_PREVIEW_ZOOM_LEVELS = [25, 50, 75, 100, 125, 150, 175, 200] as const;

export const CALENDAR_MIN_RELATIVE_ZOOM = 25;
export const CALENDAR_MAX_RELATIVE_ZOOM = 200;

export type CalendarPreviewDisplayLayout = {
  nativeWidth: number;
  nativeHeight: number;
  displayScale: number;
  layoutWidth: number;
  layoutHeight: number;
  /** displayScale when relative zoom is 100% (fit). */
  fitDisplayScale: number;
  /** Max relative zoom (percent of fit). */
  maxRelativeZoomPercent: number;
};

export function calendarPreviewDisplayLayout(
  format: CalendarCanvasFormat,
  containerWidth: number,
  containerHeight: number,
  relativeZoomPercent: number,
  padding = 48
): CalendarPreviewDisplayLayout {
  const dims = CALENDAR_CANVAS_DIMENSIONS[format];
  const availableWidth = Math.max(120, containerWidth - padding);
  const availableHeight = Math.max(120, containerHeight - padding);
  const fitDisplayScale = Math.min(availableWidth / dims.width, availableHeight / dims.height);
  const maxRelativeZoomPercent = CALENDAR_MAX_RELATIVE_ZOOM;
  const minDisplayScale = fitDisplayScale * (CALENDAR_MIN_RELATIVE_ZOOM / 100);
  const maxDisplayScale = fitDisplayScale * (maxRelativeZoomPercent / 100);
  const targetScale = fitDisplayScale * (relativeZoomPercent / 100);
  const displayScale = Math.max(minDisplayScale, Math.min(maxDisplayScale, targetScale));

  return {
    nativeWidth: dims.width,
    nativeHeight: dims.height,
    displayScale,
    layoutWidth: dims.width * displayScale,
    layoutHeight: dims.height * displayScale,
    fitDisplayScale,
    maxRelativeZoomPercent,
  };
}

export function calendarPreviewLayout(
  format: CalendarCanvasFormat,
  zoomLevelPercent: number
): {
  nativeWidth: number;
  nativeHeight: number;
  baseScale: number;
  displayScale: number;
  layoutWidth: number;
  layoutHeight: number;
} {
  const dims = CALENDAR_CANVAS_DIMENSIONS[format];
  const previewWidth = calendarPreviewWidthForFormat(format);
  const baseScale = previewWidth / dims.width;
  const displayScale = baseScale * (zoomLevelPercent / 100);
  return {
    nativeWidth: dims.width,
    nativeHeight: dims.height,
    baseScale,
    displayScale,
    layoutWidth: dims.width * displayScale,
    layoutHeight: dims.height * displayScale,
  };
}

/** @deprecated Use calendarPreviewDisplayLayout with relative zoom instead. */
export function fitZoomLevelForContainer(
  format: CalendarCanvasFormat,
  containerWidth: number,
  containerHeight: number,
  padding = 48
): number {
  const layout = calendarPreviewLayout(format, 100);
  const availableWidth = Math.max(120, containerWidth - padding);
  const availableHeight = Math.max(120, containerHeight - padding);
  const baseW = layout.nativeWidth * layout.baseScale;
  const baseH = layout.nativeHeight * layout.baseScale;
  const fit = Math.min(availableWidth / baseW, availableHeight / baseH) * 100;
  return Math.max(CALENDAR_MIN_RELATIVE_ZOOM, Math.round(fit / 5) * 5);
}

export function calendarCanvasAspectRatio(format: CalendarCanvasFormat): string {
  const dims = CALENDAR_CANVAS_DIMENSIONS[format];
  return `${dims.width} / ${dims.height}`;
}

export function calendarFormatToAspectPreset(format: CalendarCanvasFormat): string {
  if (format === 'portrait') return 'instagram-story';
  if (format === 'landscape') return 'landscape';
  return 'instagram-post';
}

export function normalizeCalendarCanvasFrame(
  frame: CalendarCanvasFrameStyles | undefined,
  brandColor?: string
): CalendarCanvasFrameStyles {
  if (!frame) return createDefaultCanvasFrame('square', brandColor);
  const format = frame.format ?? 'square';
  return {
    format,
    padding: typeof frame.padding === 'number' ? frame.padding : FRAME_DEFAULTS[format].padding,
    calendarScale:
      typeof frame.calendarScale === 'number'
        ? frame.calendarScale
        : FRAME_DEFAULTS[format].calendarScale,
    background: frame.background ?? canvasFrameBackgroundForFormat(format, brandColor),
  };
}
