/**
 * AI-generated video storyboard token schema for the Remotion video editor.
 * Tokens are produced by the shared edge function and compiled into a
 * `VideoProject` by `video/videoAiProjectBuilder.ts`.
 */

import type { VideoCategory } from '@/features/dashboard/marketing/lib/video/videoCategories';
import { normalizeVideoCategory } from '@/features/dashboard/marketing/lib/video/videoCategories';
import type { VideoMotionOverride } from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';
import type {
  VideoSceneKind,
  VideoTransition,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

export type VideoFontPairingId =
  'editorial-serif' | 'cinematic-serif' | 'modern-sans' | 'warm-serif';

/** `custom` is a content-flavor choice (blank copy, no category assumption) — mapped to a
 * host-facing "Custom" sidebar category at save time, same as Design's `custom`. */
export type VideoAiCategory = VideoCategory | 'custom';

export type VideoSceneToken = {
  kind: VideoSceneKind;
  durationSec: number;
  transition: VideoTransition;
  motion: VideoMotionOverride;
};

export type VideoTemplateTokens = {
  category: VideoAiCategory;
  scenes: VideoSceneToken[];
  fontPairing: VideoFontPairingId;
  copy: {
    headline: string;
    subheadline: string;
    promoLine: string;
    slotLabels: string[];
    ctaLine: string;
    rulesLine: string;
  };
  label: string;
};

const VIDEO_AI_CATEGORIES: VideoAiCategory[] = [
  'soft-stay',
  'flash-deal',
  'last-openings',
  'reviews',
  'fully-booked',
  'seasonal',
  'custom',
];

const VIDEO_SCENE_KINDS: VideoSceneKind[] = ['photo', 'promo', 'slots', 'cta'];

const VIDEO_TRANSITIONS: VideoTransition[] = [
  'none',
  'fade',
  'slide-left',
  'slide-up',
  'wipe',
  'dissolve',
  'flip',
  'clock-wipe',
  'zoom-in-out',
  'push-cut',
];

const VIDEO_MOTIONS: VideoMotionOverride[] = [
  'slow-zoom-in',
  'punch-in',
  'zoom-out',
  'pan-left',
  'pan-right',
  'drift-up',
  'diagonal-drift',
  'hold',
];

const VIDEO_FONT_PAIRINGS: VideoFontPairingId[] = [
  'editorial-serif',
  'cinematic-serif',
  'modern-sans',
  'warm-serif',
];

export const VIDEO_AI_SCENE_COUNT_MIN = 3;
export const VIDEO_AI_SCENE_COUNT_MAX = 5;

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

/** Truncates at the last whitespace before `max` so AI copy never gets cut mid-word. */
function truncateAtWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return lastSpace > max * 0.4 ? slice.slice(0, lastSpace).trimEnd() : slice;
}

function clampText(value: unknown, fallback: string, max: number): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = truncateAtWordBoundary(value.replace(/\s+/g, ' ').trim(), max);
  return cleaned || fallback;
}

function clampStringArray(value: unknown, max: number, itemMax: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => truncateAtWordBoundary(item.replace(/\s+/g, ' ').trim(), itemMax))
    .filter(Boolean)
    .slice(0, max);
}

function clampDuration(value: unknown, fallback = 3): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(12, Math.max(1, Math.round(num * 10) / 10));
}

export function normalizeVideoTemplateTokens(
  raw: Partial<VideoTemplateTokens> | null | undefined
): VideoTemplateTokens {
  const copyRaw = (raw?.copy ?? {}) as Record<string, unknown>;
  const scenesRaw = (Array.isArray(raw?.scenes) ? raw!.scenes : []) as unknown[];

  const scenes: VideoSceneToken[] = scenesRaw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .slice(0, VIDEO_AI_SCENE_COUNT_MAX)
    .map((item) => ({
      kind: pickEnum(item.kind, VIDEO_SCENE_KINDS, 'photo'),
      durationSec: clampDuration(item.durationSec),
      transition: pickEnum(item.transition, VIDEO_TRANSITIONS, 'fade'),
      motion: pickEnum(item.motion, VIDEO_MOTIONS, 'slow-zoom-in'),
    }));

  while (scenes.length < VIDEO_AI_SCENE_COUNT_MIN) {
    scenes.push({ kind: 'photo', durationSec: 3, transition: 'fade', motion: 'slow-zoom-in' });
  }

  return {
    category: (() => {
      if (raw?.category === 'custom') return 'custom';
      if (typeof raw?.category === 'string') {
        return pickEnum(normalizeVideoCategory(raw.category), VIDEO_AI_CATEGORIES, 'soft-stay');
      }
      return 'soft-stay';
    })(),
    scenes,
    fontPairing: pickEnum(raw?.fontPairing, VIDEO_FONT_PAIRINGS, 'editorial-serif'),
    copy: {
      headline: clampText(copyRaw.headline, 'A STAY WORTH REMEMBERING', 40),
      subheadline: clampText(copyRaw.subheadline, '', 46),
      promoLine: clampText(copyRaw.promoLine, '', 46),
      slotLabels: clampStringArray(copyRaw.slotLabels, 3, 24),
      ctaLine: clampText(copyRaw.ctaLine, 'Book now', 24),
      rulesLine: clampText(copyRaw.rulesLine, '', 32),
    },
    label: clampText(raw?.label, 'AI video', 40),
  };
}

/** Floor under which a single scene reads as a flash-cut rather than a beat. */
const VIDEO_AI_MIN_SCENE_SECONDS = 1.5;
const VIDEO_AI_MAX_SCENE_SECONDS = 12;

/**
 * Rescale every scene's duration so the storyboard's total runtime lands on
 * `targetTotalSeconds`, preserving the AI's relative pacing (a scene the model
 * made longer stays longer). Any rounding slack is absorbed by the closing
 * scene so the total lands on target exactly.
 */
export function fitVideoAiSceneDurations(
  scenes: VideoSceneToken[],
  targetTotalSeconds: number
): VideoSceneToken[] {
  if (scenes.length === 0) return scenes;
  const round1 = (value: number) => Math.round(value * 10) / 10;
  const clampSeconds = (value: number) =>
    Math.min(VIDEO_AI_MAX_SCENE_SECONDS, Math.max(VIDEO_AI_MIN_SCENE_SECONDS, value));

  const currentTotal = scenes.reduce((sum, scene) => sum + scene.durationSec, 0);
  const scale = currentTotal > 0 ? targetTotalSeconds / currentTotal : 1;
  const scaled = scenes.map((scene) => ({
    ...scene,
    durationSec: round1(clampSeconds(scene.durationSec * scale)),
  }));

  const scaledTotal = scaled.reduce((sum, scene) => sum + scene.durationSec, 0);
  const remainder = round1(targetTotalSeconds - scaledTotal);
  if (Math.abs(remainder) >= 0.1) {
    const lastIndex = scaled.length - 1;
    const last = scaled[lastIndex]!;
    scaled[lastIndex] = {
      ...last,
      durationSec: round1(clampSeconds(last.durationSec + remainder)),
    };
  }
  return scaled;
}
