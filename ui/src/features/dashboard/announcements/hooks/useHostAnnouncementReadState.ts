import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import {
  getHostAnnouncementReadRevision,
  markHostAnnouncementRead,
  markHostAnnouncementsRead,
  pruneHostAnnouncementReadKeys,
  readHostAnnouncementReadKeys,
  subscribeHostAnnouncementRead,
} from '@/features/dashboard/announcements/lib/hostAnnouncementReadState';

export function useHostAnnouncementReadState(
  orgId: string | null,
  activeIdentityKeys: readonly string[]
) {
  useEffect(() => {
    pruneHostAnnouncementReadKeys(orgId, activeIdentityKeys);
  }, [orgId, activeIdentityKeys]);

  const storeRevision = useSyncExternalStore(
    subscribeHostAnnouncementRead,
    getHostAnnouncementReadRevision,
    () => 0
  );

  const readKeys = useMemo(
    () => readHostAnnouncementReadKeys(orgId),
    // storeRevision: re-read after mark/prune
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional store revision
    [orgId, storeRevision]
  );

  const isUnread = useCallback((identityKey: string) => !readKeys.has(identityKey), [readKeys]);

  const markRead = useCallback(
    (identityKey: string) => {
      if (!orgId) return;
      markHostAnnouncementRead(orgId, identityKey);
    },
    [orgId]
  );

  const markAllRead = useCallback(
    (identityKeys: readonly string[]) => {
      if (!orgId) return;
      markHostAnnouncementsRead(orgId, identityKeys);
    },
    [orgId]
  );

  const unreadCount = useMemo(
    () => activeIdentityKeys.filter((key) => !readKeys.has(key)).length,
    [activeIdentityKeys, readKeys]
  );

  return { readKeys, isUnread, markRead, markAllRead, unreadCount, hasUnread: unreadCount > 0 };
}
