import { useOfflineSyncStore } from '@/features/dashboard/offline/store/offlineSyncStore';

/** Compact read model for the offline banner / More-tab badge. */
export function useOfflineSync() {
  const pendingCount = useOfflineSyncStore((s) => s.pendingCount);
  const failedCount = useOfflineSyncStore((s) => s.failedCount);
  const syncing = useOfflineSyncStore((s) => s.syncing);
  const lastSyncedAt = useOfflineSyncStore((s) => s.lastSyncedAt);
  return { pendingCount, failedCount, syncing, lastSyncedAt };
}
