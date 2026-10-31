import { useQuery, type QueryClient } from '@tanstack/react-query';

import {
  MARKETING_GENERATION_JOB_QUERY_KEY,
  generationFetch,
} from '@/features/dashboard/marketing/hooks/useMarketingGenerationApi';
import {
  isGenerationInFlight,
  isStuckMarketingGeneration,
} from '@/features/dashboard/marketing/lib/marketingGenerationProgress';
import type { MarketingGenerationJob } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

/** Images settle in seconds; video takes minutes, so it gets the slower cadence. */
const IMAGE_POLL_MS = 1000;
const VIDEO_POLL_MS = 3000;

export function marketingGenerationJobQueryKey(jobId: string | null, propertyId: string | null) {
  return [MARKETING_GENERATION_JOB_QUERY_KEY, jobId, propertyId];
}

async function fetchMarketingGenerationJob(
  jobId: string,
  propertyId: string | null
): Promise<MarketingGenerationJob> {
  const base = scopedFunctionsUrl('get-marketing-generation-job', propertyId);
  const separator = base.includes('?') ? '&' : '?';
  const { job } = await generationFetch<{ job: MarketingGenerationJob }>(
    `${base}${separator}jobId=${encodeURIComponent(jobId)}`
  );
  return job;
}

export function useMarketingGenerationJob(jobId: string | null | undefined) {
  const propertyId = usePropertyIdParam();

  return useQuery({
    queryKey: marketingGenerationJobQueryKey(jobId ?? null, propertyId),
    queryFn: () => fetchMarketingGenerationJob(jobId as string, propertyId),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!isGenerationInFlight(job)) return false;
      // Orphaned row (killed worker, provider never answered) — stop hammering GET.
      if (isStuckMarketingGeneration(job)) return false;
      return job?.mediaType === 'video' ? VIDEO_POLL_MS : IMAGE_POLL_MS;
    },
    // Video runs for minutes and hosts will switch tabs while they wait.
    refetchIntervalInBackground: true,
    staleTime: 0,
  });
}

export function seedMarketingGenerationJob(
  qc: QueryClient,
  job: MarketingGenerationJob,
  propertyId: string | null
) {
  qc.setQueryData(marketingGenerationJobQueryKey(job.id, propertyId), job);
}
