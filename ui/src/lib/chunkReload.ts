/**
 * Recover from lazy chunks that no longer exist after a deploy: an open tab built on the
 * previous release requests old hashed `/assets/*` files. One reload fetches the new
 * `index.html` and its chunks.
 */

const RELOAD_KEY = 'kh-chunk-reload-at';
/** A second chunk failure inside this window means the new build itself is broken; stop. */
const RELOAD_WINDOW_MS = 10_000;

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i, // Chromium
  /Importing a module script failed/i, // Safari
  /error loading dynamically imported module/i, // Firefox
  /is not a valid JavaScript MIME type/i, // HTML served for a missing chunk
  /Unable to preload CSS/i, // Vite CSS preload
];

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '');
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

type ReloadDeps = {
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  now?: number;
  reload?: () => void;
};

function sessionStorageOrNull(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Reloads once per window. Returns false when a reload just happened (caller shows its error UI). */
export function reloadForChunkError(deps: ReloadDeps = {}): boolean {
  const storage = deps.storage === undefined ? sessionStorageOrNull() : deps.storage;
  const now = deps.now ?? Date.now();
  try {
    const raw = storage?.getItem(RELOAD_KEY);
    const last = raw ? Number(raw) : Number.NEGATIVE_INFINITY;
    if (now - last < RELOAD_WINDOW_MS) return false;
    storage?.setItem(RELOAD_KEY, String(now));
  } catch {
    // Storage blocked: still reload once; the browser's own error UI covers a loop.
  }
  (deps.reload ?? (() => window.location.reload()))();
  return true;
}
