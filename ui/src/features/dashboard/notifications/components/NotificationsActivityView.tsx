import { useMemo, useState } from 'react';

import { InAppNotificationsPanel } from '@/features/dashboard/notifications/components/InAppNotificationsPanel';
import { PushNotificationsCard } from '@/features/dashboard/notifications/components/PushNotificationsCard';
import { useNotificationsOrgScope } from '@/features/dashboard/notifications/lib/notificationsScope';
import { SyncCenterCard } from '@/features/dashboard/offline/components/SyncCenterCard';
import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';

import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * In-app activity view of the Notifications hub — the feed owns the view's full
 * height and its scrollport, so there is one scrollbar and pagination runs as
 * the host scrolls. Device opt-in and the offline queue sit above it because
 * both are short and both change what the feed can reach the host with.
 */
export function NotificationsActivityView() {
  const { orgSlug } = useNotificationsOrgScope();
  const { data: propertiesData } = useProperties(orgSlug ?? undefined);
  const { data: parkingsData } = useParkings(orgSlug ?? undefined);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

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
        <PushNotificationsCard />
        <Card className="flex flex-auto flex-col overflow-hidden">
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
