/**
 * Pure option validation + credit estimation for Marketing Studio AI generation.
 *
 * No I/O, so the credit table is directly unit-testable (marketingGenerationPricing_test.ts)
 * — it is the thing most likely to silently drift when a model or price changes.
 *
 * ⚠️  Mirrored on the client by `ui/src/features/dashboard/marketing/lib/marketingGenerationPricing.ts`
 *     so the composer can show a cost before the click. Parity is covered by a unit test;
 *     keep the tables and the estimate function identical.
 */

import {
  type AiImageModelConfig,
  type AiVideoModelConfig,
  type MarketingGenerationTier,
  estimateVideoCostUsd,
  getMarketingImageModel,
  getMarketingVideoModel,
} from './aiModelRouter.ts';

export const DEFAULT_CREDIT_UNIT_USD = 0.001;

export const GENERATION_TIERS = ['draft', 'standard', 'premium'] as const;
export const IMAGE_SIZES = ['512px', '1K', '2K', '4K'] as const;
export const VIDEO_RESOLUTIONS = ['720p', '1080p'] as const;
/** 4s is deliberately absent: Meta Reels requires 5-90s, so a 4s clip is unpublishable. */
export const VIDEO_DURATIONS = [6, 8] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];
export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number];
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

export const MAX_IMAGE_PROMPT_CHARS = 1000;
/** Veo caps the prompt at 1,024 tokens; 800 chars stays comfortably inside it. */
export const MAX_VIDEO_PROMPT_CHARS = 800;
export const MAX_NEGATIVE_PROMPT_CHARS = 500;

export const DEFAULT_IMAGE_ASPECT_RATIO = '1:1';
export const DEFAULT_VIDEO_ASPECT_RATIO = '9:16';
export const DEFAULT_IMAGE_SIZE: ImageSize = '1K';
export const DEFAULT_VIDEO_RESOLUTION: VideoResolution = '720p';
export const DEFAULT_VIDEO_DURATION: VideoDuration = 8;
export const DEFAULT_TIER: MarketingGenerationTier = 'standard';

/**
 * Typical USD per generated image, by tier and requested size. Gemini image models bill
 * in tokens, so the real charge comes from `usageMetadata`; these are the pre-flight
 * estimate shown to the host and the in-flight reservation amount.
 */
const IMAGE_COST_USD: Record<MarketingGenerationTier, Record<ImageSize, number>> = {
  draft: { '512px': 0.0336, '1K': 0.0336, '2K': 0.0336, '4K': 0.0336 },
  standard: { '512px': 0.045, '1K': 0.045, '2K': 0.151, '4K': 0.151 },
  premium: { '512px': 0.134, '1K': 0.134, '2K': 0.24, '4K': 0.24 },
};

export function creditsForUsd(costUsd: number, creditUnitUsd = DEFAULT_CREDIT_UNIT_USD): number {
  if (costUsd <= 0) return 0;
  const unit = creditUnitUsd > 0 ? creditUnitUsd : DEFAULT_CREDIT_UNIT_USD;
  return Math.max(1, Math.ceil(costUsd / unit));
}

export function estimateImageCostUsd(tier: MarketingGenerationTier, size: ImageSize): number {
  return IMAGE_COST_USD[tier][size];
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
    return estimateImageCostUsd(input.tier, input.imageSize);
  }
  return estimateVideoCostUsd(
    getMarketingVideoModel(input.tier),
    input.resolution,
    input.durationSeconds
  );
}

export function estimateGenerationCredits(
  input: GenerationEstimateInput,
  creditUnitUsd = DEFAULT_CREDIT_UNIT_USD
): number {
  return creditsForUsd(estimateGenerationCostUsd(input), creditUnitUsd);
}

/* ── Option validation ─────────────────────────────────────────────────────── */

export class GenerationOptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationOptionError';
  }
}

export function isGenerationTier(value: unknown): value is MarketingGenerationTier {
  return (GENERATION_TIERS as readonly string[]).includes(value as string);
}

export type ValidatedImageOptions = {
  tier: MarketingGenerationTier;
  config: AiImageModelConfig;
  aspectRatio: string;
  imageSize: ImageSize;
};

export function assertValidImageOptions(input: {
  tier?: string;
  aspectRatio?: string;
  imageSize?: string;
  referenceCount: number;
}): ValidatedImageOptions {
  const tier = isGenerationTier(input.tier) ? input.tier : DEFAULT_TIER;
  const config = getMarketingImageModel(tier);

  const aspectRatio = input.aspectRatio?.trim() || DEFAULT_IMAGE_ASPECT_RATIO;
  if (!config.allowedAspectRatios.includes(aspectRatio)) {
    throw new GenerationOptionError(`Aspect ratio ${aspectRatio} is not available on this quality`);
  }

  const imageSize = (input.imageSize?.trim() || DEFAULT_IMAGE_SIZE) as ImageSize;
  if (!config.allowedSizes.includes(imageSize)) {
    throw new GenerationOptionError(`Size ${imageSize} is not available on this quality`);
  }

  if (input.referenceCount > config.maxReferenceImages) {
    throw new GenerationOptionError(
      `This quality accepts at most ${config.maxReferenceImages} reference images`
    );
  }

  return { tier, config, aspectRatio, imageSize };
}

export type ValidatedVideoOptions = {
  tier: MarketingGenerationTier;
  config: AiVideoModelConfig;
  aspectRatio: string;
  resolution: VideoResolution;
  durationSeconds: VideoDuration;
};

export function assertValidVideoOptions(input: {
  tier?: string;
  aspectRatio?: string;
  resolution?: string;
  durationSeconds?: number;
  referenceCount: number;
}): ValidatedVideoOptions {
  const tier = isGenerationTier(input.tier) ? input.tier : DEFAULT_TIER;
  const config = getMarketingVideoModel(tier);

  const aspectRatio = input.aspectRatio?.trim() || DEFAULT_VIDEO_ASPECT_RATIO;
  if (!config.allowedAspectRatios.includes(aspectRatio)) {
    throw new GenerationOptionError('Video must be 16:9 or 9:16');
  }

  const resolution = (input.resolution?.trim() || DEFAULT_VIDEO_RESOLUTION) as VideoResolution;
  if (!config.allowedResolutions.includes(resolution)) {
    throw new GenerationOptionError(`Resolution ${resolution} is not available on this quality`);
  }

  const durationSeconds = (input.durationSeconds ?? DEFAULT_VIDEO_DURATION) as VideoDuration;
  if (!config.allowedDurations.includes(durationSeconds)) {
    throw new GenerationOptionError('Video length must be 6 or 8 seconds');
  }

  if (input.referenceCount > config.maxReferenceImages) {
    throw new GenerationOptionError(
      `Video accepts at most ${config.maxReferenceImages} reference images`
    );
  }

  return { tier, config, aspectRatio, resolution, durationSeconds };
}

export function isGenerationOptionError(error: unknown): error is GenerationOptionError {
  return error instanceof GenerationOptionError;
}
