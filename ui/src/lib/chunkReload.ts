import { captureError } from '@/lib/sentry/capture';

import { PWA_VERSION_URL } from '@/pwa/shared';

/**
 * Recover from lazy chunks that no longer exist after a deploy: an open tab built on a
 * previous release requests old hashed `/assets/*` files.
 *
 * Two-stage recovery, because one reload is not always enough:
 *   1. `reload` — the normal case. Navigation is network-first, so the reload picks up
 *      the current `index.html` and its current chunks.
 *   2. `reset` — the tab is still on a worker built before that change (or the worker
 *      keeps answering with its old shell). Unregister it, then reload, so the browser
 *      fetches the current HTML from the network and registers a fresh worker.
 *   3. `give-up` — the failure survived both, so the new build itself is broken; stop
 *      looping and let the caller show its error UI.
 *
 * Reporting is deliberately quiet on the first two: they are the ordinary
 * stale-tab-after-deploy case. Only a failure that survives recovery is an error.
 */

const STATE_KEY = 'kh-chunk-reload-at';
/** A failure after this long is a new incident, not the tail of the previous one. */
const RELOAD_WINDOW_MS = 30_000;

/** Identifies this document, so one failure reported twice does not count twice. */
const PAGE_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i, // Chromium
  /dynamically imported module/i, // Chromium / Firefox wording variants
  /Importing a module script failed/i, // Safari
  /error loading dynamically imported module/i, // Firefox
  /is not a valid JavaScript MIME type/i, // HTML served for a missing chunk
  /MIME type of ["']?text\/html/i, // Chromium/Safari strict MIME check
  /Unable to preload CSS/i, // Vite CSS preload
  /does not provide an export named/i, // old + new chunks mixed after a deploy
  /Importing binding name/i, // same, Safari wording
  /Unexpected token ['"]?</, // HTML parsed as a module (never a real syntax error)
  /ChunkLoadError/i,
];

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '');
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export type ChunkRecoveryState = {
  /** Document that triggered the last attempt. */
  pageId: string;
  /** Recovery attempts inside the current window, including the last one. */
  attempts: number;
  at: number;
};

export type ChunkRecoveryAction = 'reload' | 'reset' | 'give-up' | 'handled';

/**
 * Pure decision for one chunk-load failure. `handled` means this document already
 * triggered a recovery (Vite's `vite:preloadError` and the error boundary can both
 * report the same failed import) — do not escalate on our own echo.
 */
export function decideChunkRecovery(
  current: ChunkRecoveryState | null | undefined,
  now: number,
  pageId: string
): { action: ChunkRecoveryAction; state: ChunkRecoveryState } {
  const recent = current && now - current.at < RELOAD_WINDOW_MS ? current : null;
  if (recent && recent.pageId === pageId) return { action: 'handled', state: recent };

  const previous = recent?.attempts ?? 0;
  if (previous >= 2 && recent) return { action: 'give-up', state: recent };
  return {
    action: previous === 0 ? 'reload' : 'reset',
    state: { pageId, attempts: previous + 1, at: now },
  };
}

type ReloadDeps = {
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  now?: number;
  pageId?: string;
  /** Defaults to `navigator.onLine !== false`. */
  online?: boolean;
  reload?: () => void;
  /** Injectable for tests; unregisters stale workers, then reloads. */
  reset?: (reload: () => void) => void;
};

function sessionStorageOrNull(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readState(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
): ChunkRecoveryState | null {
  try {
    const raw = storage?.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChunkRecoveryState>;
    if (typeof parsed?.at !== 'number' || typeof parsed?.attempts !== 'number') return null;
    return {
      pageId: typeof parsed.pageId === 'string' ? parsed.pageId : '',
      attempts: parsed.attempts,
      at: parsed.at,
    };
  } catch {
    return null;
  }
}

function writeState(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  state: ChunkRecoveryState
): void {
  try {
    storage?.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: recovery still runs, it just cannot count attempts.
  }
}

/**
 * A controlled service worker answers navigations from its own build, so a page whose
 * worker predates the network-first navigation fix would keep serving the same stale
 * shell after a reload. Unregistering first makes the next load go to the network; the
 * app registers a fresh worker on load. Pages without a worker reload immediately.
 *
 * Never unregister without proving the network is reachable: offline, or behind a
 * captive portal, an unregistered worker turns the reload into the browser's own
 * `chrome-error://` page instead of the cached shell.
 */
function unregisterThenReload(reload: () => void): void {
  const container = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
  if (!container?.controller || navigator.onLine === false) {
    reload();
    return;
  }
  void (async () => {
    if (!(await canReachNetwork())) {
      reload();
      return;
    }
    await container
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((entry) => entry.unregister())))
      .catch(() => undefined);
    reload();
  })();
}

/** True when a tiny same-origin request actually completes (Wi-Fi can be up with no route). */
async function canReachNetwork(): Promise<boolean> {
  if (typeof fetch !== 'function') return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${PWA_VERSION_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Recovers from a chunk-load failure. Returns false only when there is nothing to
 * recover (offline) or recovery has already been tried twice and failed — the caller
 * then shows its error UI.
 */
export function reloadForChunkError(deps: ReloadDeps = {}): boolean {
  const storage = deps.storage === undefined ? sessionStorageOrNull() : deps.storage;
  const now = deps.now ?? Date.now();
  const pageId = deps.pageId ?? PAGE_ID;
  const reload = deps.reload ?? (() => window.location.reload());
  const online = deps.online ?? (typeof navigator === 'undefined' || navigator.onLine !== false);

  // Offline a reload cannot fetch the missing chunk, and the second stage would
  // unregister the worker that is serving the shell. Let the caller show its error UI.
  if (!online) {
    captureError(new Error('Chunk load failed while offline'), {
      level: 'warning',
      tags: { chunk_load: 'offline' },
      fingerprint: ['chunk_load', 'offline'],
    });
    return false;
  }

  const { action, state } = decideChunkRecovery(readState(storage), now, pageId);
  if (action === 'handled') return true;
  if (action === 'give-up') {
    captureError(new Error('Chunk load still failing after a reload and a worker reset'), {
      level: 'error',
      tags: { chunk_load: 'repeat_failure' },
      fingerprint: ['chunk_load', 'repeat_failure'],
    });
    return false;
  }

  writeState(storage, state);
  if (action === 'reload') {
    captureError(new Error('Chunk load failed, reloading once'), {
      level: 'warning',
      tags: { chunk_load: 'first_failure' },
      fingerprint: ['chunk_load', 'first_failure'],
    });
    reload();
    return true;
  }

  captureError(new Error('Chunk load failed again, resetting the service worker'), {
    level: 'warning',
    tags: { chunk_load: 'shell_reset' },
    fingerprint: ['chunk_load', 'shell_reset'],
  });
  (deps.reset ?? unregisterThenReload)(reload);
  return true;
}

/**
 * Last-resort "Reload" from the crash screen: drop the worker (so the shell cannot be
 * stale) and reload. Falls back to a plain reload when offline or the network is
 * unreachable — unregistering there would replace the cached app with a browser error.
 */
export function resetAppShellAndReload(): void {
  unregisterThenReload(() => window.location.reload());
}

/**
 * Vite fires `vite:preloadError` when a dynamic import's preload fails. Without a
 * listener the rejection logs and the failed route surfaces as a render error —
 * i.e. the "Something went wrong" screen instead of recovery.
 */
export function installChunkErrorRecovery(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadForChunkError();
  });
}
