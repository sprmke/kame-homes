/**
 * "Updated 2h ago" for persisted views when the network is down.
 *
 * Offline reads come from the TanStack Query persister, so the screen can look
 * current while the data is hours old. This label says how old, without turning
 * the page into an error state.
 */

export type StaleAge = { unit: 'just-now' | 'minutes' | 'hours' | 'days'; value: number };

/** Bucket an age in ms. Pure so the copy and the thresholds are testable. */
export function staleAge(updatedAt: number, now: number = Date.now()): StaleAge | null {
  if (!updatedAt || !Number.isFinite(updatedAt)) return null;
  const diff = now - updatedAt;
  if (diff < 0) return { unit: 'just-now', value: 0 };
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return { unit: 'just-now', value: 0 };
  if (minutes < 60) return { unit: 'minutes', value: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: 'hours', value: hours };
  return { unit: 'days', value: Math.floor(hours / 24) };
}

/** Short label. One sentence, no filler. */
export function formatStaleAge(updatedAt: number, now: number = Date.now()): string | null {
  const age = staleAge(updatedAt, now);
  if (!age) return null;
  switch (age.unit) {
    case 'just-now':
      return 'Updated just now';
    case 'minutes':
      return `Updated ${age.value}m ago`;
    case 'hours':
      return `Updated ${age.value}h ago`;
    case 'days':
      return `Updated ${age.value}d ago`;
  }
}
