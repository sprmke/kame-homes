import { useEffect, useRef } from 'react';

import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import { NOTIFICATIONS_KEY } from '@/features/dashboard/notifications/hooks/useNotifications';
import type { NotificationRealtimeRow } from '@/features/dashboard/notifications/lib/notificationsApi';
import { showNotificationToast } from '@/features/dashboard/notifications/lib/notificationToast';
import { shouldShowCalendarConflictRealtimeToast } from '@/features/dashboard/pricing/lib/calendarConflictToastGate';

import { supabase } from '@/lib/supabase/client';

function shouldToastRealtimeRow(row: NotificationRealtimeRow): boolean {
  if (row.type === 'calendar_conflict') return shouldShowCalendarConflictRealtimeToast();
  return true;
}

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
 * In-app toast only. OS-level notifications come from the push pipeline
 * (`push-fanout` → service worker), so a message never produces two banners.
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
        // One binding for INSERT + UPDATE. Two separate bindings create two
        // Realtime subscriptions, and every subscription is polled against
        // Postgres WAL independently. Both handlers did the same work, so this
        // halves the Realtime query load for notifications.
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `organization_id=eq.${orgId}`,
          },
          (payload) => {
            if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return;
            scheduleNotificationsInvalidate(qc);
            const row = payload.new as NotificationRealtimeRow;
            if (!shouldToastRealtimeRow(row)) return;
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
