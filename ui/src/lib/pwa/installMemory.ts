/**
 * Local-only install memory: engagement counters, dismissal history and the
 * "this device has hosted before" flag.
 *
 * Deliberately device-scoped, not identity-scoped:
 *  - it survives sign-out (the browser still has the app installed / still knows
 *    this device used to host), so a signed-out launch can go to host login
 *    instead of the public marketplace (P0-1 / 1.1 step 4);
 *  - it therefore must NOT be part of `purgeOfflineState` (that wipes the previous
 *    viewer's *data*; this is not their data, it is "has this device installed the
 *    app"). Documented in `.cursor/rules/pwa.mdc`.
 *
 * Storage is wrapped so private mode / disabled storage degrades to "no memory"
 * instead of throwing.
 */

export type InstallMemory = {
  /** Distinct app sessions (a session ends after 30 min of inactivity). */
  sessions: number;
  /** Epoch ms of the first ever visit on this device. */
  firstSeenAt: number | null;
  /** Last session stamp, used to open a new session. */
  lastSessionAt: number | null;
  /** Value moments that make an install offer worth showing. */
  valueMoments: string[];
  /** How many times the offer was dismissed. */
  dismissCount: number;
  /** Epoch ms of the last dismissal. */
  lastDismissAt: number | null;
  /** "Don't ask again" — proactive offers stop, passive entry stays. */
  dontAskAgain: boolean;
  /** A host has signed in on this device at least once. */
  hostInstall: boolean;
  /** The app was launched standalone at least once (first-launch onboarding ran). */
  firstLaunchSeen: boolean;
};

const STORAGE_KEY = 'gfm:install:memory';
const SESSION_GAP_MS = 30 * 60 * 1000;

const EMPTY: InstallMemory = {
  sessions: 0,
  firstSeenAt: null,
  lastSessionAt: null,
  valueMoments: [],
  dismissCount: 0,
  lastDismissAt: null,
  dontAskAgain: false,
  hostInstall: false,
  firstLaunchSeen: false,
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Reads install memory. Never throws; unknown/corrupt values fall back to empty. */
export function readInstallMemory(storage: StorageLike | null = defaultStorage()): InstallMemory {
  if (!storage) return { ...EMPTY };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<InstallMemory> | null;
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY };
    return {
      sessions: Number.isFinite(parsed.sessions) ? Number(parsed.sessions) : 0,
      firstSeenAt: typeof parsed.firstSeenAt === 'number' ? parsed.firstSeenAt : null,
      lastSessionAt: typeof parsed.lastSessionAt === 'number' ? parsed.lastSessionAt : null,
      valueMoments: Array.isArray(parsed.valueMoments)
        ? parsed.valueMoments.filter((v): v is string => typeof v === 'string').slice(0, 12)
        : [],
      dismissCount: Number.isFinite(parsed.dismissCount) ? Number(parsed.dismissCount) : 0,
      lastDismissAt: typeof parsed.lastDismissAt === 'number' ? parsed.lastDismissAt : null,
      dontAskAgain: parsed.dontAskAgain === true,
      hostInstall: parsed.hostInstall === true,
      firstLaunchSeen: parsed.firstLaunchSeen === true,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function writeInstallMemory(
  memory: InstallMemory,
  storage: StorageLike | null = defaultStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // quota / private mode — memory is an optimisation, never a requirement
  }
}

/** Mutate install memory in one place so every writer stays schema-valid. */
export function updateInstallMemory(
  patch: (current: InstallMemory) => InstallMemory,
  storage: StorageLike | null = defaultStorage()
): InstallMemory {
  const next = patch(readInstallMemory(storage));
  writeInstallMemory(next, storage);
  return next;
}

/**
 * Records a visit. A new session starts after `SESSION_GAP_MS` of inactivity, so
 * "2nd session within 7 days" means two real visits, not two page loads.
 */
export function recordSession(
  now = Date.now(),
  storage: StorageLike | null = defaultStorage()
): InstallMemory {
  return updateInstallMemory((current) => {
    const isNewSession =
      current.lastSessionAt === null || now - current.lastSessionAt > SESSION_GAP_MS;
    return {
      ...current,
      sessions: isNewSession ? current.sessions + 1 : current.sessions,
      firstSeenAt: current.firstSeenAt ?? now,
      lastSessionAt: now,
    };
  }, storage);
}

/** Fire-and-forget from an existing success path (no network, no render). */
export function recordValueMoment(
  moment: string,
  now = Date.now(),
  storage: StorageLike | null = defaultStorage()
): InstallMemory {
  return updateInstallMemory((current) => {
    if (current.valueMoments.includes(moment)) return current;
    return {
      ...current,
      valueMoments: [...current.valueMoments, moment].slice(-12),
      lastSessionAt: current.lastSessionAt ?? now,
    };
  }, storage);
}

export function recordInstallDismissal(
  now = Date.now(),
  storage: StorageLike | null = defaultStorage()
): InstallMemory {
  return updateInstallMemory(
    (current) => ({
      ...current,
      dismissCount: current.dismissCount + 1,
      lastDismissAt: now,
    }),
    storage
  );
}

export function markDontAskAgain(storage: StorageLike | null = defaultStorage()): InstallMemory {
  return updateInstallMemory((current) => ({ ...current, dontAskAgain: true }), storage);
}

/** Called once a host session is confirmed. Drives signed-out launch routing. */
export function markHostInstall(storage: StorageLike | null = defaultStorage()): InstallMemory {
  return updateInstallMemory((current) => ({ ...current, hostInstall: true }), storage);
}

export function markFirstLaunchSeen(storage: StorageLike | null = defaultStorage()): InstallMemory {
  return updateInstallMemory((current) => ({ ...current, firstLaunchSeen: true }), storage);
}

/** True when a host has signed in on this device before. */
export function hasHostInstall(storage: StorageLike | null = defaultStorage()): boolean {
  return readInstallMemory(storage).hostInstall;
}

/** Test/QA helper — clearing the app data must also clear install memory. */
export function clearInstallMemory(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(EMPTY));
  } catch {
    // ignore
  }
}
