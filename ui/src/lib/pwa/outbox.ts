import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

import { OUTBOX_DB_NAME } from '@/pwa/shared';

/**
 * Durable queue of mutations made while offline (or that failed the network).
 * The sync engine (`syncEngine.ts`) drains it FIFO when connectivity returns.
 */
export type OutboxItem = {
  id: string;
  /** Domain label for UI + query invalidation, e.g. `booking-transition`. */
  kind: string;
  /** Human-readable one-liner for the Sync Center. */
  label: string;
  url: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Headers minus Authorization — a fresh token is attached at send time. */
  headers: Record<string, string>;
  body: string;
  idempotencyKey: string;
  /** TanStack Query keys (roots) to invalidate once this item lands. */
  invalidateKeys: string[];
  createdAt: number;
  attempts: number;
  status: 'pending' | 'failed';
  lastError?: string;
};

interface OutboxDB extends DBSchema {
  mutations: {
    key: string;
    value: OutboxItem;
    indexes: { 'by-createdAt': number };
  };
}

let dbPromise: Promise<IDBPDatabase<OutboxDB>> | null = null;

function db(): Promise<IDBPDatabase<OutboxDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OutboxDB>(OUTBOX_DB_NAME, 1, {
      upgrade(database) {
        const store = database.createObjectStore('mutations', { keyPath: 'id' });
        store.createIndex('by-createdAt', 'createdAt');
      },
    });
  }
  return dbPromise;
}

export async function outboxAdd(
  item: Omit<OutboxItem, 'id' | 'createdAt' | 'attempts' | 'status'>
): Promise<OutboxItem> {
  const full: OutboxItem = {
    ...item,
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending',
  };
  await (await db()).put('mutations', full);
  return full;
}

export async function outboxList(): Promise<OutboxItem[]> {
  const all = await (await db()).getAllFromIndex('mutations', 'by-createdAt');
  return all;
}

export async function outboxRemove(id: string): Promise<void> {
  await (await db()).delete('mutations', id);
}

export async function outboxUpdate(id: string, patch: Partial<OutboxItem>): Promise<void> {
  const database = await db();
  const existing = await database.get('mutations', id);
  if (!existing) return;
  await database.put('mutations', { ...existing, ...patch });
}

export async function outboxClear(): Promise<void> {
  await (await db()).clear('mutations');
}

export async function outboxCount(): Promise<number> {
  return (await db()).count('mutations');
}
