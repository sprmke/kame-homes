/**
 * Dashboard mode ('advanced' | 'ai') — pure helpers behind `useDashboardMode`.
 * Server row (`user_ui_preferences`) is the source of truth; localStorage is a per-user
 * cache for instant first paint; `?mode=` is a one-shot override (links, E2E).
 */

export type DashboardMode = 'advanced' | 'ai';

export function isDashboardMode(value: unknown): value is DashboardMode {
  return value === 'advanced' || value === 'ai';
}

export function dashboardModeStorageKey(userId: string): string {
  return `kame-admin-ui-mode:${userId}`;
}

export function readCachedDashboardMode(
  userId: string | null,
  storage: Pick<Storage, 'getItem'> | undefined = safeLocalStorage()
): DashboardMode | null {
  if (!userId || !storage) return null;
  try {
    const value = storage.getItem(dashboardModeStorageKey(userId));
    return isDashboardMode(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeCachedDashboardMode(
  userId: string | null,
  mode: DashboardMode,
  storage: Pick<Storage, 'setItem'> | undefined = safeLocalStorage()
): void {
  if (!userId || !storage) return;
  try {
    storage.setItem(dashboardModeStorageKey(userId), mode);
  } catch {
    // Private mode / blocked storage: the server row still persists the choice.
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export type DashboardModeAvailability =
  /** Access still loading: trust the cached mode so first paint does not flash. */
  | 'pending'
  /** Toggle hidden: kill switch, AI mode switch, permission, or super-admin route. */
  | 'hidden'
  /** Toggle visible with a lock; tapping opens the upgrade modal. */
  | 'locked'
  | 'available';

export function resolveDashboardModeAvailability(input: {
  superAdmin: boolean;
  /** Assistant settings / plan gate not resolved yet. */
  loading: boolean;
  /** Assistant launcher would render (kill switches + permission; plan may still block). */
  assistantVisible: boolean;
  aiModeEnabled: boolean;
  planAllowed: boolean;
}): DashboardModeAvailability {
  if (input.superAdmin) return 'hidden';
  if (input.loading) return 'pending';
  if (!input.assistantVisible || !input.aiModeEnabled) return 'hidden';
  return input.planAllowed ? 'available' : 'locked';
}

/** A saved 'ai' silently falls back to 'advanced' whenever AI mode is not usable. */
export function resolveEffectiveDashboardMode(
  saved: DashboardMode,
  availability: DashboardModeAvailability
): DashboardMode {
  return availability === 'available' || availability === 'pending' ? saved : 'advanced';
}
