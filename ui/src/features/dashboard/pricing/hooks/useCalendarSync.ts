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
import { suppressCalendarConflictRealtimeToasts } from '@/features/dashboard/pricing/lib/calendarConflictToastGate';
import { PROPERTY_PRICING_QUERY_KEY } from '@/features/dashboard/pricing/lib/propertyPricingApi';
import { handleFeatureUnavailableMutationError } from '@/lib/featureAvailability/featureUnavailableError';

function conflictLabel(count: number): string {
  return count === 1 ? '1 conflict' : `${count} conflicts`;
}

function toastSyncResult(r: FeedSyncResult): void {
  if (!r.ok) {
    toast.error(`Sync failed: ${r.error ?? 'unknown error'}`);
    return;
  }
  if (r.status === 'not_modified' || r.status === 'unchanged' || r.status === 'skipped') {
    toast.success('Already up to date');
    return;
  }
  const summary = `${r.blocksCreated} added, ${r.blocksUpdated} changed, ${r.blocksRemoved} removed`;
  const bookingBits: string[] = [];
  if (r.bookingsCreated) bookingBits.push(`${r.bookingsCreated} created`);
  if (r.bookingsUpdated) bookingBits.push(`${r.bookingsUpdated} updated`);
  if (r.bookingsCancelled) bookingBits.push(`${r.bookingsCancelled} cancelled`);
  if (r.bookingsLinked) bookingBits.push(`${r.bookingsLinked} linked`);
  const bookings = bookingBits.length > 0 ? `, bookings: ${bookingBits.join(', ')}` : '';
  if (r.conflicts > 0) {
    suppressCalendarConflictRealtimeToasts();
    toast.warning(
      `Synced: ${summary}${bookings}. ${conflictLabel(r.conflicts)}. Check Notifications or Recent activity.`
    );
    return;
  }
  toast.success(`Synced: ${summary}${bookings}`);
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
    onMutate: () => {
      // Cover the race where conflict notifications arrive over realtime before onSuccess.
      suppressCalendarConflictRealtimeToasts();
    },
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
      if (sync.conflicts > 0) {
        suppressCalendarConflictRealtimeToasts();
        toast.warning(
          `Calendar connected: ${sync.blocksCreated} dates imported. ${conflictLabel(sync.conflicts)}. Check Notifications or Recent activity.`
        );
        return;
      }
      const bookings = sync.bookingsCreated > 0 ? `, ${sync.bookingsCreated} bookings created` : '';
      toast.success(`Calendar connected: ${sync.blocksCreated} dates imported${bookings}`);
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
    mutationFn: (input: {
      feedId: string;
      label?: string;
      icsUrl?: string;
      isActive?: boolean;
      createBookings?: boolean;
    }) => updateCalendarFeed(propertyId!, input),
    onSuccess: () => {
      invalidate();
      toast.success('Calendar updated');
    },
    onError: (error: Error) =>
      handleCalendarSyncError(error, 'Could not update calendar', queryClient),
  });
}

/** Turn OTA reservation ingestion on or off for one feed. Enabling runs a sync now. */
export function useSetCreateBookings() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCalendarSync();
  return useMutation({
    mutationFn: (input: { feedId: string; enabled: boolean }) =>
      updateCalendarFeed(propertyId!, { feedId: input.feedId, createBookings: input.enabled }),
    onSuccess: (data, variables) => {
      invalidate();
      if (!variables.enabled) {
        toast.success('Airbnb stays will stop creating bookings');
        return;
      }
      const sync = data.sync;
      if (sync?.ok && sync.bookingsCreated > 0) {
        toast.success(`${sync.bookingsCreated} Airbnb bookings imported`);
        return;
      }
      if (sync?.ok && sync.bookingsLinked > 0) {
        toast.success(`${sync.bookingsLinked} Airbnb bookings linked`);
        return;
      }
      toast.success('Airbnb bookings on');
    },
    onError: (error: Error) =>
      handleCalendarSyncError(error, 'Could not update Airbnb bookings', queryClient),
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
    onMutate: () => {
      suppressCalendarConflictRealtimeToasts();
    },
    onSuccess: (data) => {
      invalidate();
      toastSyncResult(data.result);
    },
    onError: (error: Error) => handleCalendarSyncError(error, 'Sync failed', queryClient),
  });
}
