import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  MARKETING_GENERATIONS_QUERY_KEY,
  generationFetch,
  handleGenerationError,
} from '@/features/dashboard/marketing/hooks/useMarketingGenerationApi';
import type {
  MarketingGenerationJob,
  MarketingGenerationMediaType,
} from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

const PAGE_SIZE = 24;

type GenerationsPage = {
  jobs: MarketingGenerationJob[];
  nextCursor: string | null;
};

async function fetchMarketingGenerations(
  propertyId: string | null,
  mediaType: MarketingGenerationMediaType | undefined,
  cursor: string | null
): Promise<GenerationsPage> {
  const base = scopedFunctionsUrl('marketing-generations', propertyId);
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (mediaType) params.set('mediaType', mediaType);
  if (cursor) params.set('cursor', cursor);
  const separator = base.includes('?') ? '&' : '?';
  return generationFetch<GenerationsPage>(`${base}${separator}${params.toString()}`);
}

export function useMarketingGenerations(mediaType?: MarketingGenerationMediaType) {
  const propertyId = usePropertyIdParam();

  return useInfiniteQuery({
    queryKey: [MARKETING_GENERATIONS_QUERY_KEY, propertyId, mediaType ?? 'all'],
    queryFn: ({ pageParam }) =>
      fetchMarketingGenerations(propertyId, mediaType, pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}

export function useDeleteMarketingGeneration() {
  const propertyId = usePropertyIdParam();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) =>
      generationFetch<{ jobId: string }>(
        scopedFunctionsUrl('marketing-generations', propertyId),
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId }),
        }
      ),
    onSuccess: () => {
      toast.success('Deleted');
      void qc.invalidateQueries({ queryKey: [MARKETING_GENERATIONS_QUERY_KEY, propertyId] });
    },
    onError: (error: Error) => handleGenerationError(error),
  });
}
