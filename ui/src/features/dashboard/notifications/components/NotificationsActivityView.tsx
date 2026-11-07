import { useMemo, useState } from 'react';

import { InAppNotificationsPanel } from '@/features/dashboard/notifications/components/InAppNotificationsPanel';
import { PushNotificationsRow } from '@/features/dashboard/notifications/components/PushNotificationsCard';
import {
  useMarkAllNotificationsRead,
  useNotificationsList,
} from '@/features/dashboard/notifications/hooks/useNotifications';
import { usePushNotifications } from '@/features/dashboard/notifications/hooks/usePushNotifications';
import { useNotificationsOrgScope } from '@/features/dashboard/notifications/lib/notificationsScope';
import { SyncCenterCard } from '@/features/dashboard/offline/components/SyncCenterCard';
import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';

import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * In-app activity view of the Notifications hub — the feed owns the view's full
 * height and its scrollport, so there is one scrollbar and pagination runs as
 * the host scrolls.
 *
 * Delivery settings (this device + push preferences) live in the header's
 * **Manage** sheet, so the list is the first thing a host sees on this tab.
 */
export function NotificationsActivityView() {
  const { orgSlug } = useNotificationsOrgScope();
  const { data: propertiesData } = useProperties(orgSlug ?? undefined);
  const { data: parkingsData } = useParkings(orgSlug ?? undefined);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  /* Same query the hub and the bell hold, so the unread count is already cached. */
  const { data: preview } = useNotificationsList('preview');
  const unreadCount = preview?.pages[0]?.unreadCount ?? 0;
  const markAllRead = useMarkAllNotificationsRead();
  const push = usePushNotifications();

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

  const pathScope = useMemo(
    () => ({ orgSlug, propertySlugById, parkingSlugById }),
    [orgSlug, propertySlugById, parkingSlugById]
  );

  return (
    <div
      ref={setScrollRoot}
      data-admin-content-scroll
      className={cn(
        'min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain',
        bottomTabBarOffsetClassName()
      )}
    >
      <div className="flex min-h-full w-full min-w-0 flex-col gap-3 sm:gap-4">
        <SyncCenterCard />
        {/* Fixed card, same as the Telegram tab: skeleton, then the live state. */}
        <PushNotificationsRow push={push} className="bg-card" />
        <Card className="flex flex-auto flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-2 pt-3 sm:px-4">
            <h2 className="text-card-title">Activity</h2>
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary h-8 px-2"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                Mark all as read
              </Button>
            ) : null}
          </div>
          <InAppNotificationsPanel
            mode="full"
            pathScope={pathScope}
            variant="feed"
            scrollRoot={scrollRoot}
            className="flex flex-auto flex-col"
          />
        </Card>
      </div>
    </div>
  );
}
