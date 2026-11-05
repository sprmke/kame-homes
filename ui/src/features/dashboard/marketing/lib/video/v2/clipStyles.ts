/**
 * Pure style and animation math for v2 clips (no React, no Remotion). Unit-tested; the
 * composition only wires these results into elements.
 */

import type {
  MediaAdjust,
  MediaCrop,
  MediaItem,
  TextAnimation,
  VisualTransform,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

export type Css = Record<string, string | number | undefined>;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Share of the source that stays visible after cropping (never zero). */
export function cropVisible(crop: MediaCrop | undefined): { w: number; h: number } {
  if (!crop) return { w: 1, h: 1 };
  return {
    w: Math.max(0.05, 1 - crop.left - crop.right),
    h: Math.max(0.05, 1 - crop.top - crop.bottom),
  };
}

/**
 * Inner element style that shows only the cropped part of a media element inside an
 * `overflow: hidden` box. Scales the full element up and shifts it so the crop edges align.
 */
export function cropInnerStyle(crop: MediaCrop | undefined): Css {
  if (!crop) return { position: 'absolute', inset: 0, width: '100%', height: '100%' };
  const visible = cropVisible(crop);
  return {
    position: 'absolute',
    left: `${(-crop.left / visible.w) * 100}%`,
    top: `${(-crop.top / visible.h) * 100}%`,
    width: `${100 / visible.w}%`,
    height: `${100 / visible.h}%`,
  };
}

/** CSS filter for brightness/contrast/saturation; undefined when nothing changes. */
export function adjustFilter(adjust: MediaAdjust | undefined): string | undefined {
  if (!adjust) return undefined;
  const parts: string[] = [];
  if (adjust.brightness !== 1) parts.push(`brightness(${adjust.brightness})`);
  if (adjust.contrast !== 1) parts.push(`contrast(${adjust.contrast})`);
  if (adjust.saturation !== 1) parts.push(`saturate(${adjust.saturation})`);
  return parts.length ? parts.join(' ') : undefined;
}

/** Aspect ratio (w/h) of an overlay box, from the source size and crop. Fallback 16:9. */
export function overlayAspect(item: Pick<MediaItem, 'media' | 'crop'>): number {
  const { width, height } = item.media;
  const source = width && height ? width / height : 16 / 9;
  const visible = cropVisible(item.crop);
  return source * (visible.w / visible.h);
}

/** Absolute box for a free (overlay) clip: center-anchored, width % of the frame. */
export function overlayBoxStyle(transform: VisualTransform, aspect: number): Css {
  return {
    position: 'absolute',
    left: `${transform.x}%`,
    top: `${transform.y}%`,
    width: `${transform.widthPct}%`,
    aspectRatio: String(aspect > 0 ? aspect : 16 / 9),
    transform: `translate(-50%, -50%) rotate(${transform.rotation}deg)`,
    opacity: transform.opacity,
    overflow: 'hidden',
  };
}

/** Linear volume with fade in/out, `frame` relative to the clip start. */
export function fadedVolume(
  frame: number,
  durationInFrames: number,
  base: number,
  fadeInFrames = 0,
  fadeOutFrames = 0
): number {
  const clampedBase = clamp01(base);
  const fadeIn = fadeInFrames > 0 ? clamp01(frame / fadeInFrames) : 1;
  const remaining = durationInFrames - frame;
  const fadeOut = fadeOutFrames > 0 ? clamp01(remaining / fadeOutFrames) : 1;
  return clampedBase * fadeIn * fadeOut;
}

export type LayerMotion = {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  /** Fraction of characters to show (typewriter), 1 otherwise. */
  reveal: number;
};

export type LayerMotionInput = {
  frame: number;
  durationInFrames: number;
  fps: number;
  animationIn?: { type: TextAnimation; durationInFrames: number };
  animationOut?: { type: TextAnimation; durationInFrames: number };
  /** Spring progress 0..1 supplied by the caller for the `template` entrance. */
  templateEnter: number;
  /** Template entrance travel in composition px. */
  templateOffsetX: number;
  templateOffsetY: number;
  /** Distance used by slide/rise animations, in composition px. */
  travel: number;
};

const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;

/** Overshoot easing for the `pop` entrance. */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clamp01(t);
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

/** Combine entrance and exit animations into one transform for a layer item. */
export function layerMotion(input: LayerMotionInput): LayerMotion {
  const { frame, durationInFrames, animationIn, animationOut } = input;
  const out: LayerMotion = { opacity: 1, translateX: 0, translateY: 0, scale: 1, reveal: 1 };

  const inType = animationIn?.type ?? 'none';
  const inFrames = Math.max(1, animationIn?.durationInFrames || 12);
  const inT = clamp01(frame / inFrames);
  switch (inType) {
    case 'template':
      out.translateX = (1 - input.templateEnter) * input.templateOffsetX;
      out.translateY = (1 - input.templateEnter) * input.templateOffsetY;
      break;
    case 'fade':
      out.opacity *= inT;
      break;
    case 'slide-up':
      out.translateY = (1 - easeOut(inT)) * input.travel;
      out.opacity *= clamp01(inT * 2);
      break;
    case 'rise':
      out.translateY = (1 - easeOut(inT)) * input.travel * 0.4;
      out.opacity *= easeOut(inT);
      break;
    case 'pop':
      out.scale = 0.7 + 0.3 * easeOutBack(inT);
      out.opacity *= clamp01(inT * 3);
      break;
    case 'typewriter':
      out.reveal = inT;
      break;
    default:
      break;
  }

  const outType = animationOut?.type ?? 'none';
  if (outType !== 'none' && outType !== 'template') {
    const outFrames = Math.max(1, animationOut?.durationInFrames || 12);
    const outT = clamp01((frame - (durationInFrames - outFrames)) / outFrames);
    if (outT > 0) {
      switch (outType) {
        case 'fade':
        case 'rise':
          out.opacity *= 1 - outT;
          break;
        case 'slide-up':
          out.translateY += easeOut(outT) * input.travel;
          out.opacity *= 1 - clamp01(outT * 1.5);
          break;
        case 'pop':
          out.scale *= 1 - 0.2 * outT;
          out.opacity *= 1 - outT;
          break;
        case 'typewriter':
          out.reveal = Math.min(out.reveal, 1 - outT);
          break;
        default:
          break;
      }
    }
  }
  return out;
}

/** Visible slice of `text` for a typewriter reveal; whole text at reveal >= 1. */
export function revealText(text: string, reveal: number): string {
  if (reveal >= 1) return text;
  const chars = Array.from(text);
  return chars.slice(0, Math.ceil(chars.length * clamp01(reveal))).join('');
}

/** Ramp used by CTA scenes to fade up from the dark base. */
export function ctaReveal(frame: number, revealFrames: number): number {
  return revealFrames > 0 ? clamp01(frame / revealFrames) : 1;
}

/** Whether a media URL can be handed to the renderer. */
export function isRenderableMediaUrl(url: string | null | undefined): url is string {
  if (!url?.trim()) return false;
  const trimmed = url.trim();
  return (
    /^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')
  );
}
