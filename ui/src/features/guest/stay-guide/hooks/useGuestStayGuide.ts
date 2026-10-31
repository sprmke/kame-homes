import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePreviewOverride } from '@/features/guest/lib/previewOverrideContext';
import { fetchGuestStayGuide, type GuestStayGuideDto } from '@/features/guest/stay-guide/lib/api';
import { fetchGuestStayGuidePreview } from '@/features/guest/stay-guide/lib/previewApi';

export const GUEST_STAY_GUIDE_QUERY_KEY = ['guest-stay-guide'] as const;

function stayGuideOverrideResult(
  data: GuestStayGuideDto
): UseQueryResult<GuestStayGuideDto, Error> {
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
      }) as UseQueryResult<GuestStayGuideDto, Error>,
  } as UseQueryResult<GuestStayGuideDto, Error>;
}

export function useGuestStayGuide(propertySlug: string, token: string) {
  const override = usePreviewOverride();
  const hasOverride = override?.kind === 'stay-guide';

  const query = useQuery({
    queryKey: [...GUEST_STAY_GUIDE_QUERY_KEY, propertySlug, token],
    queryFn: () => fetchGuestStayGuide(propertySlug, token),
    enabled: !hasOverride && Boolean(propertySlug.trim() && token.trim()),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  if (hasOverride) {
    return stayGuideOverrideResult(override.data);
  }
  return query;
}

export function useGuestStayGuidePreview(propertySlug: string, propertyId: string) {
  const override = usePreviewOverride();
  const hasOverride = override?.kind === 'stay-guide';

  const query = useQuery({
    queryKey: [...GUEST_STAY_GUIDE_QUERY_KEY, 'preview', propertySlug, propertyId],
    queryFn: () => fetchGuestStayGuidePreview(propertySlug, propertyId),
    enabled: !hasOverride && Boolean(propertySlug.trim() && propertyId.trim()),
    staleTime: 1000 * 60 * 2,
    retry: false,
  });

  if (hasOverride) {
    return {
      data: override.data as GuestStayGuideDto | undefined,
      planAccessDenied: false,
      isLoading: false,
      isError: false,
      error: null as Error | null,
      isSuccess: true,
    };
  }

  const fetched = query.data;
  return {
    data: fetched?.status === 'ok' ? fetched.data : undefined,
    planAccessDenied: fetched?.status === 'planAccessDenied',
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
  };
}
