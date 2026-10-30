import type {
  VideoSceneKind,
  VideoSceneTextFields,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import type { VideoTextBeat } from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';

const EMPTY_TEXTS: VideoSceneTextFields = {
  headline: '',
  subheadline: '',
  promoLine: '',
  ctaLine: '',
  slotLabels: [],
  rulesLine: '',
};

/** Keep only text fields allowed on this storyboard clip (prevents cross-scene overlap). */
export function textsForStoryboardBeats(
  beats: VideoTextBeat[],
  source: VideoSceneTextFields
): VideoSceneTextFields {
  const next: VideoSceneTextFields = { ...EMPTY_TEXTS };
  for (const beat of beats) {
    if (beat === 'slotLabels') {
      next.slotLabels = [...source.slotLabels];
    } else {
      next[beat] = source[beat];
    }
  }
  return next;
}

const GENERIC_SCENE_TEXTS: Record<VideoSceneKind, VideoSceneTextFields> = {
  photo: {
    headline: 'YOUR HEADLINE',
    subheadline: '',
    promoLine: '',
    ctaLine: '',
    slotLabels: [],
    rulesLine: '',
  },
  promo: {
    headline: 'WEEKDAY PROMO',
    subheadline: 'UP TO',
    promoLine: '₱500 OFF',
    ctaLine: 'FOR WEEKDAY BOOKINGS',
    slotLabels: [],
    rulesLine: 'KAME SPACE',
  },
  slots: {
    headline: 'LAST 3 SLOTS',
    subheadline: 'FOR THIS MONTH',
    promoLine: '',
    ctaLine: 'BOOK NOW',
    slotLabels: ['12 · Fri', '18 · Thu', '25 · Thu'],
    rulesLine: 'KAME SPACE',
  },
  cta: {
    headline: '',
    subheadline: '',
    promoLine: '',
    ctaLine: 'BOOK NOW',
    slotLabels: [],
    rulesLine: 'KAME SPACE',
  },
};

function pickString(current: string, seed: string | undefined, fallback: string): string {
  if (current.trim()) return current;
  if (seed?.trim()) return seed.trim();
  return fallback;
}

function pickSlotLabels(
  current: string[],
  seed: string[] | undefined,
  fallback: string[]
): string[] {
  if (current.length > 0) return current;
  if (seed && seed.length > 0) return [...seed];
  return [...fallback];
}

/** Fill empty text fields for the target layout; keep non-empty user edits. */
export function mergeSceneTextsForKind(
  kind: VideoSceneKind,
  current: VideoSceneTextFields,
  templateSeed?: VideoSceneTextFields
): VideoSceneTextFields {
  const generic = GENERIC_SCENE_TEXTS[kind];
  const seed = templateSeed ?? generic;

  return {
    headline: pickString(current.headline, seed.headline, generic.headline),
    subheadline: pickString(current.subheadline, seed.subheadline, generic.subheadline),
    promoLine: pickString(current.promoLine, seed.promoLine, generic.promoLine),
    ctaLine: pickString(current.ctaLine, seed.ctaLine, generic.ctaLine),
    slotLabels: pickSlotLabels(current.slotLabels, seed.slotLabels, generic.slotLabels),
    rulesLine: pickString(current.rulesLine, seed.rulesLine, generic.rulesLine),
  };
}
