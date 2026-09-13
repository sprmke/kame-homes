import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  MARKETING_GENERATION_REFERENCES_QUERY_KEY,
  generationFetch,
  handleGenerationError,
} from '@/features/dashboard/marketing/hooks/useMarketingGenerationApi';
import type { MarketingGenerationReference } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { prepareUpload } from '@/lib/media/prepareUpload';

export function useMarketingGenerationReferences() {
  const propertyId = usePropertyIdParam();

  return useQuery({
    queryKey: [MARKETING_GENERATION_REFERENCES_QUERY_KEY, propertyId],
    enabled: Boolean(propertyId),
    queryFn: () =>
      generationFetch<{ references: MarketingGenerationReference[] }>(
        scopedFunctionsUrl('upload-marketing-generation-reference', propertyId)
      ).then((data) => data.references),
    staleTime: 30_000,
  });
}

export function useUploadMarketingGenerationReference() {
  const propertyId = usePropertyIdParam();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<MarketingGenerationReference> => {
      // prepareUpload lazy-loads the image optimizer; never import it statically here
      // (CI enforces that via scripts/media/assert-lazy-optimizer.mjs).
      const prepared = await prepareUpload(file, {
        imagePreset: 'CONTENT',
        surface: 'marketing-ai-reference',
      });
      if (prepared.error) throw new Error(prepared.error);

      const formData = new FormData();
      formData.append('file', prepared.file);

      const { reference } = await generationFetch<{ reference: MarketingGenerationReference }>(
        scopedFunctionsUrl('upload-marketing-generation-reference', propertyId),
        { method: 'POST', body: formData }
      );
      return reference;
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: [MARKETING_GENERATION_REFERENCES_QUERY_KEY, propertyId],
      });
    },
    onError: (error: Error) => handleGenerationError(error),
  });
}

export function useDeleteMarketingGenerationReference() {
  const propertyId = usePropertyIdParam();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (referenceId: string) =>
      generationFetch<{ referenceId: string }>(
        scopedFunctionsUrl('upload-marketing-generation-reference', propertyId),
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referenceId }),
        }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: [MARKETING_GENERATION_REFERENCES_QUERY_KEY, propertyId],
      });
    },
    onError: (error: Error) => handleGenerationError(error),
  });
}
