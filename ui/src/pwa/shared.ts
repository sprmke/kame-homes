/**
 * Constants shared between the service worker (`sw.ts`) and the app
 * (`@/components/pwa/*`, `@/lib/pwa/*`). Keep this file free of DOM- and
 * worker-only globals so it type-checks in both programs.
 */

/** Static descriptor the SW polls to self-disable a bad rollout. `public/pwa-version.json`. */
export const PWA_VERSION_URL = '/pwa-version.json';

/** How often the running SW re-checks the kill-switch descriptor. */
export const PWA_VERSION_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

/** Cache-name prefixes. Anything starting with this belongs to the app and is
 * safe to wipe on logout / kill-switch. Workbox precache uses its own name that
 * also starts with `workbox-`. */
export const CACHE_PREFIX = 'gfm-';

export const RUNTIME_CACHES = {
  fonts: `${CACHE_PREFIX}fonts`,
  images: `${CACHE_PREFIX}images`,
  static: `${CACHE_PREFIX}static`,
  api: `${CACHE_PREFIX}api`,
  // Separate from `api` — Workbox's ExpirationPlugin tracks max-age per cache
  // *name*, so a short-lived policy (booking status) must not share a cache
  // with the longer-lived general API allowlist.
  bookingStatus: `${CACHE_PREFIX}booking-status`,
} as const;

/** IndexedDB used by the offline outbox (Phase 4) — named here so logout purge
 * can find it without importing the outbox module. */
export const OUTBOX_DB_NAME = `${CACHE_PREFIX}outbox`;

/** `postMessage` contract between app ⇄ SW. */
export const SW_MESSAGE = {
  /** app → SW: activate the waiting worker now (user accepted the update prompt). */
  SKIP_WAITING: 'gfm:skip-waiting',
  /** app → SW: re-run the kill-switch check immediately. */
  CHECK_VERSION: 'gfm:check-version',
  /** app → SW: drain the offline outbox now (Phase 4). */
  DRAIN_OUTBOX: 'gfm:drain-outbox',
  /** SW → app: kill-switch tripped; app should hard-reload once caches are gone. */
  KILLED: 'gfm:killed',
  /** SW → app: a push arrived / outbox drained — refetch the given query keys. */
  REVALIDATE: 'gfm:revalidate',
  /** SW → app: set the unread badge to N (Phase 3). */
  SET_BADGE: 'gfm:set-badge',
  /** SW → app: the push subscription rotated — re-register it with the server. */
  PUSH_RESYNC: 'gfm:push-resync',
  /** SW → app: a notification was clicked — navigate to `path`. */
  NOTIFICATION_CLICK: 'gfm:notification-click',
} as const;

export type SwMessage =
  | { type: typeof SW_MESSAGE.SKIP_WAITING }
  | { type: typeof SW_MESSAGE.CHECK_VERSION }
  | { type: typeof SW_MESSAGE.DRAIN_OUTBOX }
  | { type: typeof SW_MESSAGE.KILLED }
  | { type: typeof SW_MESSAGE.REVALIDATE; keys: string[] }
  | { type: typeof SW_MESSAGE.SET_BADGE; count: number }
  | { type: typeof SW_MESSAGE.PUSH_RESYNC }
  | { type: typeof SW_MESSAGE.NOTIFICATION_CLICK; path: string };

/** Background Sync tag for the outbox drainer (Phase 4). */
export const OUTBOX_SYNC_TAG = 'gfm-outbox-drain';

/** Periodic Background Sync tag for freshening cached data (Phase 5). */
export const PERIODIC_REFRESH_TAG = 'gfm-periodic-refresh';
