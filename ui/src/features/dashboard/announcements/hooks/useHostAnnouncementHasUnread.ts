import { useMemo } from 'react';

import { useHostAnnouncementReadState } from '@/features/dashboard/announcements/hooks/useHostAnnouncementReadState';
import { useHostAnnouncements } from '@/features/dashboard/announcements/hooks/useHostAnnouncements';
import { hostAnnouncementIdentityKey } from '@/features/dashboard/announcements/lib/hostAnnouncementPresentation';
import { useHasHostAnnouncementsArchiveScope } from '@/features/dashboard/announcements/lib/hostAnnouncementsPaths';
import { useNotificationsOrgScope } from '@/features/dashboard/notifications/lib/notificationsScope';

/** True when any active announcement is unread — drives sidebar / More red dots. */
export function useHostAnnouncementHasUnread(): boolean {
  const hasArchive = useHasHostAnnouncementsArchiveScope();
  const { orgId } = useNotificationsOrgScope();
  const { announcements, isLoading, isError } = useHostAnnouncements();

  const activeIdentityKeys = useMemo(
    () => announcements.map((entry) => hostAnnouncementIdentityKey(entry)),
    [announcements]
  );

  const { hasUnread } = useHostAnnouncementReadState(orgId, activeIdentityKeys);

  if (!hasArchive || isLoading || isError) return false;
  return hasUnread;
}
