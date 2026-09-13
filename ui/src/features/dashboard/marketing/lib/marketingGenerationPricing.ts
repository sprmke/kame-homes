/**
 * Client mirror of `supabase/functions/_shared/marketingGenerationPricing.ts` so the
 * composer can show a credit cost before the host clicks Generate.
 *
 * ⚠️  Keep the tables and `estimateGenerationCredits` byte-for-byte in step with the
 *     edge copy — parity is covered by `marketingGenerationPricing.test.ts`.
 */

import type { MarketingGenerationTier } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

export const DEFAULT_CREDIT_UNIT_USD = 0.001;

export const IMAGE_SIZES = ['512px', '1K', '2K', '4K'] as const;
export const VIDEO_RESOLUTIONS = ['720p', '1080p'] as const;
/** 4s is deliberately absent: Meta Reels requires 5-90s, so a 4s clip is unpublishable. */
export const VIDEO_DURATIONS = [6, 8] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];
export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number];
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

export const MAX_IMAGE_PROMPT_CHARS = 1000;
export const MAX_VIDEO_PROMPT_CHARS = 800;
export const MAX_NEGATIVE_PROMPT_CHARS = 500;

export const DEFAULT_IMAGE_ASPECT_RATIO = '1:1';
export const DEFAULT_VIDEO_ASPECT_RATIO = '9:16';
export const DEFAULT_IMAGE_SIZE: ImageSize = '1K';
export const DEFAULT_VIDEO_RESOLUTION: VideoResolution = '720p';
export const DEFAULT_VIDEO_DURATION: VideoDuration = 8;
export const DEFAULT_TIER: MarketingGenerationTier = 'standard';

const IMAGE_COST_USD: Record<MarketingGenerationTier, Record<ImageSize, number>> = {
  draft: { '512px': 0.0336, '1K': 0.0336, '2K': 0.0336, '4K': 0.0336 },
  standard: { '512px': 0.045, '1K': 0.045, '2K': 0.151, '4K': 0.151 },
  premium: { '512px': 0.134, '1K': 0.134, '2K': 0.24, '4K': 0.24 },
};

const VIDEO_USD_PER_SECOND: Record<
  MarketingGenerationTier,
  Record<VideoResolution, number>
> = {
  draft: { '720p': 0.05, '1080p': 0.08 },
  standard: { '720p': 0.1, '1080p': 0.3 },
  premium: { '720p': 0.4, '1080p': 0.6 },
};

export const IMAGE_MODEL_BY_TIER: Record<MarketingGenerationTier, string> = {
  draft: 'gemini-3.1-flash-lite-image',
  standard: 'gemini-3.1-flash-image',
  premium: 'gemini-3-pro-image',
};

export const IMAGE_SIZES_BY_TIER: Record<MarketingGenerationTier, readonly ImageSize[]> = {
  draft: ['1K'],
  standard: IMAGE_SIZES,
  premium: IMAGE_SIZES,
};

export const IMAGE_MAX_REFERENCES_BY_TIER: Record<MarketingGenerationTier, number> = {
  draft: 14,
  standard: 10,
  premium: 6,
};

export function creditsForUsd(costUsd: number, creditUnitUsd = DEFAULT_CREDIT_UNIT_USD): number {
  if (costUsd <= 0) return 0;
  const unit = creditUnitUsd > 0 ? creditUnitUsd : DEFAULT_CREDIT_UNIT_USD;
  return Math.max(1, Math.ceil(costUsd / unit));
}

export type GenerationEstimateInput =
  | { mediaType: 'image'; tier: MarketingGenerationTier; imageSize: ImageSize }
  | {
      mediaType: 'video';
      tier: MarketingGenerationTier;
      resolution: VideoResolution;
      durationSeconds: VideoDuration;
    };

export function estimateGenerationCostUsd(input: GenerationEstimateInput): number {
  if (input.mediaType === 'image') {
    return IMAGE_COST_USD[input.tier][input.imageSize];
  }
  const perSecond = VIDEO_USD_PER_SECOND[input.tier][input.resolution];
  return Math.round(perSecond * input.durationSeconds * 1_000_000) / 1_000_000;
}

export function estimateGenerationCredits(
  input: GenerationEstimateInput,
  creditUnitUsd = DEFAULT_CREDIT_UNIT_USD
): number {
  return creditsForUsd(estimateGenerationCostUsd(input), creditUnitUsd);
}
