import type { VideoFormat } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

export const VIDEO_FORMAT_DIMENSIONS: Record<
  VideoFormat,
  { width: number; height: number; label: string; aspect: string }
> = {
  'instagram-story': {
    width: 1080,
    height: 1920,
    label: 'Instagram Story / Reel',
    aspect: '9:16',
  },
  'instagram-post': {
    width: 1080,
    height: 1080,
    label: 'Instagram Post',
    aspect: '1:1',
  },
  landscape: {
    width: 1920,
    height: 1080,
    label: 'Landscape',
    aspect: '16:9',
  },
};

/**
 * Preview block (sub-header + player + controls). Timeline sits below this block.
 * The mobile floor is deliberately low so the block is `flex-1`-flexible: the preview
 * stage then claims whatever height is left after the compact controls + timeline,
 * rather than being pinned to a tall minimum that forces the whole column to scroll.
 */
export const VIDEO_PREVIEW_CONTAINER_MIN_HEIGHT_CLASS =
  'min-h-[180px] sm:min-h-[380px] lg:min-h-[540px]';

/** Muted preview shell (`VideoPreviewWorkspace` root). */
export const VIDEO_PREVIEW_SHELL_MIN_HEIGHT_CLASS =
  'min-h-[150px] sm:min-h-[360px] lg:min-h-[440px] xl:min-h-[480px]';

export const VIDEO_FORMAT_OPTIONS = (Object.keys(VIDEO_FORMAT_DIMENSIONS) as VideoFormat[]).map(
  (key) => ({
    value: key,
    label: VIDEO_FORMAT_DIMENSIONS[key].label,
    detail: `${VIDEO_FORMAT_DIMENSIONS[key].width} × ${VIDEO_FORMAT_DIMENSIONS[key].height}`,
  })
);

/** Size the preview frame to fit its container while preserving format aspect ratio. */
export const VIDEO_MIN_RELATIVE_ZOOM = 50;
export const VIDEO_MAX_RELATIVE_ZOOM = 200;
export const VIDEO_ZOOM_STEP = 10;

export function stepVideoZoomIn(current: number, max = VIDEO_MAX_RELATIVE_ZOOM): number {
  return Math.min(max, current + VIDEO_ZOOM_STEP);
}

export function stepVideoZoomOut(current: number, min = VIDEO_MIN_RELATIVE_ZOOM): number {
  return Math.max(min, current - VIDEO_ZOOM_STEP);
}

export function fitVideoPreviewFrameSize(
  containerWidth: number,
  containerHeight: number,
  format: VideoFormat,
  maxWidth: number,
  _relativeZoomPercent = 100
): { width: number; height: number } {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return { width: 0, height: 0 };
  }

  const dims = VIDEO_FORMAT_DIMENSIONS[format];
  const aspect = dims.width / dims.height;

  // Fit inside the viewport at 100%. Zoom is applied with CSS transform by the
  // preview workspace — never by stretching this box (that letterboxed white).
  const pad = 8;
  const availableWidth = Math.max(1, Math.min(maxWidth, containerWidth) - pad);
  const availableHeight = Math.max(1, containerHeight - pad);

  let width = availableWidth;
  let height = width / aspect;

  if (height > availableHeight) {
    height = availableHeight;
    width = height * aspect;
  }

  return {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(height)),
  };
}
