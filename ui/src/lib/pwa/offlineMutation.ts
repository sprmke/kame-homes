import { type QueryClient } from '@tanstack/react-query';

import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

import { outboxAdd } from '@/lib/pwa/outbox';
import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';
import { drainOutbox, refreshOutboxView } from '@/lib/pwa/syncEngine';

export type OfflineMutationSpec = {
  /** Domain label, e.g. `booking-transition`, `inbox-reply`. */
  kind: string;
  /** One-line description for the Sync Center. */
  label: string;
  /** Fully-resolved absolute edge-function URL (incl. any `?property_id=` scope). */
  url: string;
  body: unknown;
  /** Query-key roots to invalidate after the mutation lands (online or synced). */
  invalidateKeys: string[];
  /** Optimistic cache mutation to apply immediately when queued. */
  applyOptimistic?: (qc: QueryClient) => void;
};

export type OfflineMutationResult<T> = { queued: false; data: T } | { queued: true; data: null };

function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function looksOffline(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (err instanceof TypeError) return true; // fetch() network failure
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed');
}

/**
 * Run a mutation, falling back to the durable offline outbox when there's no
 * connection. A server-side rejection (validation, auth, conflict) is a real
 * error and is re-thrown — only connectivity failures queue.
 */
export async function runOfflineMutation<T>(
  spec: OfflineMutationSpec,
  qc: QueryClient
): Promise<OfflineMutationResult<T>> {
  const idempotencyKey = newIdempotencyKey();
  const bodyJson = JSON.stringify(spec.body);

  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const jwt = await getSessionJwt();
      const res = await fetch(spec.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: bodyJson,
      });
      const text = await res.text();
      let json: { success?: boolean; error?: string; data?: T } = {};
      try {
        json = text ? (JSON.parse(text) as typeof json) : {};
      } catch {
        // non-JSON body (e.g. a proxy 502 HTML page)
      }
      if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
      await Promise.all(spec.invalidateKeys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
      return { queued: false, data: json.data as T };
    } catch (err) {
      if (!looksOffline(err)) throw err;
      // fall through to queue
    }
  }

  await outboxAdd({
    kind: spec.kind,
    label: spec.label,
    url: spec.url,
    method: 'POST',
    headers: {},
    body: bodyJson,
    idempotencyKey,
    invalidateKeys: spec.invalidateKeys,
  });
  spec.applyOptimistic?.(qc);
  pwaTelemetry('offline-mutation-queued', { kind: spec.kind });
  await refreshOutboxView();
  void drainOutbox();
  return { queued: true, data: null };
}
