const STORAGE_PREFIX = 'host-ann-read:v1';

const listeners = new Set<() => void>();
let revision = 0;

function storageKey(orgId: string): string {
  return `${STORAGE_PREFIX}:${orgId}`;
}

function emit(): void {
  revision += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeHostAnnouncementRead(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getHostAnnouncementReadRevision(): number {
  return revision;
}

function readRaw(orgId: string | null): string[] {
  if (!orgId || typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(orgId)) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  } catch {
    return [];
  }
}

export function readHostAnnouncementReadKeys(orgId: string | null): Set<string> {
  return new Set(readRaw(orgId));
}

export function markHostAnnouncementRead(orgId: string, identityKey: string): void {
  markHostAnnouncementsRead(orgId, [identityKey]);
}

/** Mark many announcements read in one write (e.g. Read all on a feed group). */
export function markHostAnnouncementsRead(orgId: string, identityKeys: readonly string[]): void {
  if (typeof localStorage === 'undefined' || identityKeys.length === 0) return;
  const next = new Set(readRaw(orgId));
  let changed = false;
  for (const key of identityKeys) {
    if (!key || next.has(key)) continue;
    next.add(key);
    changed = true;
  }
  if (!changed) return;
  localStorage.setItem(storageKey(orgId), JSON.stringify([...next]));
  emit();
}

/** Drop keys that no longer match any live announcement (housekeeping). */
export function pruneHostAnnouncementReadKeys(
  orgId: string | null,
  activeIdentityKeys: readonly string[]
): void {
  if (!orgId || typeof localStorage === 'undefined') return;
  const active = new Set(activeIdentityKeys);
  const previous = readRaw(orgId);
  const kept = previous.filter((key) => active.has(key));
  if (kept.length === previous.length) return;
  localStorage.setItem(storageKey(orgId), JSON.stringify(kept));
  emit();
}
