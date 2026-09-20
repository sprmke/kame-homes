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
 * every admin/tenant `get-*`/`list-*` function the old allowlist string
 * enumerated by name (`dashboard-stats`, `finance-summary`,
 * `finance-bookings`, `finance-line-items`, `maintenance-items`,
 * `maintenance-summary`, `notifications-list`, `social-inbox-threads`,
 * `social-inbox-messages`, `org-settings`, `property-templates-settings`,
 * `parking-settings`, `guest-trips`, `guest-messages`, `guest-profile`) with
 * a 3-day `maxAgeSeconds`. Every one of those is tenant- or guest-scoped PII
 * that the server marks `no-store`; a 3-day-stale SW cache of that data on a
 * shared/kiosk device is a persistent PII leak, not just a staleness bug —
 * see `docs/architecture/pwa.md` and doc 11 Phase 11.5 ("the most serious
 * single issue in this doc").
 *
 * Adding a function here is a deliberate, security-reviewed decision: it
 * must be public (no auth-scoped variation the SW could cross-serve between
 * viewers) and must match the server's own cache classification, not just
 * "looks like a GET".
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
