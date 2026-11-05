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
 * safe to wipe on logout / kill-switch. */
export const CACHE_PREFIX = 'gfm-';

export const RUNTIME_CACHES = {
  /** Workbox precache (shell tier only — see scripts/pwa/generate-precache-tiers.mjs). */
  precache: `${CACHE_PREFIX}precache`,
  fonts: `${CACHE_PREFIX}fonts`,
  images: `${CACHE_PREFIX}images`,
  /** Hashed build assets: on-demand chunks, host-tier warming, shell stragglers. */
  static: `${CACHE_PREFIX}static`,
  api: `${CACHE_PREFIX}api`,
  // Separate from `api` — Workbox's ExpirationPlugin tracks max-age per cache
  // *name*, so a short-lived policy (booking status) must not share a cache
  // with the longer-lived general API allowlist.
  bookingStatus: `${CACHE_PREFIX}booking-status`,
} as const;

/** IndexedDB used by the offline outbox — named here so logout purge can find it
 * without importing the outbox module. */
export const OUTBOX_DB_NAME = `${CACHE_PREFIX}outbox`;

/** IndexedDB used by guest form drafts (they hold PII — purged on logout too). */
export const DRAFTS_DB_NAME = `${CACHE_PREFIX}drafts`;

/** Build-time tier manifest written by `scripts/pwa/generate-precache-tiers.mjs`. */
export const PRECACHE_TIERS_PATH = '/precache-tiers.json';

/**
 * Cache key for the tier manifest, scoped to the build that wrote it.
 *
 * The manifest lists hashed asset names, so it is only valid for one build. Cached
 * under the bare path it was read back by *every* later worker, which then
 * precached (and served the shell of) the build that happened to be live at the
 * user's first install — and a normal refresh could never move off it.
 */
export function precacheTiersCacheKey(buildId: number | string): string {
  return `${PRECACHE_TIERS_PATH}?b=${buildId}`;
}

/** `postMessage` contract between app ⇄ SW. */
export const SW_MESSAGE = {
  /** app → SW: activate the waiting worker now (user accepted the update prompt). */
  SKIP_WAITING: 'gfm:skip-waiting',
  /** app → SW: re-run the kill-switch check immediately. */
  CHECK_VERSION: 'gfm:check-version',
  /** app → SW: drain the offline outbox now. */
  DRAIN_OUTBOX: 'gfm:drain-outbox',
  /** app → SW: warm the host-tier chunks into the runtime cache (idle, one at a time). */
  WARM_HOST_TIER: 'gfm:warm-cache',
  /** app → SW: set the app-icon badge to N (0 clears). */
  SET_BADGE: 'gfm:set-badge',
  /** app → SW: close OS notifications for one tag (e.g. the thread the user just opened). */
  CLOSE_NOTIFICATIONS: 'gfm:close-notifications',
  /** SW → app: kill-switch tripped; app should hard-reload once caches are gone. */
  KILLED: 'gfm:killed',
  /** SW → app: a push arrived / outbox drained — refetch the given query keys. */
  REVALIDATE: 'gfm:revalidate',
  /** SW → app: this build is below `forceUpdateBelow` — show the blocking update sheet. */
  FORCE_UPDATE: 'gfm:force-update',
  /** SW → app: the push subscription rotated — re-register it with the server. */
  PUSH_RESYNC: 'gfm:push-resync',
  /** SW → app: a notification was clicked — navigate to `path`. */
  NOTIFICATION_CLICK: 'gfm:notification-click',
  /** SW → app: host-tier warming finished (or was skipped). */
  WARM_DONE: 'gfm:warm-done',
} as const;

/** Background Sync tag for the outbox drainer. */
export const OUTBOX_SYNC_TAG = 'gfm-outbox-drain';

/** Periodic Background Sync tag for freshening cached data. */
export const PERIODIC_REFRESH_TAG = 'gfm-periodic-refresh';

/**
 * Edge Function names the service worker may runtime-cache as a GET
 * (production-readiness doc 11, Phase 11.5). Mirrors the shape of
 * `ui/src/lib/pwa/offlineQueryAllowlist.ts` (`OFFLINE_PERSIST_KEY_ROOTS`): a
 * tight, explicit, deliberately-added set rather than a prefix/regex guess.
 *
 * Every entry here MUST be classified `publicStatic`, `publicDynamic`, or
 * `publicAvailability` in `supabase/functions/_shared/httpResponse.ts`
 * (`CacheClass`) — i.e. a genuinely public, non-personalized read with an
 * explicit `public` `Cache-Control` from the server. Every admin/tenant/
 * guest-PII-scoped function (`private`/`guestToken`/`mutation` class —
 * `private, no-store` or `no-store`) must stay OUT of this set.
 *
 * This replaced a broad `get-*`/`list-*` prefix regex that also matched
 * every admin/tenant `get-*`/`list-*` function the old allowlist enumerated by
 * name with a 3-day `maxAgeSeconds`. Every one of those is tenant- or
 * guest-scoped PII that the server marks `no-store`; a 3-day-stale SW cache of
 * that data on a shared/kiosk device is a persistent PII leak, not just a
 * staleness bug — see `docs/architecture/pwa.md`.
 *
 * Adding a function here is a deliberate, security-reviewed decision: it must be
 * public (no auth-scoped variation the SW could cross-serve between viewers) and
 * must match the server's own cache classification, not just "looks like a GET".
 * `ui/src/lib/pwa/swCacheableFunctions.test.ts` asserts that automatically.
 */
export const SW_CACHEABLE_FUNCTIONS: ReadonlySet<string> = new Set([
  // Public static — plan catalog, vocabularies
  'list-public-pricing-plans',
  'get-residence-unit-types',

  // Public dynamic — listings, detail pages, search
  'get-public-property',
  'get-public-parking',
  'get-public-host',
  'get-public-showcase',
  'list-public-properties',
  'list-public-parkings',
  'list-public-developments',
  'list-public-place-groups',
  'search-listings',
  'search-suggestions',

  // Public availability — short TTL by design; still safe to runtime-cache
  // since the SW's own NetworkFirst timeout (6s) means this only ever serves
  // as an offline/flaky-network fallback, never a substitute for a fresh hit.
  'get-booked-dates',
]);
