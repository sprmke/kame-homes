import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';
import {
  hasUpgradeModalOpener,
  openUpgradeModalFromBridge,
} from '@/features/dashboard/plans/lib/upgradeModalBridge';
import {
  addCalendarFeed,
  CALENDAR_SYNC_QUERY_KEY,
  fetchCalendarSyncSettings,
  removeCalendarFeed,
  setExportEnabled,
  syncFeedNow,
  updateCalendarFeed,
  type CalendarFeedProvider,
  type CalendarSyncClientError,
  type FeedSyncResult,
} from '@/features/dashboard/pricing/lib/calendarSyncApi';
import { PROPERTY_PRICING_QUERY_KEY } from '@/features/dashboard/pricing/lib/propertyPricingApi';
import { handleFeatureUnavailableMutationError } from '@/lib/featureAvailability/featureUnavailableError';

function toastSyncResult(r: FeedSyncResult): void {
  if (!r.ok) {
    toast.error(`Sync failed: ${r.error ?? 'unknown error'}`);
    return;
  }
  if (r.status === 'not_modified' || r.status === 'unchanged' || r.status === 'skipped') {
    toast.success('Already up to date');
    return;
  }
  toast.success(
    `Synced: ${r.blocksCreated} added, ${r.blocksUpdated} changed, ${r.blocksRemoved} removed` +
      (r.conflicts ? `, ${r.conflicts} conflict(s)` : '')
  );
}

function handleCalendarSyncError(
  error: Error,
  fallback: string,
  queryClient: ReturnType<typeof useQueryClient>
): void {
  if (handleFeatureUnavailableMutationError(error, queryClient)) return;
  const err = error as CalendarSyncClientError;
  if (err.upgradeRequired) {
    const feature: PlanFeatureKey = err.feature ?? 'calendarSync';
    if (hasUpgradeModalOpener()) openUpgradeModalFromBridge(feature);
    toast.error(err.message || fallback);
    return;
  }
  toast.error(error.message || fallback);
}

export function useCalendarSyncSettings(options?: { enabled?: boolean }) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: [CALENDAR_SYNC_QUERY_KEY, propertyId],
    queryFn: () => fetchCalendarSyncSettings(propertyId!),
    enabled: !!propertyId && (options?.enabled ?? true),
    staleTime: 20_000,
  });
}

function useInvalidateCalendarSync() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [CALENDAR_SYNC_QUERY_KEY, propertyId] });
    void queryClient.invalidateQueries({ queryKey: [PROPERTY_PRICING_QUERY_KEY, propertyId] });
  };
}

export function useAddCalendarFeed() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCalendarSync();
  return useMutation({
    mutationFn: (input: { provider: CalendarFeedProvider; label?: string; icsUrl: string }) =>
      addCalendarFeed(propertyId!, input),
    onSuccess: (data) => {
      invalidate();
      const sync = data.initialSync;
      if (!sync) {
        toast.success('Calendar connected');
        return;
      }
      if (!sync.ok) {
        toast.error(`Connected, but first sync failed: ${sync.error ?? 'unknown error'}`);
        return;
      }
      if (
        sync.status === 'not_modified' ||
        sync.status === 'unchanged' ||
        sync.status === 'skipped'
      ) {
        toast.success('Calendar connected');
        return;
      }
      toast.success(
        `Calendar connected: ${sync.blocksCreated} imported` +
          (sync.conflicts ? `, ${sync.conflicts} conflict(s)` : '')
      );
    },
    onError: (error: Error) =>
      handleCalendarSyncError(error, 'Could not connect calendar', queryClient),
  });
}

export function useUpdateCalendarFeed() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCalendarSync();
  return useMutation({
    mutationFn: (input: { feedId: string; label?: string; icsUrl?: string; isActive?: boolean }) =>
      updateCalendarFeed(propertyId!, input),
    onSuccess: () => {
      invalidate();
      toast.success('Calendar updated');
    },
    onError: (error: Error) =>
      handleCalendarSyncError(error, 'Could not update calendar', queryClient),
  });
}

export function useRemoveCalendarFeed() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCalendarSync();
  return useMutation({
    mutationFn: (input: { feedId: string; deleteData: boolean }) =>
      removeCalendarFeed(propertyId!, input.feedId, input.deleteData),
    onSuccess: () => {
      invalidate();
      toast.success('Calendar removed');
    },
    onError: (error: Error) =>
      handleCalendarSyncError(error, 'Could not remove calendar', queryClient),
  });
}

export function useSetExportEnabled() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCalendarSync();
  return useMutation({
    mutationFn: (enabled: boolean) => setExportEnabled(propertyId!, enabled),
    onSuccess: () => invalidate(),
    onError: (error: Error) =>
      handleCalendarSyncError(error, 'Could not update export', queryClient),
  });
}

export function useSyncFeedNow() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCalendarSync();
  return useMutation({
    mutationFn: (feedId: string) => syncFeedNow(propertyId!, feedId),
    onSuccess: (data) => {
      invalidate();
      toastSyncResult(data.result);
    },
    onError: (error: Error) => handleCalendarSyncError(error, 'Sync failed', queryClient),
  });
}
