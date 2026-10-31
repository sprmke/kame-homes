import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PropertyLandingSectionConfig } from '@/features/guest/marketing/properties/types/publicProperty';
import type { PropertyShowcaseConfig } from '@/features/guest/marketing/showcase/types/showcase';
import type { StayGuideConfigV2 } from '@/features/guest/stay-guide/lib/stayGuideConfig';

import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type PublicPageType = 'stay_guide' | 'property_landing' | 'property_showcase';

export type PublicPageConfigDto = {
  pageType: PublicPageType;
  config: StayGuideConfigV2 | PropertyLandingSectionConfig | PropertyShowcaseConfig;
  updatedAt: string;
};

export const PUBLIC_PAGE_CONFIG_QUERY_KEY = ['public-page-configs'] as const;

async function fetchPublicPageConfig(
  propertyId: string,
  pageType: PublicPageType
): Promise<PublicPageConfigDto> {
  const jwt = await getSessionJwt();
  const url = new URL(scopedFunctionsUrl('/public-page-configs', propertyId));
  url.searchParams.set('page_type', pageType);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: PublicPageConfigDto;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to load page config');
  }
  return json.data;
}

async function patchPublicPageConfig(
  propertyId: string,
  pageType: PublicPageType,
  config: StayGuideConfigV2 | PropertyLandingSectionConfig | PropertyShowcaseConfig
): Promise<PublicPageConfigDto> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('/public-page-configs', propertyId), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pageType, config }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: PublicPageConfigDto;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to save page config');
  }
  return json.data;
}

export function usePublicPageConfig(pageType: PublicPageType) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: [...PUBLIC_PAGE_CONFIG_QUERY_KEY, propertyId, pageType],
    queryFn: () => fetchPublicPageConfig(propertyId!, pageType),
    enabled: Boolean(propertyId),
  });
}

export function useSavePublicPageConfig(pageType: PublicPageType) {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      config: StayGuideConfigV2 | PropertyLandingSectionConfig | PropertyShowcaseConfig
    ) => {
      if (!propertyId) throw new Error('Missing property');
      return patchPublicPageConfig(propertyId, pageType, config);
    },
    onSuccess: (data) => {
      if (!propertyId) return;
      queryClient.setQueryData([...PUBLIC_PAGE_CONFIG_QUERY_KEY, propertyId, pageType], data);
    },
  });
}
