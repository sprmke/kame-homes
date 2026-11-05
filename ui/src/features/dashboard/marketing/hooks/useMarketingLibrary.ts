import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  deleteMarketingTemplates,
  duplicateMarketingTemplate,
  fetchMarketingLibraryPage,
  fetchMarketingTemplate,
  fetchMarketingTemplateUsage,
  invalidateMarketingLibrary,
  isMarketingDeletedError,
  MarketingApiError,
  marketingTemplateKeys,
  restoreMarketingTemplates,
  updateMarketingTemplate,
  type DuplicateMarketingTemplatePayload,
  type MarketingContentType,
  type MarketingLibraryFilters,
  type MarketingTemplateRecord,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

/** One Library list (designs or templates), infinite scroll, one card per size group. */
export function useMarketingLibrary(filters: MarketingLibraryFilters, enabled = true) {
  const propertyId = usePropertyIdParam();
  return useInfiniteQuery({
    queryKey: marketingTemplateKeys.libraryPage(propertyId, filters),
    queryFn: ({ pageParam }) => fetchMarketingLibraryPage(propertyId, filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    // Typing in search / switching filters keeps the old grid until the new page lands.
    placeholderData: keepPreviousData,
    retry: (failureCount, error) =>
      failureCount < 2 && !(error instanceof MarketingApiError && error.status < 500),
  });
}

export function useMarketingTemplateUsage(
  contentType: MarketingContentType,
  themeKey: string | null,
  enabled = true
) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: marketingTemplateKeys.usage(propertyId, contentType, themeKey),
    queryFn: () => fetchMarketingTemplateUsage(propertyId, contentType, themeKey),
    enabled,
    staleTime: 30_000,
  });
}

/** One saved design (full design_json) for the editor. */
export function useMarketingItem(id: string | null) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: marketingTemplateKeys.item(propertyId, id ?? 'none'),
    queryFn: () => fetchMarketingTemplate(propertyId, id!),
    enabled: Boolean(id),
    // The editor owns the document once loaded: never refetch it under the host.
    staleTime: Infinity,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Gone (410) or missing (404) will not come back on retry.
    retry: (failureCount, error) =>
      failureCount < 2 &&
      !isMarketingDeletedError(error) &&
      !(error instanceof MarketingApiError && error.status === 404),
  });
}

/** Warm the item cache on card hover so opening the editor skips a round trip. */
export function usePrefetchMarketingItem() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  return (id: string) =>
    void queryClient.prefetchQuery({
      queryKey: marketingTemplateKeys.item(propertyId, id),
      queryFn: () => fetchMarketingTemplate(propertyId, id),
      staleTime: 30_000,
    });
}

export function useDuplicateMarketingItem() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DuplicateMarketingTemplatePayload) =>
      duplicateMarketingTemplate(propertyId, payload),
    onSuccess: (record: MarketingTemplateRecord) => {
      queryClient.setQueryData(marketingTemplateKeys.item(propertyId, record.id), record);
      invalidateMarketingLibrary(queryClient, propertyId);
    },
    onError: (error: Error) => toast.error(error.message || 'Could not copy that'),
  });
}

export function useRenameMarketingItem() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, name }: { ids: string[]; name: string }) =>
      Promise.all(ids.map((id) => updateMarketingTemplate(propertyId, { id, name }))),
    onSuccess: (records) => {
      for (const record of records) {
        queryClient.setQueryData<MarketingTemplateRecord>(
          marketingTemplateKeys.item(propertyId, record.id),
          (current) => (current ? { ...current, name: record.name } : current)
        );
      }
      invalidateMarketingLibrary(queryClient, propertyId);
    },
    onError: (error: Error) => toast.error(error.message || 'Could not rename'),
  });
}

/**
 * Moves items to Recently deleted with an Undo toast. `permanent` deletes for good
 * (only offered inside Recently deleted).
 */
export function useDeleteMarketingItems() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, permanent }: { ids: string[]; permanent?: boolean; label?: string }) =>
      deleteMarketingTemplates(propertyId, ids, { permanent }),
    onSuccess: (deletedIds, variables) => {
      invalidateMarketingLibrary(queryClient, propertyId);
      for (const id of deletedIds) {
        queryClient.removeQueries({ queryKey: marketingTemplateKeys.item(propertyId, id) });
      }
      if (variables.permanent) {
        toast.success(deletedIds.length > 1 ? `Deleted ${deletedIds.length} items` : 'Deleted');
        return;
      }
      toast.success(
        variables.label ??
          (deletedIds.length > 1
            ? `Moved ${deletedIds.length} items to Recently deleted`
            : 'Moved to Recently deleted'),
        {
          action: {
            label: 'Undo',
            onClick: () => {
              void restoreMarketingTemplates(propertyId, deletedIds)
                .then(() => invalidateMarketingLibrary(queryClient, propertyId))
                .catch(() => toast.error('Could not undo'));
            },
          },
        }
      );
    },
    onError: (error: Error) => toast.error(error.message || 'Could not delete'),
  });
}

export function useRestoreMarketingItems() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => restoreMarketingTemplates(propertyId, ids),
    onSuccess: (restored) => {
      invalidateMarketingLibrary(queryClient, propertyId);
      toast.success(restored.length > 1 ? `Restored ${restored.length} items` : 'Restored');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not restore'),
  });
}
