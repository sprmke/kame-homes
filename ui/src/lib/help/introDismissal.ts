/**
 * Per-viewer, per-device dismissal state for first-visit intro cards.
 *
 * Keys are `<prefix>.<userId>.<featureKey>.v<version>` so two people sharing a
 * device do not hide each other's cards, and bumping `version` re-shows a card
 * after the feature changes meaningfully.
 *
 * Storage can throw (private mode, Safari ITP, quota). Every read and write is
 * guarded; a module-level Set keeps the dismissal for the current session when
 * storage is unavailable, so a dismissed card never comes back on re-render.
 */

export const INTRO_STORAGE_PREFIX = 'kh.help.intro';

const memoryDismissals = new Set<string>();

type IntroKeyInput = {
  userId?: string | null;
  featureKey: string;
  version?: number;
};

export function introDismissalKey({ userId, featureKey, version = 1 }: IntroKeyInput): string {
  const viewer = userId?.trim() || 'anonymous';
  return `${INTRO_STORAGE_PREFIX}.${viewer}.${featureKey}.v${version}`;
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function isIntroDismissed(key: string): boolean {
  if (memoryDismissals.has(key)) return true;

  const storage = getStorage();
  if (!storage) return false;

  try {
    return storage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function dismissIntro(key: string): void {
  memoryDismissals.add(key);

  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(key, '1');
  } catch {
    // Memory fallback already holds the dismissal for this session.
  }
}

/** Test and support helper. Not used by product UI. */
export function resetIntroDismissal(key: string): void {
  memoryDismissals.delete(key);

  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    // Nothing else to clear.
  }
}

/** Test helper: drop all in-memory state between cases. */
export function resetAllIntroDismissals(): void {
  memoryDismissals.clear();
}
