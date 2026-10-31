import { useEffect, useRef } from 'react';

import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import { NOTIFICATIONS_KEY } from '@/features/dashboard/notifications/hooks/useNotifications';
import type { NotificationRealtimeRow } from '@/features/dashboard/notifications/lib/notificationsApi';
import { showNotificationToast } from '@/features/dashboard/notifications/lib/notificationToast';

import { supabase } from '@/lib/supabase/client';

const REALTIME_INVALIDATE_MS = 400;

let invalidateTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleNotificationsInvalidate(qc: QueryClient) {
  if (invalidateTimer) clearTimeout(invalidateTimer);
  invalidateTimer = setTimeout(() => {
    invalidateTimer = null;
    void qc.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
  }, REALTIME_INVALIDATE_MS);
}

/**
 * One realtime channel per org — mount once (NotificationsProvider), never per-page.
 * In-app toast only; OS-level Notification popups stay inbox-chat-only (inboxNotifications.ts).
 */
export function useNotificationsRealtime(
  orgId: string | null,
  onNotification?: (row: NotificationRealtimeRow) => void
) {
  const qc = useQueryClient();
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  useEffect(() => {
    if (!orgId) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) return;

      await supabase.realtime.setAuth(token);

      channel = supabase
        .channel(`notifications-${orgId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `organization_id=eq.${orgId}`,
          },
          (payload) => {
            scheduleNotificationsInvalidate(qc);
            const row = payload.new as NotificationRealtimeRow;
            showNotificationToast(row, {
              onView: onNotificationRef.current,
              isCancelled: () => cancelled,
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `organization_id=eq.${orgId}`,
          },
          (payload) => {
            scheduleNotificationsInvalidate(qc);
            const row = payload.new as NotificationRealtimeRow;
            showNotificationToast(row, {
              onView: onNotificationRef.current,
              isCancelled: () => cancelled,
            });
          }
        )
        .subscribe();

      if (cancelled && channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.access_token || cancelled) return;
      void supabase.realtime.setAuth(session.access_token);
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [orgId, qc]);
}
