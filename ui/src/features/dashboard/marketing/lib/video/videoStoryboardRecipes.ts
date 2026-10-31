import type { VideoCategory } from '@/features/dashboard/marketing/lib/video/videoCategories';
import type { VideoMotionOverride } from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';
import type {
  VideoSceneKind,
  VideoTransition,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

export type VideoOverlayMode = 'none' | 'soft-scrim' | 'bottom-band' | 'top-band';

export type VideoTextBeat =
  'headline' | 'subheadline' | 'promoLine' | 'slotLabels' | 'ctaLine' | 'rulesLine';

export type VideoStoryboardClip = {
  role: string;
  label: string;
  durationSec: number;
  transition: VideoTransition;
  overlay: VideoOverlayMode;
  kind: VideoSceneKind;
  textBeats: VideoTextBeat[];
  motion?: VideoMotionOverride;
};

export type VideoStoryboardRecipe = {
  id: string;
  name: string;
  category: VideoCategory;
  clips: VideoStoryboardClip[];
  preservePresetPalette?: boolean;
  presetAccent?: string;
  /** Preferred Jamendo match for default music resolve. */
  musicCue?: { title: string; artist: string };
};

const softScrim = 'soft-scrim' as const;
const bottomBand = 'bottom-band' as const;
const topBand = 'top-band' as const;
const none = 'none' as const;

/**
 * Per-category Jamendo search cues. Soft stay keeps the known Trending hit;
 * others search by mood and fall back to the default track if unmatched.
 */
const musicSoft = { title: 'Lofi Chillout Hip Hop Beat', artist: 'Joystock' };
const musicFlash = { title: 'Upbeat', artist: 'Electronic' };
const musicUrgent = { title: 'Pulse', artist: 'Cinematic' };
const musicWarm = { title: 'Acoustic', artist: 'Chill' };
const musicQuiet = { title: 'Ambient', artist: 'Piano' };
const musicSeason = { title: 'Warm', artist: 'Indie' };

export const VIDEO_STORYBOARD_RECIPES: VideoStoryboardRecipe[] = [
  {
    id: 'quiet-morning',
    name: 'Quiet morning',
    category: 'soft-stay',
    musicCue: musicSoft,
    clips: [
      {
        role: 'hook',
        label: 'Hook',
        durationSec: 2.5,
        transition: 'none',
        overlay: softScrim,
        kind: 'photo',
        textBeats: ['headline'],
      },
      {
        role: 'broll',
        label: 'Stay',
        durationSec: 3,
        transition: 'dissolve',
        overlay: none,
        kind: 'photo',
        textBeats: [],
      },
      {
        role: 'offer',
        label: 'Amenity',
        durationSec: 3,
        transition: 'fade',
        overlay: softScrim,
        kind: 'promo',
        textBeats: ['subheadline', 'promoLine'],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 2.5,
        transition: 'fade',
        overlay: bottomBand,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  },
  {
    id: 'golden-hour',
    name: 'Golden hour',
    category: 'soft-stay',
    musicCue: musicSoft,
    clips: [
      {
        role: 'hook',
        label: 'Hook',
        durationSec: 2,
        transition: 'none',
        overlay: topBand,
        kind: 'photo',
        textBeats: ['headline'],
      },
      {
        role: 'broll',
        label: 'Light',
        durationSec: 2,
        transition: 'dissolve',
        overlay: none,
        kind: 'photo',
        textBeats: [],
      },
      {
        role: 'beat',
        label: 'Detail',
        durationSec: 2,
        transition: 'fade',
        overlay: softScrim,
        kind: 'photo',
        textBeats: ['subheadline'],
      },
      {
        role: 'broll2',
        label: 'Space',
        durationSec: 2,
        transition: 'fade',
        overlay: none,
        kind: 'photo',
        textBeats: [],
      },
      {
        role: 'offer',
        label: 'Offer',
        durationSec: 2,
        transition: 'dissolve',
        overlay: bottomBand,
        kind: 'promo',
        textBeats: ['promoLine'],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 2,
        transition: 'fade',
        overlay: softScrim,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  },
  {
    id: 'poolside-calm',
    name: 'Poolside calm',
    category: 'soft-stay',
    musicCue: musicSoft,
    clips: [
      {
        role: 'hook',
        label: 'Open',
        durationSec: 4,
        transition: 'none',
        overlay: softScrim,
        kind: 'photo',
        textBeats: ['headline'],
        motion: 'slow-zoom-in',
      },
      {
        role: 'broll',
        label: 'Pool',
        durationSec: 4,
        transition: 'dissolve',
        overlay: none,
        kind: 'photo',
        textBeats: [],
        motion: 'hold',
      },
      {
        role: 'cta',
        label: 'Close',
        durationSec: 4,
        transition: 'fade',
        overlay: bottomBand,
        kind: 'cta',
        textBeats: ['promoLine', 'ctaLine', 'rulesLine'],
      },
    ],
  },
  {
    id: 'amenity-tour',
    name: 'Amenity tour',
    category: 'soft-stay',
    musicCue: musicSoft,
    clips: [
      {
        role: 'hook',
        label: 'Tour',
        durationSec: 2,
        transition: 'none',
        overlay: topBand,
        kind: 'photo',
        textBeats: ['headline'],
      },
      {
        role: 'a1',
        label: 'Space',
        durationSec: 2.5,
        transition: 'slide-left',
        overlay: softScrim,
        kind: 'photo',
        textBeats: ['subheadline'],
      },
      {
        role: 'a2',
        label: 'Pool',
        durationSec: 2.5,
        transition: 'slide-left',
        overlay: softScrim,
        kind: 'photo',
        textBeats: ['promoLine'],
      },
      {
        role: 'a3',
        label: 'Rest',
        durationSec: 2.5,
        transition: 'fade',
        overlay: none,
        kind: 'photo',
        textBeats: [],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 2.5,
        transition: 'push-cut',
        overlay: bottomBand,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  },
  {
    id: 'weekday-cut',
    name: 'Weekday cut',
    category: 'flash-deal',
    musicCue: musicFlash,
    clips: [
      {
        role: 'hook',
        label: 'Hook',
        durationSec: 2,
        transition: 'none',
        overlay: softScrim,
        kind: 'photo',
        textBeats: ['headline'],
        motion: 'punch-in',
      },
      {
        role: 'offer',
        label: 'Deal',
        durationSec: 3.5,
        transition: 'zoom-in-out',
        overlay: bottomBand,
        kind: 'promo',
        textBeats: ['subheadline', 'promoLine'],
        motion: 'punch-in',
      },
      {
        role: 'stay',
        label: 'Stay',
        durationSec: 2.5,
        transition: 'wipe',
        overlay: softScrim,
        kind: 'photo',
        textBeats: ['rulesLine'],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 2.5,
        transition: 'push-cut',
        overlay: softScrim,
        kind: 'cta',
        textBeats: ['ctaLine'],
      },
    ],
  },
  {
    id: 'percent-off',
    name: 'Percent off',
    category: 'flash-deal',
    musicCue: musicFlash,
    clips: [
      {
        role: 'hook',
        label: 'Hook',
        durationSec: 2.5,
        transition: 'none',
        overlay: softScrim,
        kind: 'photo',
        textBeats: ['headline'],
      },
      {
        role: 'broll',
        label: 'Space',
        durationSec: 2.5,
        transition: 'dissolve',
        overlay: none,
        kind: 'photo',
        textBeats: [],
      },
      {
        role: 'offer',
        label: 'Offer',
        durationSec: 3.5,
        transition: 'fade',
        overlay: bottomBand,
        kind: 'promo',
        textBeats: ['subheadline', 'promoLine'],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 2.5,
        transition: 'wipe',
        overlay: softScrim,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  },
  {
    id: 'rainy-day-rate',
    name: 'Rainy day rate',
    category: 'flash-deal',
    musicCue: musicFlash,
    clips: [
      {
        role: 'hook',
        label: 'Hook',
        durationSec: 2.5,
        transition: 'none',
        overlay: topBand,
        kind: 'photo',
        textBeats: ['headline'],
        motion: 'drift-up',
      },
      {
        role: 'mood',
        label: 'Mood',
        durationSec: 2.5,
        transition: 'dissolve',
        overlay: none,
        kind: 'photo',
        textBeats: [],
        motion: 'hold',
      },
      {
        role: 'offer',
        label: 'Rate',
        durationSec: 3.5,
        transition: 'fade',
        overlay: bottomBand,
        kind: 'promo',
        textBeats: ['subheadline', 'promoLine'],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 3,
        transition: 'slide-left',
        overlay: softScrim,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  },
  {
    id: 'one-left',
    name: 'One left',
    category: 'last-openings',
    musicCue: musicUrgent,
    clips: [
      {
        role: 'hook',
        label: 'Hook',
        durationSec: 2,
        transition: 'none',
        overlay: topBand,
        kind: 'photo',
        textBeats: ['headline', 'subheadline'],
      },
      {
        role: 'date',
        label: 'Date',
        durationSec: 3.5,
        transition: 'dissolve',
        overlay: softScrim,
        kind: 'slots',
        textBeats: ['slotLabels'],
        motion: 'hold',
      },
      {
        role: 'broll',
        label: 'Stay',
        durationSec: 2.5,
        transition: 'fade',
        overlay: none,
        kind: 'photo',
        textBeats: [],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 2,
        transition: 'clock-wipe',
        overlay: softScrim,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  },
  {
    id: 'three-dates',
    name: 'Three dates',
    category: 'last-openings',
    musicCue: musicUrgent,
    clips: [
      {
        role: 'hook',
        label: 'Hook',
        durationSec: 2.5,
        transition: 'none',
        overlay: softScrim,
        kind: 'photo',
        textBeats: ['headline', 'subheadline'],
      },
      {
        role: 'b1',
        label: 'Photo 1',
        durationSec: 2.5,
        transition: 'fade',
        overlay: none,
        kind: 'photo',
        textBeats: [],
      },
      {
        role: 'dates',
        label: 'Dates',
        durationSec: 3.5,
        transition: 'dissolve',
        overlay: softScrim,
        kind: 'slots',
        textBeats: ['slotLabels', 'ctaLine'],
      },
      {
        role: 'b2',
        label: 'Photo 2',
        durationSec: 2,
        transition: 'fade',
        overlay: none,
        kind: 'photo',
        textBeats: [],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 2.5,
        transition: 'wipe',
        overlay: bottomBand,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  },
  {
    id: 'this-weekend',
    name: 'This weekend',
    category: 'last-openings',
    musicCue: musicUrgent,
    clips: [
      {
        role: 'hook',
        label: 'Hook',
        durationSec: 3,
        transition: 'none',
        overlay: softScrim,
        kind: 'promo',
        textBeats: ['headline', 'promoLine'],
        motion: 'punch-in',
      },
      {
        role: 'dates',
        label: 'Dates',
        durationSec: 3,
        transition: 'zoom-in-out',
        overlay: softScrim,
        kind: 'slots',
        textBeats: ['slotLabels'],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 3,
        transition: 'push-cut',
        overlay: bottomBand,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  },
  {
    id: 'guest-love',
    name: 'Guest love',
    category: 'reviews',
    musicCue: musicWarm,
    clips: [
      {
        role: 'hook',
        label: 'Hook',
        durationSec: 2.5,
        transition: 'none',
        overlay: softScrim,
        kind: 'photo',
        textBeats: ['headline'],
      },
      {
        role: 'quote',
        label: 'Quote',
        durationSec: 4,
        transition: 'dissolve',
        overlay: softScrim,
        kind: 'promo',
        textBeats: ['subheadline', 'promoLine'],
      },
      {
        role: 'broll',
        label: 'Stay',
        durationSec: 3,
        transition: 'fade',
        overlay: none,
        kind: 'photo',
        textBeats: [],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 2.5,
        transition: 'fade',
        overlay: bottomBand,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  },
  {
    id: 'stay-again',
    name: 'Stay again',
    category: 'reviews',
    musicCue: musicWarm,
    clips: [
      {
        role: 'hook',
        label: 'Hook',
        durationSec: 3.5,
        transition: 'none',
        overlay: softScrim,
        kind: 'promo',
        textBeats: ['headline', 'subheadline'],
      },
      {
        role: 'broll',
        label: 'Memory',
        durationSec: 3.5,
        transition: 'dissolve',
        overlay: none,
        kind: 'photo',
        textBeats: [],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 3,
        transition: 'fade',
        overlay: softScrim,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  },
  {
    id: 'sold-out-stamp',
    name: 'Sold out',
    category: 'fully-booked',
    musicCue: musicQuiet,
    preservePresetPalette: true,
    presetAccent: '#9db4c8',
    clips: [
      {
        role: 'stamp',
        label: 'Stamp',
        durationSec: 4,
        transition: 'none',
        overlay: softScrim,
        kind: 'promo',
        textBeats: ['headline', 'subheadline', 'promoLine'],
        motion: 'hold',
      },
      {
        role: 'cta',
        label: 'Next',
        durationSec: 3,
        transition: 'fade',
        overlay: bottomBand,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  },
  {
    id: 'join-waitlist',
    name: 'Join waitlist',
    category: 'fully-booked',
    musicCue: musicQuiet,
    clips: [
      {
        role: 'hook',
        label: 'Full',
        durationSec: 3,
        transition: 'none',
        overlay: softScrim,
        kind: 'photo',
        textBeats: ['headline'],
      },
      {
        role: 'message',
        label: 'Waitlist',
        durationSec: 4,
        transition: 'dissolve',
        overlay: softScrim,
        kind: 'promo',
        textBeats: ['subheadline', 'promoLine'],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 3,
        transition: 'fade',
        overlay: bottomBand,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  },
  {
    id: 'ber-months',
    name: 'Ber months',
    category: 'seasonal',
    musicCue: musicSeason,
    clips: [
      {
        role: 'hook',
        label: 'Season',
        durationSec: 2.5,
        transition: 'none',
        overlay: topBand,
        kind: 'photo',
        textBeats: ['headline'],
      },
      {
        role: 'b1',
        label: 'Photo 1',
        durationSec: 2.5,
        transition: 'fade',
        overlay: none,
        kind: 'photo',
        textBeats: [],
      },
      {
        role: 'offer',
        label: 'Offer',
        durationSec: 3,
        transition: 'dissolve',
        overlay: bottomBand,
        kind: 'promo',
        textBeats: ['subheadline', 'promoLine'],
      },
      {
        role: 'b2',
        label: 'Photo 2',
        durationSec: 2.5,
        transition: 'fade',
        overlay: none,
        kind: 'photo',
        textBeats: [],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 2.5,
        transition: 'wipe',
        overlay: softScrim,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  },
  {
    id: 'holiday-glow',
    name: 'Holiday glow',
    category: 'seasonal',
    musicCue: musicSeason,
    preservePresetPalette: true,
    presetAccent: '#c4a574',
    clips: [
      {
        role: 'hook',
        label: 'Glow',
        durationSec: 3,
        transition: 'none',
        overlay: softScrim,
        kind: 'photo',
        textBeats: ['headline'],
      },
      {
        role: 'broll',
        label: 'Home',
        durationSec: 3,
        transition: 'dissolve',
        overlay: none,
        kind: 'photo',
        textBeats: [],
      },
      {
        role: 'offer',
        label: 'Offer',
        durationSec: 3,
        transition: 'fade',
        overlay: bottomBand,
        kind: 'promo',
        textBeats: ['subheadline', 'promoLine'],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 3,
        transition: 'flip',
        overlay: softScrim,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  },
];

export function getVideoStoryboardRecipe(id: string): VideoStoryboardRecipe | undefined {
  return VIDEO_STORYBOARD_RECIPES.find((recipe) => recipe.id === id);
}

/** Soft fallback when a legacy/unknown template id is opened. */
export function fallbackVideoStoryboardRecipe(templateId: string): VideoStoryboardRecipe {
  return {
    id: templateId,
    name: templateId,
    category: 'soft-stay',
    musicCue: musicSoft,
    clips: [
      {
        role: 'hook',
        label: 'Intro',
        durationSec: 3,
        transition: 'none',
        overlay: softScrim,
        kind: 'photo',
        textBeats: ['headline'],
      },
      {
        role: 'broll',
        label: 'Photo',
        durationSec: 3,
        transition: 'fade',
        overlay: none,
        kind: 'photo',
        textBeats: [],
      },
      {
        role: 'offer',
        label: 'Offer',
        durationSec: 3,
        transition: 'fade',
        overlay: softScrim,
        kind: 'promo',
        textBeats: ['subheadline', 'promoLine'],
      },
      {
        role: 'cta',
        label: 'CTA',
        durationSec: 3,
        transition: 'fade',
        overlay: bottomBand,
        kind: 'cta',
        textBeats: ['ctaLine', 'rulesLine'],
      },
    ],
  };
}

export function resolveVideoStoryboardRecipe(templateId: string): VideoStoryboardRecipe {
  return getVideoStoryboardRecipe(templateId) ?? fallbackVideoStoryboardRecipe(templateId);
}
