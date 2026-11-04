/// <reference lib="webworker" />
/**
 * Kame Space — custom service worker (Workbox `injectManifest`).
 *
 * Responsibilities, by plan phase (`docs/workflow/in-progress/pwa-v2-native-app-experience.md`):
 *   1. Precache the **shell tier only**; SPA navigation fallback; offline page;
 *      update-on-demand (`SKIP_WAITING`); kill-switch (`/pwa-version.json`) and
 *      `forceUpdateBelow`.
 *   2. Runtime caching for fonts / images / static assets / allowlisted API GETs.
 *   3. Web Push: `push`, `notificationclick`, `pushsubscriptionchange`, badge.
 *   4. Offline write: Background Sync `sync` handler draining the outbox.
 *   5. Host-tier warming: background download of dashboard chunks after sign-in.
 *   6. Periodic Background Sync refresh.
 *
 * Never import app (`@/…`) code here — it would pull DOM-only modules into the
 * worker bundle. Worker-only. See docs/architecture/pwa.md.
 */
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { PrecacheController } from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';

import {
  CACHE_PREFIX,
  OUTBOX_SYNC_TAG,
  PERIODIC_REFRESH_TAG,
  PRECACHE_TIERS_PATH,
  PWA_VERSION_CHECK_INTERVAL_MS,
  PWA_VERSION_URL,
  RUNTIME_CACHES,
  SW_CACHEABLE_FUNCTIONS,
  SW_MESSAGE,
  precacheTiersCacheKey,
} from './shared';
import { installSwErrorRelay } from './swErrorRelay';
import {
  cacheableFunctionName,
  isKillSwitchTripped,
  isForceUpdateRequired,
  isTiersManifestForBuild,
  normalizeBadgeCount,
  parsePrecacheTiers,
  safeAppPath,
  shouldWarmHostTier,
  truncatePushBody,
  type KillSwitchDescriptor,
  type PrecacheEntry,
  type PrecacheTiers,
} from './swLogic';

declare const self: ServiceWorkerGlobalScope;
declare const __PWA_BUILD_ID__: string;

const BUILD_ID = Number(__PWA_BUILD_ID__) || 0;

// Before anything else: an error thrown while the worker boots is the one class of failure
// nobody can currently see. Global hooks catch what the individual handlers leave uncaught.
installSwErrorRelay();
const OFFLINE_URL = '/offline.html';
const NAVIGATION_FALLBACK = '/index.html';

// ───────────────────────────── precache ──────────────────────────────────────

/**
 * Custom controller rather than `precacheAndRoute(self.__WB_MANIFEST)` because the
 * precache list is decided at install time from `/precache-tiers.json` (shell
 * tier only). Glob-precaching the whole bundle shipped ~12 MiB to every visitor.
 */
const precache = new PrecacheController({ cacheName: RUNTIME_CACHES.precache });

/** Host-tier entries from the last loaded manifest, kept in memory for warming. */
let hostTier: PrecacheEntry[] = [];
let hostTierWarmed = false;
/** `addToCacheList` throws on conflicting duplicate entries, so load exactly once. */
let precacheListLoaded = false;

async function readTiersFromCache(): Promise<PrecacheTiers | null> {
  try {
    const cache = await caches.open(RUNTIME_CACHES.static);
    const cached = await cache.match(precacheTiersCacheKey(BUILD_ID));
    const parsed = cached ? parsePrecacheTiers(await cached.json()) : null;
    // The list holds hashed asset names, so a manifest from another build would make
    // this worker precache (and later serve) a build it does not belong to.
    return isTiersManifestForBuild(parsed, BUILD_ID) ? parsed : null;
  } catch {
    return null;
  }
}

async function fetchTiersFromNetwork(): Promise<PrecacheTiers | null> {
  try {
    const res = await fetch(`${PRECACHE_TIERS_PATH}?b=${BUILD_ID}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const copy = res.clone();
    const parsed = parsePrecacheTiers(await res.json());
    if (parsed) {
      const cache = await caches.open(RUNTIME_CACHES.static);
      await cache.put(precacheTiersCacheKey(BUILD_ID), copy);
      await dropOldTierManifests(cache);
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Each build keeps its own manifest; older copies are dead weight in Cache Storage. */
async function dropOldTierManifests(cache: Cache): Promise<void> {
  const keep = new URL(precacheTiersCacheKey(BUILD_ID), self.location.origin).href;
  try {
    const requests = await cache.keys();
    await Promise.all(
      requests
        .filter((request) => request.url.includes(PRECACHE_TIERS_PATH) && request.url !== keep)
        .map((request) => cache.delete(request))
    );
  } catch {
    // Cache cleanup is best-effort.
  }
}

/**
 * The precache list must be rebuilt on **every worker start**, not just `install`.
 * A service worker is stopped aggressively by the browser; in-memory route state
 * added only during `install` is gone when it wakes up to serve a navigation, which
 * would leave the app unable to boot offline (the bug this replaces).
 */
const precacheReady: Promise<void> = (async () => {
  const tiers = (await readTiersFromCache()) ?? (await fetchTiersFromNetwork());
  if (tiers) {
    hostTier = tiers.host;
    precache.addToCacheList(tiers.shell);
    precacheListLoaded = true;
  }
})();

/**
 * Dev (`VITE_PWA_DEV=true`) has no tier manifest, and a transient CDN miss must
 * not leave the app bootless — fall back to the plugin-injected glob manifest.
 * In production that manifest is empty, so installation fails loudly and the
 * previous worker (with a working shell) keeps running.
 */
function fallbackEntries(): PrecacheEntry[] {
  const manifest = (self.__WB_MANIFEST ?? []) as Array<{ url: string; revision: string | null }>;
  const injected = manifest.map((entry) => ({
    url: entry.url.startsWith('/') ? entry.url : `/${entry.url}`,
    revision: entry.revision,
  }));
  if (injected.length > 0) return injected;
  return [
    { url: NAVIGATION_FALLBACK, revision: String(BUILD_ID || 'dev') },
    { url: OFFLINE_URL, revision: String(BUILD_ID || 'dev') },
  ];
}

self.addEventListener('install', (event) => {
  // Do NOT skipWaiting automatically — the update controller decides, so a
  // running operator is never reloaded mid-edit (Phase 4).
  event.waitUntil(
    (async () => {
      await precacheReady;
      if (!precacheListLoaded) {
        // `precacheReady` resolves before `install` when the manifest is missing
        // (dev), so the fallback is added here instead.
        precache.addToCacheList(fallbackEntries());
        precacheListLoaded = true;
      }
      await precache.install(event);
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Never run cleanup with an empty expected set: that would delete the whole
      // precached shell.
      await precacheReady;
      if (precacheListLoaded) await precache.activate(event);
      await self.clients.claim();
      await dropStrayCaches();
      await checkVersionDescriptor('activate');
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string; count?: number; tag?: string } | undefined;
  if (!data?.type) return;

  // `SKIP_WAITING` is what vite-plugin-pwa's prompt register posts; the prefixed
  // constant is for anything else the app sends directly.
  if (data.type === SW_MESSAGE.SKIP_WAITING || data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
    return;
  }
  if (data.type === SW_MESSAGE.CHECK_VERSION) {
    event.waitUntil(checkVersionDescriptor('message'));
    return;
  }
  if (data.type === SW_MESSAGE.WARM_HOST_TIER) {
    event.waitUntil(warmHostTier('message'));
    return;
  }
  if (data.type === SW_MESSAGE.SET_BADGE) {
    event.waitUntil(setBadge(data.count ?? 0));
    return;
  }
  if (data.type === SW_MESSAGE.CLOSE_NOTIFICATIONS) {
    event.waitUntil(closeNotifications(data.tag));
  }
});

/**
 * Background Sync (Chromium only): the browser fires this when connectivity
 * returns, even if no tab is focused. We can't replay the outbox here (each
 * request needs a fresh Supabase JWT the app holds), so wake a client to do it.
 * If no client is open the event rejects and the browser retries later.
 */
self.addEventListener('sync', (event) => {
  const syncEvent = event as ExtendableEvent & { tag?: string };
  if (syncEvent.tag !== OUTBOX_SYNC_TAG) return;
  syncEvent.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (clientList.length === 0) throw new Error('no client to drain the outbox');
      for (const client of clientList) client.postMessage({ type: SW_MESSAGE.DRAIN_OUTBOX });
    })()
  );
});

/**
 * Periodic Background Sync (Chromium installed): nudge open clients to revalidate
 * their bookings + notifications caches.
 */
self.addEventListener('periodicsync', (event) => {
  const pEvent = event as ExtendableEvent & { tag?: string };
  if (pEvent.tag !== PERIODIC_REFRESH_TAG) return;
  pEvent.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({
          type: SW_MESSAGE.REVALIDATE,
          keys: ['bookings', 'notifications', 'dashboard-stats'],
        });
      }
    })()
  );
});

// ─────────────────────── navigation ──────────────────────────────────────────

/** Give up on the network and boot the cached shell after this long. */
const NAVIGATION_NETWORK_TIMEOUT_MS = 3000;

async function cachedShellResponse(): Promise<Response> {
  await precacheReady;
  const shell = await precache.matchPrecache(NAVIGATION_FALLBACK);
  if (shell) return shell;
  const offline = (await caches.match(OFFLINE_URL)) ?? (await caches.match(NAVIGATION_FALLBACK));
  return offline ?? Response.error();
}

/**
 * Network-first: while online a navigation always gets the **current** `index.html`
 * and its current chunk names. Answering navigations from the precached shell first
 * is what pinned a user to the build that was live when their worker installed — a
 * normal refresh returned the same old HTML, so the new build could never load and a
 * removed chunk turned into "Something went wrong" until a hard refresh.
 *
 * Offline (or a slow/dead network) still boots the precached shell, which is the
 * whole offline contract; only the HTML is revalidated, assets stay cache-first.
 */
async function navigationResponse(request: Request): Promise<Response> {
  if (self.navigator.onLine !== false) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NAVIGATION_NETWORK_TIMEOUT_MS);
    try {
      const response = await fetch(request.url, {
        cache: 'no-cache',
        credentials: 'same-origin',
        redirect: 'follow',
        signal: controller.signal,
      });
      const contentType = response.headers.get('content-type') ?? '';
      if (response.ok && contentType.includes('text/html')) return response;
    } catch {
      // Offline / timeout / DNS — fall through to the precached shell.
    } finally {
      clearTimeout(timer);
    }
  }
  return cachedShellResponse();
}

/**
 * Every SPA navigation is answered by [`navigationResponse`]. The precache list is
 * populated during `install`, so the shell lookup must resolve at request time
 * rather than bind to a URL up front (`createHandlerBoundToURL` would throw if
 * called before the list existed).
 */
registerRoute(
  new NavigationRoute(({ request }) => navigationResponse(request), {
    // Let the SW ignore these — they must always hit the network / other routes.
    denylist: [
      /^\/functions\//,
      /^\/api\//,
      /^\/auth\//,
      /\/[^/?]+\.[^/]+(\?.*)?$/, // anything that looks like a file request
    ],
  })
);

// ─────────────────────── runtime caching ─────────────────────────────────────

// Google Fonts stylesheet — SWR so a new font list lands next load.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: `${CACHE_PREFIX}google-fonts-css`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 8,
        maxAgeSeconds: 60 * 60 * 24 * 30,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Google Fonts files — immutable, cache-first, long TTL.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: RUNTIME_CACHES.fonts,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 40,
        maxAgeSeconds: 60 * 60 * 24 * 365,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Supabase Storage media (public renders + signed asset URLs).
registerRoute(
  ({ url, request }) =>
    request.destination === 'image' &&
    (/\/storage\/v1\/object\//.test(url.pathname) || url.pathname.startsWith('/storage/')),
  new StaleWhileRevalidate({
    cacheName: RUNTIME_CACHES.images,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      // Opaque cross-origin image responses pad to ~7 MB each toward the quota;
      // 80 entries stays well within iOS's tight budget before purgeOnQuotaError.
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 60 * 60 * 24 * 30,
        purgeOnQuotaError: true,
      }),
    ]
  })
);

/**
 * Hashed build assets. Resolution order:
 *   1. the precache (shell tier — the files that must work offline),
 *   2. the runtime cache (host-tier warming + on-demand chunks fetched earlier),
 *   3. the network, which then populates the runtime cache.
 *
 * This must be hand-ordered rather than a Workbox strategy: the precache lives in
 * its own cache, so a plain `CacheFirst` would miss precached shell chunks on the
 * second visit and break offline boot.
 */
registerRoute(
  ({ url, request, sameOrigin }) =>
    sameOrigin &&
    url.pathname.startsWith('/assets/') &&
    (request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'worker' ||
      request.destination === 'font'),
  async ({ request, url }) => {
    await precacheReady;
    const precached = await precache.matchPrecache(url.href);
    if (precached) return precached;

    const cache = await caches.open(RUNTIME_CACHES.static);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  }
);

// Public runtime files referenced by the SW itself / the OS shell.
registerRoute(
  ({ url, sameOrigin }) =>
    sameOrigin &&
    /^\/(?:icons|favicon|images|screenshots|fonts)\//.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: `${CACHE_PREFIX}media`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 60 * 60 * 24 * 30,
        purgeOnQuotaError: true,
      }),
    ]
  })
);

// Host feature-availability snapshot — authenticated, `private, no-store`. Must
// never land in Cache Storage (feature-availability plan task 2.6).
const FEATURE_AVAILABILITY_FUNCTION_RE = /\/functions\/v1\/get-feature-availability(?:[/?]|$)/;

registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && FEATURE_AVAILABILITY_FUNCTION_RE.test(url.pathname),
  new NetworkOnly()
);

// Booking status is the one read view an operator actively acts on (check-in/out,
// document review) — never let a flaky-but-connected network silently serve a
// multi-day-old status via the NetworkFirst fallback. Registered before the general
// allowlist below so it wins the route match for these two function names.
const BOOKING_STATUS_FUNCTION_RE = /\/functions\/v1\/(get-booking|list-bookings)(?:[/?]|$)/;

registerRoute(
  ({ url, request }) => request.method === 'GET' && BOOKING_STATUS_FUNCTION_RE.test(url.pathname),
  new NetworkFirst({
    cacheName: RUNTIME_CACHES.bookingStatus,
    networkTimeoutSeconds: 6,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        // Minutes, not days — this is an offline/flaky-network fallback only, not a
        // read view the app should ever silently serve as if it were current.
        maxAgeSeconds: 60 * 10,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Allowlisted PUBLIC Edge Function GETs only — NetworkFirst with a short timeout
// so the app stays live but can fall back to the last good copy offline.
//
// `SW_CACHEABLE_FUNCTIONS` replaced a broad `get-*`/`list-*` prefix regex here.
// That regex matched every admin/tenant/guest-PII read whose function name
// happened to start with `get-`/`list-`, caching them for up to 3 days. A
// 3-day-stale SW cache of tenant/guest PII on a shared or kiosk device is a
// persistent leak, not just staleness — the SW must never runtime-cache anything
// in a `no-store` class, full stop.
registerRoute(
  ({ url, request }) => {
    if (request.method !== 'GET') return false;
    const name = cacheableFunctionName(url.pathname, SW_CACHEABLE_FUNCTIONS);
    if (!name) return false;
    // Host-only unpublished draft. Server already returns `private, no-store`,
    // but Workbox caches on status 200 unless we also refuse the URL.
    if (
      name === 'get-public-showcase' &&
      (url.searchParams.get('preview') === '1' || url.searchParams.get('embed') === '1')
    ) {
      return false;
    }
    return true;
  },
  new NetworkFirst({
    cacheName: RUNTIME_CACHES.api,
    networkTimeoutSeconds: 6,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      {
        cacheWillUpdate: async ({ response }: { response: Response }) => {
          const cacheControl = response.headers.get('Cache-Control') ?? '';
          if (/\bno-store\b/i.test(cacheControl) || /(^|,)\s*private\b/i.test(cacheControl)) {
            return null;
          }
          return response.status === 200 ? response : null;
        },
      },
      new ExpirationPlugin({
        // Public listing/search data — short-lived like the server's own
        // `publicDynamic`/`publicAvailability` classes, not the old 3-day TTL.
        maxEntries: 200,
        maxAgeSeconds: 60 * 10,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// No setDefaultHandler: unmatched requests (POSTs, SSE streams like the dashboard
// assistant, auth) pass straight to the network with no SW involvement.
setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') return cachedShellResponse();
  return Response.error();
});

// ─────────────────────── host tier warming ───────────────────────────────────

type WarmResult = { warmed: number; skipped?: string };

/**
 * Downloads the host-tier chunks (dashboard routes) one at a time so dashboard
 * code is already local when a host opens a screen offline — without making a
 * guest's first visit download it (P0-2 / 1.8).
 */
async function warmHostTier(reason: string): Promise<WarmResult> {
  const connection = (
    self.navigator as unknown as {
      connection?: { saveData?: boolean; effectiveType?: string };
      onLine?: boolean;
    }
  )?.connection;
  const decision = shouldWarmHostTier({
    online: self.navigator.onLine !== false,
    saveData: connection?.saveData === true,
    effectiveType: connection?.effectiveType,
    standalone: false,
    alreadyWarmed: hostTierWarmed,
  });
  if (!decision.warm) return { warmed: 0, skipped: decision.reason };

  await precacheReady;
  if (hostTier.length === 0) {
    const tiers = (await readTiersFromCache()) ?? (await fetchTiersFromNetwork());
    hostTier = tiers?.host ?? [];
  }
  if (hostTier.length === 0) return { warmed: 0, skipped: 'no-host-tier' };

  const cache = await caches.open(RUNTIME_CACHES.static);
  let warmed = 0;
  for (const entry of hostTier) {
    if (self.navigator.onLine === false) return { warmed, skipped: 'went-offline' };
    if (await cache.match(entry.url)) continue;
    try {
      const res = await fetch(entry.url, { cache: 'default', credentials: 'same-origin' });
      if (res.ok) {
        await cache.put(entry.url, res);
        warmed += 1;
      }
    } catch {
      return { warmed, skipped: 'network-error' };
    }
  }
  hostTierWarmed = true;
  // eslint-disable-next-line no-console
  console.info('[sw] host tier warmed', { warmed, reason });
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clientList) client.postMessage({ type: SW_MESSAGE.WARM_DONE, warmed });
  return { warmed };
}

// ─────────────────────────── web push ────────────────────────────────────────

type PushPayload = {
  title?: string;
  body?: string;
  path?: string;
  tag?: string;
  notificationId?: string;
  type?: string;
  unreadCount?: number;
  /** Thread/booking key so a busy conversation shows one updating notification. */
  groupKey?: string;
};

type PushNotificationOptions = NotificationOptions & {
  renotify?: boolean;
  actions?: Array<{ action: string; title: string }>;
  data: { path: string; notificationId: string | null; type?: string };
};

async function setBadge(count: number): Promise<void> {
  const nav = self.navigator as unknown as {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0) await nav.setAppBadge?.(count);
    else await nav.clearAppBadge?.();
  } catch {
    // Badging is unsupported or blocked — non-fatal.
  }
}

async function closeNotifications(tag?: string): Promise<void> {
  try {
    const notifications = await self.registration.getNotifications(tag ? { tag } : undefined);
    for (const notification of notifications) notification.close();
  } catch {
    // ignore
  }
}

self.addEventListener('push', (event) => {
  let payload: PushPayload;
  try {
    payload = event.data?.json() as PushPayload;
  } catch {
    payload = { title: 'New notification', body: event.data?.text() };
  }
  if (!payload || typeof payload !== 'object') payload = {};
  const title = typeof payload.title === 'string' && payload.title ? payload.title : 'New notification';
  const body = truncatePushBody(payload.body);
  const tag = payload.groupKey || payload.tag || payload.notificationId || payload.type || 'gfm';
  const badge = normalizeBadgeCount(payload.unreadCount);

  const options: PushNotificationOptions = {
    body,
    icon: '/icons/pwa-192.png',
    badge: '/icons/notification-badge.png',
    tag,
    data: {
      path: safeAppPath(payload.path),
      notificationId: payload.notificationId ?? null,
      type: payload.type,
    },
    // `renotify` re-alerts when a same-tag notification is replaced; Android
    // needs a tag for it, which we always provide. Actions are supported on
    // Android / desktop Chrome and ignored safely on iOS.
    renotify: true,
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'mark-read', title: 'Mark read' },
    ],
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      if (badge !== null) await setBadge(badge);
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({
          type: SW_MESSAGE.REVALIDATE,
          keys: ['notifications'],
        });
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as
    | { path?: unknown; kind?: unknown; notificationId?: string | null }
    | undefined;
  const path = safeAppPath(data?.path);
  const kind = typeof data?.kind === 'string' ? data.kind : undefined;
  const markReadOnly = event.action === 'mark-read';
  const targetUrl = new URL(markReadOnly ? '/app?shortcut=inbox' : path, self.location.origin).href;

  event.waitUntil(
    (async () => {
      // Read in the OS tray: the app shows it read once the bell refetches.
      if (markReadOnly && data?.notificationId) {
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
          client.postMessage({
            type: SW_MESSAGE.NOTIFICATION_CLICK,
            path: '/app?shortcut=inbox',
            markReadId: data.notificationId,
          });
        }
        return;
      }
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        client.postMessage({ type: SW_MESSAGE.NOTIFICATION_CLICK, path, kind });
        return;
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});

// Subscription rotated by the browser — re-subscribe locally where we can, and
// ask any open client to run a full server re-register (needs the user's JWT).
self.addEventListener('pushsubscriptionchange', (event) => {
  const evt = event as ExtendableEvent & {
    oldSubscription?: PushSubscription;
    newSubscription?: PushSubscription;
  };
  event.waitUntil(
    (async () => {
      try {
        if (!evt.newSubscription) {
          const key = evt.oldSubscription?.options?.applicationServerKey ?? undefined;
          if (key) {
            await self.registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: key,
            });
          }
        }
      } catch {
        // handled by the client resync below
      }
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) client.postMessage({ type: SW_MESSAGE.PUSH_RESYNC });
    })()
  );
});

// ──────────────────────── kill-switch / updates ──────────────────────────────

let lastVersionCheck = 0;

/**
 * Fetches `/pwa-version.json`. Three outcomes:
 *
 *   `disabled: true` / `minBuild > build`  → wipe caches, unregister, reload onto
 *                                            the plain network app (v1 kill-switch).
 *   `forceUpdateBelow > build`             → tell open clients to show the blocking
 *                                            update sheet. Caches are kept, so a
 *                                            reinstall is never required.
 *   otherwise                              → nothing.
 *
 * `{ "disabled": false, "minBuild": 0, "forceUpdateBelow": 0 }`
 */
async function checkVersionDescriptor(reason: string): Promise<void> {
  const now = Date.now();
  if (reason === 'interval' && now - lastVersionCheck < PWA_VERSION_CHECK_INTERVAL_MS) return;
  lastVersionCheck = now;

  let descriptor: KillSwitchDescriptor | null = null;
  try {
    const res = await fetch(`${PWA_VERSION_URL}?t=${now}`, { cache: 'no-store' });
    if (res.ok) {
      const parsed: unknown = await res.json();
      if (parsed && typeof parsed === 'object') descriptor = parsed as KillSwitchDescriptor;
    }
  } catch {
    return; // network down / malformed — never self-destruct on a failed check
  }
  if (!descriptor) return;

  if (isForceUpdateRequired(descriptor, BUILD_ID) && !isKillSwitchTripped(descriptor, BUILD_ID)) {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) client.postMessage({ type: SW_MESSAGE.FORCE_UPDATE });
    return;
  }

  if (!isKillSwitchTripped(descriptor, BUILD_ID)) return;

  // eslint-disable-next-line no-console
  console.warn('[sw] kill-switch tripped; unregistering', { BUILD_ID, descriptor });
  await wipeAllCaches();
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: SW_MESSAGE.KILLED });
  await self.registration.unregister().catch(() => {});
  for (const client of clients) {
    try {
      await (client as WindowClient).navigate((client as WindowClient).url);
    } catch {
      // the app also hard-reloads itself on the KILLED message
    }
  }
}

async function wipeAllCaches(): Promise<void> {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((k) => k.startsWith(CACHE_PREFIX) || k.startsWith('workbox-'))
      .map((k) => caches.delete(k))
  );
}

/** Best-effort cleanup of caches from a prior SW design (v1 glob precache). */
async function dropStrayCaches(): Promise<void> {
  const keys = await caches.keys();
  const known = new Set<string>([
    ...Object.values(RUNTIME_CACHES),
    `${CACHE_PREFIX}google-fonts-css`,
    `${CACHE_PREFIX}media`,
  ]);
  await Promise.all(
    keys
      .filter(
        (k) =>
          (k.startsWith(CACHE_PREFIX) && !known.has(k)) ||
          // v1 used Workbox's default precache name.
          k.startsWith('workbox-precache')
      )
      .map((k) => caches.delete(k))
  );
}

// Opportunistic kill-switch re-check on navigation, throttled to the interval.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.waitUntil(checkVersionDescriptor('interval'));
  }
});
