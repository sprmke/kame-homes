import { create } from 'zustand';

/**
 * Live view of the offline outbox for UI (banner, Sync Center). The outbox itself
 * is durable in IndexedDB (`@/lib/pwa/outbox`); this store is the in-memory
 * projection the sync engine keeps in sync. Phase 4 wires the engine to it.
 */

export type OutboxItemView = {
  id: string;
  kind: string;
  label: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'failed';
};

type OfflineSyncState = {
  items: OutboxItemView[];
  syncing: boolean;
  lastSyncedAt: number | null;
  /** Derived: count of items not in a terminal failed state. */
  pendingCount: number;
  failedCount: number;

  setItems: (items: OutboxItemView[]) => void;
  setSyncing: (syncing: boolean) => void;
  markSynced: () => void;
  reset: () => void;
};

function derive(items: OutboxItemView[]) {
  return {
    pendingCount: items.filter((i) => i.status === 'pending').length,
    failedCount: items.filter((i) => i.status === 'failed').length,
  };
}

export const useOfflineSyncStore = create<OfflineSyncState>((set) => ({
  items: [],
  syncing: false,
  lastSyncedAt: null,
  pendingCount: 0,
  failedCount: 0,

  setItems: (items) => set({ items, ...derive(items) }),
  setSyncing: (syncing) => set({ syncing }),
  markSynced: () => set({ lastSyncedAt: Date.now(), syncing: false }),
  reset: () => set({ items: [], pendingCount: 0, failedCount: 0, syncing: false }),
}));
