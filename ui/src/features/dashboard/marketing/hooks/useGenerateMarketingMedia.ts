import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  MARKETING_GENERATIONS_QUERY_KEY,
  generationFetch,
  handleGenerationError,
} from '@/features/dashboard/marketing/hooks/useMarketingGenerationApi';
import { seedMarketingGenerationJob } from '@/features/dashboard/marketing/hooks/useMarketingGenerationJob';
import type {
  ImageSize,
  VideoDuration,
  VideoResolution,
} from '@/features/dashboard/marketing/lib/marketingGenerationPricing';
import type {
  MarketingGenerationJob,
  MarketingGenerationMediaType,
  MarketingGenerationTier,
} from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export type GenerateMarketingMediaPayload = {
  mediaType: MarketingGenerationMediaType;
  prompt: string;
  negativePrompt?: string;
  qualityTier?: MarketingGenerationTier;
  aspectRatio?: string;
  imageSize?: ImageSize;
  resolution?: VideoResolution;
  durationSeconds?: VideoDuration;
  referenceIds?: string[];
};

export function useGenerateMarketingMedia() {
  const propertyId = usePropertyIdParam();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: GenerateMarketingMediaPayload) =>
      generationFetch<{ job: MarketingGenerationJob }>(
        scopedFunctionsUrl('generate-marketing-media', propertyId),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        payload.mediaType === 'video' ? 'aiMarketingVideoGeneration' : 'aiMarketingImageGeneration'
      ),
    onSuccess: ({ job }) => {
      // Seed the per-job cache so the poller starts hot instead of firing a redundant GET.
      seedMarketingGenerationJob(qc, job, propertyId);
      void qc.invalidateQueries({ queryKey: [MARKETING_GENERATIONS_QUERY_KEY, propertyId] });
    },
    onError: (error: Error) => handleGenerationError(error),
  });
}
