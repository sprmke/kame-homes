/**
 * Session-scoped old→new slug map after org / property / parking rename.
 * Browser history still holds prior URLs with the old slug; Back would otherwise
 * land on a dead path and show "No property access". Rewriting with replace
 * keeps the user on the same section under the new slug.
 */

export type TenantSlugKind = 'org' | 'property' | 'parking';

type RemapStore = Record<TenantSlugKind, Record<string, string>>;

const STORAGE_KEY = 'kame-tenant-slug-remap';

let memoryStore: RemapStore = { org: {}, property: {}, parking: {} };
let hydratedFromSession = false;

function emptyStore(): RemapStore {
  return { org: {}, property: {}, parking: {} };
}

function cloneStore(store: RemapStore): RemapStore {
  return {
    org: { ...store.org },
    property: { ...store.property },
    parking: { ...store.parking },
  };
}

function hydrateFromSessionStorage(): void {
  if (hydratedFromSession || typeof window === 'undefined') return;
  hydratedFromSession = true;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<RemapStore>;
    memoryStore = {
      org: parsed.org && typeof parsed.org === 'object' ? { ...parsed.org } : {},
      property:
        parsed.property && typeof parsed.property === 'object' ? { ...parsed.property } : {},
      parking: parsed.parking && typeof parsed.parking === 'object' ? { ...parsed.parking } : {},
    };
  } catch {
    // Ignore corrupt / private-mode failures; remap is best-effort UX.
  }
}

function readStore(): RemapStore {
  hydrateFromSessionStorage();
  return cloneStore(memoryStore);
}

function writeStore(store: RemapStore): void {
  memoryStore = cloneStore(store);
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
  } catch {
    // Ignore quota / private-mode failures; in-memory map still works this tab.
  }
}

/** Record that `from` was renamed to `to`. Chains prior aliases to the latest slug. */
export function rememberTenantSlugChange(kind: TenantSlugKind, from: string, to: string): void {
  const oldSlug = from.trim();
  const newSlug = to.trim();
  if (!oldSlug || !newSlug || oldSlug === newSlug) return;

  const store = readStore();
  const map = { ...store[kind] };
  map[oldSlug] = newSlug;
  for (const [alias, current] of Object.entries(map)) {
    if (current === oldSlug) {
      map[alias] = newSlug;
    }
  }
  writeStore({ ...store, [kind]: map });
}

/** Follow remap chain; returns `slug` unchanged when unknown. */
export function resolveRemappedSlug(kind: TenantSlugKind, slug: string): string {
  const map = readStore()[kind];
  let current = slug;
  const seen = new Set<string>();
  while (map[current] && !seen.has(current)) {
    seen.add(current);
    current = map[current]!;
  }
  return current;
}

/**
 * If pathname is an `/org/...` dashboard URL whose org/property/parking slug was
 * remapped this session, return the rewritten pathname. Otherwise null.
 */
export function rewriteDashboardPathForSlugRemap(pathname: string): string | null {
  const parts = pathname.split('/');
  // ['', 'org', orgSlug, ...]
  if (parts[1] !== 'org' || !parts[2]) return null;

  let changed = false;
  const orgSlug = parts[2]!;
  const nextOrg = resolveRemappedSlug('org', orgSlug);
  if (nextOrg !== orgSlug) {
    parts[2] = nextOrg;
    changed = true;
  }

  if (parts[3] === 'property' && parts[4]) {
    const next = resolveRemappedSlug('property', parts[4]);
    if (next !== parts[4]) {
      parts[4] = next;
      changed = true;
    }
  } else if (parts[3] === 'parking' && parts[4]) {
    const next = resolveRemappedSlug('parking', parts[4]);
    if (next !== parts[4]) {
      parts[4] = next;
      changed = true;
    }
  }

  return changed ? parts.join('/') : null;
}

/** Test helper — clears in-memory and session remap stores. */
export function clearTenantSlugRemapForTests(): void {
  memoryStore = emptyStore();
  hydratedFromSession = false;
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
