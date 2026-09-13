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

/** Prompt starters (chips). Keep shorter than the textarea placeholder. */
export const IMAGE_PROMPT_STARTERS: string[] = [
  'Bright living room, morning light',
  'Poolside evening with warm lights',
  'Cozy window seat on a rainy day',
  'Entryway walk-in, soft daylight',
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
