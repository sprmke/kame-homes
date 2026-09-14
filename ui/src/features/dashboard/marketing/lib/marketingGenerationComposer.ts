import {
  IMAGE_ASPECT_RATIO_OPTIONS,
  VIDEO_ASPECT_RATIO_OPTIONS,
  VIDEO_MAX_REFERENCES,
  maxReferencesForTier,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_TIER,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION,
  DEFAULT_VIDEO_RESOLUTION,
  IMAGE_SIZES,
  VIDEO_DURATIONS,
  VIDEO_RESOLUTIONS,
  type ImageSize,
  type VideoDuration,
  type VideoResolution,
} from '@/features/dashboard/marketing/lib/marketingGenerationPricing';
import type {
  MarketingGenerationJob,
  MarketingGenerationMediaType,
  MarketingGenerationReference,
  MarketingGenerationTier,
} from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

export type AiStudioComposerValues = {
  mediaType: MarketingGenerationMediaType;
  prompt: string;
  qualityTier: MarketingGenerationTier;
  aspectRatio: string;
  imageSize: ImageSize;
  resolution: VideoResolution;
  durationSeconds: VideoDuration;
  references: MarketingGenerationReference[];
};

export type AiStudioComposerDraft = {
  id: number;
  values: AiStudioComposerValues;
};

const IMAGE_ASPECTS = new Set(IMAGE_ASPECT_RATIO_OPTIONS.map((option) => option.value));
const VIDEO_ASPECTS = new Set(VIDEO_ASPECT_RATIO_OPTIONS.map((option) => option.value));
const IMAGE_SIZE_SET = new Set<string>(IMAGE_SIZES);
const VIDEO_RES_SET = new Set<string>(VIDEO_RESOLUTIONS);
const VIDEO_DUR_SET = new Set<number>(VIDEO_DURATIONS);
const TIERS: readonly MarketingGenerationTier[] = ['draft', 'standard', 'premium'];

export function referencesMatchingJob(
  job: Pick<MarketingGenerationJob, 'referencePaths' | 'referenceUrls'>,
  library: MarketingGenerationReference[]
): MarketingGenerationReference[] {
  if (library.length === 0) return [];
  const paths = new Set(job.referencePaths);
  const urls = new Set(job.referenceUrls);
  if (paths.size === 0 && urls.size === 0) return [];
  return library.filter((row) => paths.has(row.storage_path) || urls.has(row.public_url));
}

export function composerValuesFromJob(
  job: MarketingGenerationJob,
  library: MarketingGenerationReference[],
  options: { allowPremium: boolean; allowHighResolution: boolean }
): AiStudioComposerValues {
  const isVideo = job.mediaType === 'video';
  let qualityTier: MarketingGenerationTier = TIERS.includes(job.qualityTier)
    ? job.qualityTier
    : DEFAULT_TIER;
  if (qualityTier === 'premium' && !options.allowPremium) qualityTier = DEFAULT_TIER;

  const aspectRatio = isVideo
    ? VIDEO_ASPECTS.has(job.aspectRatio)
      ? job.aspectRatio
      : DEFAULT_VIDEO_ASPECT_RATIO
    : IMAGE_ASPECTS.has(job.aspectRatio)
      ? job.aspectRatio
      : DEFAULT_IMAGE_ASPECT_RATIO;

  const requestedSize =
    job.imageSize && IMAGE_SIZE_SET.has(job.imageSize)
      ? (job.imageSize as ImageSize)
      : DEFAULT_IMAGE_SIZE;

  let resolution: VideoResolution =
    job.resolution && VIDEO_RES_SET.has(job.resolution)
      ? (job.resolution as VideoResolution)
      : DEFAULT_VIDEO_RESOLUTION;
  if (resolution === '1080p' && !options.allowHighResolution) {
    resolution = DEFAULT_VIDEO_RESOLUTION;
  }

  const durationSeconds =
    job.durationSeconds != null && VIDEO_DUR_SET.has(job.durationSeconds)
      ? (job.durationSeconds as VideoDuration)
      : DEFAULT_VIDEO_DURATION;

  const cap = isVideo ? VIDEO_MAX_REFERENCES : maxReferencesForTier(qualityTier);
  const references = referencesMatchingJob(job, library).slice(0, cap);

  return {
    mediaType: isVideo ? 'video' : 'image',
    prompt: job.prompt,
    qualityTier,
    aspectRatio,
    imageSize: qualityTier === 'draft' ? '1K' : requestedSize,
    resolution,
    durationSeconds,
    references,
  };
}

export function fileNameForGeneratedReference(
  job: Pick<MarketingGenerationJob, 'id' | 'outputMimeType'>
): string {
  const mime = job.outputMimeType ?? '';
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  return `generated-${job.id}.${ext}`;
}
