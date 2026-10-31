import { useEffect, useMemo } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

import { useActivityRealtime } from '@/features/dashboard/activity/hooks/useActivityRealtime';
import { useNotificationsList } from '@/features/dashboard/notifications/hooks/useNotifications';
import { useNotificationsRealtime } from '@/features/dashboard/notifications/hooks/useNotificationsRealtime';
import { resolveNotificationPath } from '@/features/dashboard/notifications/lib/notificationsPaths';
import { useNotificationsOrgScope } from '@/features/dashboard/notifications/lib/notificationsScope';
import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';
import {
  getLastParkingSlug,
  getLastPropertySlug,
  getLastTenantKind,
  parkingSectionPath,
  propertySectionPath,
} from '@/features/dashboard/org/lib/tenantPaths';

import { getPwaCapabilities } from '@/lib/pwa/capabilities';
import { resyncPushSubscription } from '@/lib/pwa/push';

import { SW_MESSAGE } from '@/pwa/shared';

/**
 * Mounts the org-wide notifications realtime channel — no UI of its own.
 * Also owns the PWA glue for notifications: OS-push subscription healing,
 * push-notification click navigation, and the app icon unread badge.
 *
 * Mount exactly once per admin session (AdminLayout), never per-page.
 */
export function NotificationsProvider() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { orgSlug, orgId } = useNotificationsOrgScope();

  // Cached by RequireOrgContext/SidebarTenantScope already mounted alongside —
  // this hits the TanStack Query cache rather than firing a fresh request.
  const { data: propertiesData } = useProperties(orgSlug ?? undefined);
  const { data: parkingsData } = useParkings(orgSlug ?? undefined);
  const { data: bellData } = useNotificationsList('preview');

  const propertySlugById = useMemo(() => {
    const map = new Map<string, string>();
    for (const property of propertiesData?.properties ?? []) map.set(property.id, property.slug);
    return map;
  }, [propertiesData]);

  const parkingSlugById = useMemo(() => {
    const map = new Map<string, string>();
    for (const parking of parkingsData?.parkings ?? []) map.set(parking.id, parking.slug);
    return map;
  }, [parkingsData]);

  useNotificationsRealtime(orgId, (row) => {
    const path = resolveNotificationPath(row, { orgSlug, propertySlugById, parkingSlugById });
    if (path) navigate(path);
  });

  // Org-wide activity feed live-refresh — same "mount once" rule as above.
  useActivityRealtime(orgId);

  // App icon unread badge (Chromium installed + iOS 16.4+ installed).
  const unreadCount = bellData?.pages[0]?.unreadCount ?? 0;
  useEffect(() => {
    if (!getPwaCapabilities().badging) return;
    try {
      if (unreadCount > 0) void navigator.setAppBadge?.(unreadCount);
      else void navigator.clearAppBadge?.();
    } catch {
      // Safari can throw in some contexts — non-fatal.
    }
  }, [unreadCount]);

  // Heal a rotated / server-pruned push subscription on session start.
  useEffect(() => {
    void resyncPushSubscription();
  }, []);

  // Push subscription rotated by the browser → re-register with the server.
  // (Notification-click navigation + cache revalidation are handled app-wide in
  // <PwaProvider> so they work on any surface.)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string })?.type === SW_MESSAGE.PUSH_RESYNC) {
        void resyncPushSubscription();
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  // App-shortcut deep links (`start_url` lands here after the tenant redirect).
  useEffect(() => {
    const shortcut = searchParams.get('shortcut');
    if (!shortcut || !orgSlug) return;
    const kind = getLastTenantKind();
    let target: string | null = null;
    if (kind === 'parking') {
      const slug = getLastParkingSlug();
      if (slug)
        target = parkingSectionPath(orgSlug, slug, shortcut === 'inbox' ? 'inbox' : 'bookings');
    } else {
      const slug = getLastPropertySlug();
      if (slug) {
        target = propertySectionPath(orgSlug, slug, shortcut === 'inbox' ? 'inbox' : 'bookings');
      }
    }
    const next = new URLSearchParams(searchParams);
    next.delete('shortcut');
    next.delete('source');
    setSearchParams(next, { replace: true });
    if (target) navigate(target);
    // Run once per shortcut value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('shortcut'), orgSlug]);

  return null;
}
