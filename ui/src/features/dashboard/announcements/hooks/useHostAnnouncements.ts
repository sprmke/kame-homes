import { useMemo } from 'react';

import { useLocation } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import type { HostAnnouncement } from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';
import { isSuperAdminPath } from '@/features/dashboard/bookings/lib/adminSidebarNav';
import { useNotificationsOrgScope } from '@/features/dashboard/notifications/lib/notificationsScope';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export const HOST_ANNOUNCEMENTS_QUERY_KEY = ['host-announcements'] as const;

export function useHostAnnouncements() {
  const location = useLocation();
  const { orgId } = useNotificationsOrgScope();
  const orgContext = useOptionalOrgContext();
  const parkingContext = useOptionalParkingContext();
  const enabled =
    Boolean(orgId) &&
    !isSuperAdminPath(location.pathname) &&
    !location.pathname.startsWith('/onboarding');

  const propertyId = orgContext?.property.id ?? null;
  const parkingId = parkingContext?.parking.id ?? null;

  const query = useQuery({
    queryKey: [...HOST_ANNOUNCEMENTS_QUERY_KEY, orgId, propertyId, parkingId] as const,
    enabled,
    queryFn: () => {
      const search = new URLSearchParams({ orgId: orgId! });
      if (propertyId) search.set('propertyId', propertyId);
      if (parkingId) search.set('parkingId', parkingId);
      return callEdgeFunction<{ announcements: HostAnnouncement[] }>(
        `list-host-announcements?${search.toString()}`
      ).then((data) => data.announcements);
    },
    staleTime: 60_000,
  });

  const announcements = useMemo(() => query.data ?? [], [query.data]);

  return {
    announcements,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
