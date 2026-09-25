import {
  IMAGE_MAX_REFERENCES_BY_TIER,
  IMAGE_SIZES_BY_TIER,
  type ImageSize,
} from '@/features/dashboard/marketing/lib/marketingGenerationPricing';
import type { MarketingGenerationTier } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

export type TierOption = {
  value: MarketingGenerationTier;
  label: string;
  hint: string;
};

export const PREMIUM_TIER_OPTION: TierOption = {
  value: 'premium',
  label: 'Premium',
  hint: 'Highest quality, highest cost',
};

export function imageTierOptions(allowPremium: boolean): TierOption[] {
  return allowPremium ? [...IMAGE_TIER_OPTIONS, PREMIUM_TIER_OPTION] : IMAGE_TIER_OPTIONS;
}

export function videoTierOptions(allowPremium: boolean): TierOption[] {
  return allowPremium ? [...VIDEO_TIER_OPTIONS, PREMIUM_TIER_OPTION] : VIDEO_TIER_OPTIONS;
}

export const IMAGE_TIER_OPTIONS: TierOption[] = [
  { value: 'draft', label: 'Draft', hint: 'Cheapest, good for trying ideas' },
  { value: 'standard', label: 'Standard', hint: 'Best balance of quality and cost' },
];

export type AspectRatioOption = {
  value: string;
  label: string;
  hint: string;
  /** width / height, for the preview frame */
  ratio: number;
};

export const IMAGE_ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { value: '1:1', label: 'Square', hint: 'Feed post', ratio: 1 },
  { value: '4:5', label: 'Portrait', hint: 'Feed post', ratio: 4 / 5 },
  { value: '9:16', label: 'Story', hint: 'Story or Reel cover', ratio: 9 / 16 },
  { value: '16:9', label: 'Landscape', hint: 'Cover photo', ratio: 16 / 9 },
];

export const IMAGE_SIZE_LABELS: Record<ImageSize, string> = {
  '512px': 'Small',
  '1K': 'Standard',
  '2K': 'Large',
  '4K': 'Extra large',
};

export function imageSizeOptions(tier: MarketingGenerationTier): ImageSize[] {
  return [...IMAGE_SIZES_BY_TIER[tier]];
}

export function maxReferencesForTier(tier: MarketingGenerationTier): number {
  return IMAGE_MAX_REFERENCES_BY_TIER[tier];
}

export type ImageStylePreset = {
  id: string;
  title: string;
  /** A fuller, tested scene-description fragment — not shorthand like the starters
   *  above. Still runs through server-side prompt enhancement like anything else
   *  the host submits, but is written to already carry real photographic direction
   *  (lighting, camera framing, mood) rather than a bare subject. */
  prompt: string;
};

/** Featured count shown before the composer's "More styles" toggle. */
export const IMAGE_STYLE_PRESETS_PREVIEW_COUNT = 4;

/**
 * Curated photographic style presets for the Generate tab (Phase 3b of the
 * quality-hardening plan) — real-estate/hospitality photography conventions:
 * wide-angle interiors, golden-hour or bright diffused daylight, level verticals,
 * styled-but-lived-in framing. First 4 are featured; the rest sit behind "More".
 */
export const IMAGE_STYLE_PRESETS: ImageStylePreset[] = [
  {
    id: 'golden-hour-interior',
    title: 'Golden Hour Interior',
    prompt:
      'Wide-angle interior shot, warm late-afternoon sunlight streaming through the windows, long soft shadows, cozy and inviting, styled but lived-in',
  },
  {
    id: 'bright-scandinavian',
    title: 'Bright Scandinavian Morning',
    prompt:
      'Bright, airy interior in soft diffused morning daylight, clean minimal styling, light wood tones and white linens, calm and fresh',
  },
  {
    id: 'poolside-evening',
    title: 'Poolside Evening',
    prompt:
      'Poolside at dusk, warm string lights and ambient lounge lighting reflecting off the water, inviting resort atmosphere',
  },
  {
    id: 'editorial-wide',
    title: 'Editorial Wide',
    prompt:
      'Wide establishing shot of the space from a low, level angle, architectural composition, natural light, magazine-editorial feel',
  },
  {
    id: 'rainy-day-cozy',
    title: 'Rainy Day Cozy',
    prompt:
      'Interior view with a rain-streaked window in the frame, warm lamplight inside contrasting the gray daylight outside, cozy and intimate',
  },
  {
    id: 'blue-hour-view',
    title: 'Blue Hour View',
    prompt:
      'Balcony or rooftop view at blue hour just after sunset, city or skyline lights beginning to glow, cool ambient sky, warm interior light spilling out',
  },
  {
    id: 'sunlit-detail',
    title: 'Sunlit Detail',
    prompt:
      'Close-up detail shot of styling and textures — linens, ceramics, or furniture finish — in soft directional sunlight, shallow depth of field',
  },
  {
    id: 'crisp-daylight-bedroom',
    title: 'Crisp Daylight Bedroom',
    prompt:
      'Bedroom in crisp bright daylight, crisp white linens with visible fabric texture, minimal styling, calm and restful mood',
  },
  {
    id: 'kitchen-afternoon-sun',
    title: 'Kitchen Afternoon Sun',
    prompt:
      'Kitchen island scene in warm afternoon sun, natural light raking across the countertop, homey and welcoming',
  },
  {
    id: 'moody-evening-lounge',
    title: 'Moody Evening Lounge',
    prompt:
      'Living or lounge area at night with warm layered lamplight, dim ambient mood, relaxed and intimate atmosphere',
  },
];

/**
 * Video tier options. Premium is hidden unless a super-admin enables it per property.
 */
export const VIDEO_TIER_OPTIONS: TierOption[] = [
  { value: 'draft', label: 'Draft', hint: 'Cheapest, good for trying ideas' },
  { value: 'standard', label: 'Standard', hint: 'Best balance of quality and cost' },
];

/** Video only supports 16:9 or 9:16 (Veo's own limitation). 9:16 is the default — most
 *  marketing video ends up as a Reel or Story. */
export const VIDEO_ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { value: '9:16', label: 'Story / Reel', hint: 'Instagram Reels, Stories', ratio: 9 / 16 },
  { value: '16:9', label: 'Landscape', hint: 'Feed video, YouTube', ratio: 16 / 9 },
];

export const VIDEO_RESOLUTION_LABELS: Record<'720p' | '1080p', string> = {
  '720p': 'Standard (720p)',
  '1080p': 'High (1080p)',
};

export const VIDEO_DURATION_LABELS: Record<6 | 8, string> = {
  6: '6 seconds',
  8: '8 seconds',
};

/** Video accepts at most 3 reference images (Veo's own limitation) across every tier. */
export const VIDEO_MAX_REFERENCES = 3;

/** Prompt starters for video. Short, motion-oriented chips. */
export const VIDEO_PROMPT_STARTERS: string[] = [
  'Pan across the living room at golden hour',
  'Rise over the pool deck and skyline',
  'Push-in on the bedroom, soft breeze',
  'Walkthrough from entry to kitchen',
];
