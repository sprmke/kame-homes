/**
 * Marketing media library hooks: the paged list, the usage meter, delete/restore, and the
 * upload queue. The queue is a module-level singleton so uploads keep running when the library
 * panel (or the editor rail section hosting it) unmounts.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  deleteMarketingMedia,
  fetchMarketingMediaPage,
  fetchMarketingMediaUsage,
  fetchMarketingMediaUsedIn,
  MarketingMediaApiError,
  restoreMarketingMedia,
} from '@/features/dashboard/marketing/lib/media/marketingMediaApi';
import type {
  MarketingMediaListFilter,
  MarketingMediaUsage,
} from '@/features/dashboard/marketing/lib/media/marketingMediaTypes';
import { runMarketingMediaUpload } from '@/features/dashboard/marketing/lib/media/uploadMarketingMedia';
import { UploadQueue } from '@/features/dashboard/marketing/lib/media/uploadQueue';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export const marketingMediaKeys = {
  all: (propertyId: string | null) => ['marketing-media', propertyId] as const,
  list: (propertyId: string | null, filter: MarketingMediaListFilter) =>
    ['marketing-media', propertyId, 'list', filter] as const,
  usage: (propertyId: string | null) => ['marketing-media', propertyId, 'usage'] as const,
};

function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && !(error instanceof MarketingMediaApiError && error.status < 500);
}

export function useMarketingMediaLibrary(filter: MarketingMediaListFilter, enabled = true) {
  const propertyId = usePropertyIdParam();
  return useInfiniteQuery({
    queryKey: marketingMediaKeys.list(propertyId, filter),
    queryFn: ({ pageParam, signal }) =>
      fetchMarketingMediaPage(propertyId!, filter, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: enabled && Boolean(propertyId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: shouldRetry,
  });
}

export function useMarketingMediaUsage(enabled = true) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: marketingMediaKeys.usage(propertyId),
    queryFn: ({ signal }) => fetchMarketingMediaUsage(propertyId!, signal),
    enabled: enabled && Boolean(propertyId),
    staleTime: 15_000,
    retry: shouldRetry,
  });
}

/** Designs using each of `ids`, for the delete confirmation. Off until `enabled`. */
export function useMarketingMediaUsedIn(ids: string[], enabled: boolean) {
  const propertyId = usePropertyIdParam();
  // The server scans saved designs per id, so it takes a few at a time; the first ones are enough to warn.
  ids = ids.slice(0, 10);
  const key = [...ids].sort().join(',');
  return useQuery({
    queryKey: [...marketingMediaKeys.all(propertyId), 'used-in', key] as const,
    queryFn: ({ signal }) => fetchMarketingMediaUsedIn(propertyId!, ids, signal),
    enabled: enabled && Boolean(propertyId) && ids.length > 0,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

function invalidateMedia(queryClient: QueryClient, propertyId: string | null) {
  return queryClient.invalidateQueries({ queryKey: marketingMediaKeys.all(propertyId) });
}

function useRestoreMarketingMedia() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => restoreMarketingMedia(propertyId!, ids),
    onSuccess: () => invalidateMedia(queryClient, propertyId),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not restore these files.');
    },
  });
}

export function useDeleteMarketingMedia() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const restore = useRestoreMarketingMedia();
  return useMutation({
    mutationFn: (ids: string[]) => deleteMarketingMedia(propertyId!, ids),
    onSuccess: (result, ids) => {
      void invalidateMedia(queryClient, propertyId);
      const count = result.deleted.length;
      if (count === 0) return;
      toast.success(count === 1 ? 'File deleted' : `${count} files deleted`, {
        action: { label: 'Undo', onClick: () => restore.mutate(ids) },
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not delete these files.');
    },
  });
}

// ─── Upload queue ───────────────────────────────────────────────────────────

let queryClientRef: QueryClient | null = null;

const uploadQueue = new UploadQueue({
  concurrency: 2,
  run: runMarketingMediaUpload,
  getUsage: async (propertyId, signal): Promise<MarketingMediaUsage> => {
    if (!queryClientRef) throw new Error('Media library is not ready');
    return queryClientRef.fetchQuery({
      queryKey: marketingMediaKeys.usage(propertyId),
      queryFn: () => fetchMarketingMediaUsage(propertyId, signal),
      staleTime: 4_000,
    });
  },
});

uploadQueue.onSettled((job) => {
  // Done (or deduped) changes the list and the meter; a failure can still have moved the meter.
  if (queryClientRef && job.status !== 'cancelled') {
    void invalidateMedia(queryClientRef, job.propertyId);
  } else if (queryClientRef) {
    void queryClientRef.invalidateQueries({ queryKey: marketingMediaKeys.usage(job.propertyId) });
  }
});export function useMarketingMediaUploads() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  useEffect(() => {
    queryClientRef = queryClient;
  }, [queryClient]);

  const all = useSyncExternalStore(uploadQueue.subscribe, uploadQueue.getSnapshot);
  const jobs = useMemo(() => all.filter((job) => job.propertyId === propertyId), [all, propertyId]);

  const enqueue = useCallback(
    (files: File[]) => (propertyId && files.length ? uploadQueue.enqueue(propertyId, files) : []),
    [propertyId]
  );

  return {
    jobs,
    activeCount: jobs.filter((job) => job.status === 'queued' || job.status === 'running').length,
    enqueue,
    cancel: useCallback((id: string) => uploadQueue.cancel(id), []),
    retry: useCallback((id: string) => uploadQueue.retry(id), []),
    dismiss: useCallback((id: string) => uploadQueue.dismiss(id), []),
    clearFinished: useCallback(
      () => uploadQueue.clearFinished(propertyId ?? undefined),
      [propertyId]
    ),
  };
}
