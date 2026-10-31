import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type MarketingGenerationOverrideRow = {
  propertyId: string;
  propertyName: string;
  imageMonthlyCreditCap: number | null;
  videoMonthlyCreditCap: number | null;
  allowPremiumImage: boolean;
  allowPremiumVideo: boolean;
};

export type MarketingGenerationOverridesDto = {
  organizationId: string;
  organizationName: string;
  properties: MarketingGenerationOverrideRow[];
};

const overridesKey = (orgId: string) =>
  ['super-admin', 'ai-platform-generation-overrides', orgId] as const;

export function useAiPlatformGenerationOverrides(orgId: string | null) {
  return useQuery({
    queryKey: overridesKey(orgId ?? ''),
    enabled: Boolean(orgId),
    queryFn: () =>
      callEdgeFunction<MarketingGenerationOverridesDto>(
        `ai-platform-generation-overrides?org_id=${encodeURIComponent(orgId!)}`
      ),
  });
}

export function usePatchAiPlatformGenerationOverrides(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      propertyId: string;
      imageMonthlyCreditCap?: number | null;
      videoMonthlyCreditCap?: number | null;
      allowPremiumImage?: boolean;
      allowPremiumVideo?: boolean;
    }) =>
      callEdgeFunction<MarketingGenerationOverrideRow>('ai-platform-generation-overrides', {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      if (orgId) void qc.invalidateQueries({ queryKey: overridesKey(orgId) });
    },
  });
}
