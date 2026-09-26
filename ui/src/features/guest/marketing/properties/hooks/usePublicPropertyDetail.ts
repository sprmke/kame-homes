import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePreviewOverride } from '@/features/guest/lib/previewOverrideContext';
import { mapApiPropertyToResolved } from '@/features/guest/marketing/properties/lib/mapPublicPropertyDetail';
import type {
  PublicPropertyDetailDto,
  ResolvedPropertyDetail,
} from '@/features/guest/marketing/properties/types/publicProperty';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const PUBLIC_PROPERTY_QUERY_KEY = ['public-property'] as const;

function publicPropertyUrl(slug: string, previewJwt: string | null): string {
  const params = new URLSearchParams({ property: slug });
  if (previewJwt) {
    params.set('preview', '1');
    params.set('admin_jwt', previewJwt);
  }
  return `${FUNCTIONS_URL}/get-public-property?${params}`;
}

async function fetchPublicProperty(
  slug: string,
  previewJwt: string | null
): Promise<ResolvedPropertyDetail | null> {
  const res = await fetch(publicPropertyUrl(slug, previewJwt), {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
  });

  if (res.status === 404) {
    return null;
  }

  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: PublicPropertyDetailDto;
  };

  if (!json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to load property');
  }

  return mapApiPropertyToResolved(json.data);
}

function propertyLandingOverrideResult(
  data: ResolvedPropertyDetail
): UseQueryResult<ResolvedPropertyDetail | null, Error> {
  return {
    data,
    error: null,
    isError: false,
    isLoading: false,
    isPending: false,
    isLoadingError: false,
    isRefetchError: false,
    isSuccess: true,
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isRefetching: false,
    isStale: false,
    isPlaceholderData: false,
    isPaused: false,
    status: 'success',
    fetchStatus: 'idle',
    dataUpdatedAt: Date.now(),
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    refetch: async () =>
      ({
        data,
        error: null,
        isError: false,
        isLoading: false,
        isSuccess: true,
        status: 'success',
      }) as UseQueryResult<ResolvedPropertyDetail | null, Error>,
  } as UseQueryResult<ResolvedPropertyDetail | null, Error>;
}

type PublicPropertyDetailOptions = {
  /** Page Editor: session JWT so INACTIVE listings still load. `null` means still resolving. */
  previewJwt?: string | null;
};

export function usePublicPropertyDetail(
  propertySlug: string,
  options?: PublicPropertyDetailOptions
) {
  const override = usePreviewOverride();
  const hasOverride = override?.kind === 'property-landing';
  const waitsForPreviewJwt = options != null && 'previewJwt' in options;
  const previewJwt = options?.previewJwt ?? null;

  const query = useQuery({
    queryKey: [
      ...PUBLIC_PROPERTY_QUERY_KEY,
      propertySlug,
      waitsForPreviewJwt ? 'host-preview' : 'public',
    ],
    queryFn: () => fetchPublicProperty(propertySlug, waitsForPreviewJwt ? previewJwt : null),
    enabled: !hasOverride && Boolean(propertySlug) && (!waitsForPreviewJwt || previewJwt !== null),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  if (hasOverride) {
    return propertyLandingOverrideResult(override.data);
  }
  return query;
}
