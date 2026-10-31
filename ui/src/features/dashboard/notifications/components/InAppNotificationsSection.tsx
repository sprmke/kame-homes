import { useMemo } from 'react';

import { Bell } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { InAppNotificationsPanel } from '@/features/dashboard/notifications/components/InAppNotificationsPanel';
import { PushNotificationsCard } from '@/features/dashboard/notifications/components/PushNotificationsCard';
import {
  useMarkAllNotificationsRead,
  useNotificationsList,
} from '@/features/dashboard/notifications/hooks/useNotifications';
import { IN_APP_NOTIFICATIONS_SECTION_ID } from '@/features/dashboard/notifications/lib/notificationsPaths';
import { useNotificationsOrgScope } from '@/features/dashboard/notifications/lib/notificationsScope';
import { SyncCenterCard } from '@/features/dashboard/offline/components/SyncCenterCard';
import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';

export function InAppNotificationsSection() {
  const { orgSlug } = useNotificationsOrgScope();
  const { data: propertiesData } = useProperties(orgSlug ?? undefined);
  const { data: parkingsData } = useParkings(orgSlug ?? undefined);
  const { data } = useNotificationsList('full');
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = data?.pages[0]?.unreadCount ?? 0;

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
    <div className="space-y-3 sm:space-y-4">
      <SyncCenterCard />
      <PushNotificationsCard />
      <AdminSection
        id={IN_APP_NOTIFICATIONS_SECTION_ID}
        title="Activity"
        icon={Bell}
        headerAction={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-primary text-xs font-semibold hover:underline disabled:opacity-50"
            >
              Mark all as read
            </button>
          ) : null
        }
      >
        <InAppNotificationsPanel mode="full" pathScope={pathScope} variant="feed" />
      </AdminSection>
    </div>
  );
}
