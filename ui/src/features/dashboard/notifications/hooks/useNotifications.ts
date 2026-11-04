import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import {
  fetchNotifications,
  type NotificationsPage,
} from '@/features/dashboard/notifications/lib/notificationsApi';
import { useNotificationsOrgScope } from '@/features/dashboard/notifications/lib/notificationsScope';
import { scopedOrgFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';

import { runOfflineMutation } from '@/lib/pwa/offlineMutation';
import { closeOsNotifications } from '@/lib/pwa/push';

export const NOTIFICATIONS_KEY = 'notifications';

/** Bell dropdown preview — server returns one extra row when more exist. */
export const NOTIFICATIONS_BELL_PREVIEW_LIMIT = 5;

export type NotificationsListMode = 'full' | 'preview';

export function notificationsQueryKey(
  orgSlug: string | null,
  orgId: string | null,
  mode: NotificationsListMode = 'full'
) {
  return [NOTIFICATIONS_KEY, orgSlug, orgId, mode] as const;
}

/**
 * Queues the mark-read when the device is offline (PWA v2 task 5.7). The server
 * endpoint is naturally idempotent and wrapped in `withIdempotency`, so a replay
 * after a flaky reconnect is safe.
 */
function markReadOfflineAware(
  qc: ReturnType<typeof useQueryClient>,
  orgSlug: string | null,
  orgId: string | null,
  body: { notificationId: string } | { markAll: true }
) {
  return runOfflineMutation<{ markedCount: number }>(
    {
      kind: 'notifications-mark-read',
      label: 'notificationId' in body ? 'Mark notification read' : 'Mark all read',
      url: scopedOrgFunctionsUrl('/notifications-mark-read', orgSlug, orgId),
      body,
      invalidateKeys: [NOTIFICATIONS_KEY],
    },
    qc
  );
}

function notificationsListLimit(mode: NotificationsListMode): number {
  return mode === 'preview' ? NOTIFICATIONS_BELL_PREVIEW_LIMIT : 20;
}

export function useNotificationsList(mode: NotificationsListMode = 'full') {
  const { orgSlug, orgId } = useNotificationsOrgScope();
  const limit = notificationsListLimit(mode);

  return useInfiniteQuery({
    queryKey: notificationsQueryKey(orgSlug, orgId, mode),
    queryFn: ({ pageParam }) => fetchNotifications(orgSlug, orgId, pageParam, limit),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (mode === 'preview' ? null : last.nextCursor),
    enabled: Boolean(orgSlug || orgId),
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const { orgSlug, orgId } = useNotificationsOrgScope();
  const queryKeyPrefix = [NOTIFICATIONS_KEY, orgSlug, orgId] as const;

  return useMutation({
    mutationFn: (notificationId: string) => {
      // The OS tray entry for this notification is done: clear it (6.4).
      void closeOsNotifications(notificationId);
      return markReadOfflineAware(qc, orgSlug, orgId, { notificationId });
    },
    onMutate: async (notificationId) => {
      await qc.cancelQueries({ queryKey: queryKeyPrefix });
      const prev = qc.getQueriesData<InfiniteData<NotificationsPage>>({
        queryKey: queryKeyPrefix,
      });

      qc.setQueriesData<InfiniteData<NotificationsPage>>({ queryKey: queryKeyPrefix }, (old) => {
        if (!old) return old;
        let wasUnread = false;
        const pages = old.pages.map((page) => ({
          ...page,
          notifications: page.notifications.map((n) => {
            if (n.id !== notificationId) return n;
            if (!n.isRead) wasUnread = true;
            return { ...n, isRead: true };
          }),
        }));
        return {
          ...old,
          pages: pages.map((page) => ({
            ...page,
            unreadCount: wasUnread ? Math.max(0, page.unreadCount - 1) : page.unreadCount,
          })),
        };
      });

      return { prev };
    },
    onError: (_err, _notificationId, ctx) => {
      if (!ctx?.prev) return;
      for (const [key, data] of ctx.prev) {
        qc.setQueryData(key, data);
      }
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeyPrefix }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const { orgSlug, orgId } = useNotificationsOrgScope();
  const queryKeyPrefix = [NOTIFICATIONS_KEY, orgSlug, orgId] as const;

  return useMutation({
    mutationFn: () => {
      void closeOsNotifications();
      return markReadOfflineAware(qc, orgSlug, orgId, { markAll: true });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queryKeyPrefix });
      const prev = qc.getQueriesData<InfiniteData<NotificationsPage>>({
        queryKey: queryKeyPrefix,
      });

      qc.setQueriesData<InfiniteData<NotificationsPage>>({ queryKey: queryKeyPrefix }, (old) => {
        if (!old) return old;
        const clearedSummary = { inbox: 0, bookings: 0, reviews: 0 };
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            notifications: page.notifications.map((n) => ({ ...n, isRead: true })),
            unreadCount: 0,
            unreadSummary: clearedSummary,
          })),
        };
      });

      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.prev) return;
      for (const [key, data] of ctx.prev) {
        qc.setQueryData(key, data);
      }
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeyPrefix }),
  });
}
