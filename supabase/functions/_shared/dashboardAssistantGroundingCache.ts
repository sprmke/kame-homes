/**
 * 60-second per-isolate cache for `buildHostSafeGroundingFacts`.
 *
 * Grounding facts are identical across turns in the same isolate until a write lands, so a host
 * who asks three follow-ups should not pay the same org/property/finance preload three times.
 * Invalidated after any committed write in the turn (Tier-1 commit, not a still-pending proposal).
 */

const TTL_MS = 60_000;

type CacheEntry<T> = { value: T; expiresAt: number };

const cache = new Map<string, CacheEntry<unknown>>();

export function groundingCacheKey(
  organizationId: string,
  userId: string,
  propertyId: string | null | undefined,
  permissions: readonly string[]
): string {
  const perms = [...permissions].sort().join(',');
  return `${organizationId}:${userId}:${propertyId ?? ''}:${perms}`;
}

export async function getCachedGroundingFacts<T>(
  key: string,
  load: () => Promise<T>,
  now: () => number = Date.now
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now()) return hit.value as T;
  const value = await load();
  cache.set(key, { value, expiresAt: now() + TTL_MS });
  return value;
}

export function invalidateGroundingCache(organizationId?: string): void {
  if (!organizationId) {
    cache.clear();
    return;
  }
  const prefix = `${organizationId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** Test-only. */
export function resetGroundingCacheForTests(): void {
  cache.clear();
}
