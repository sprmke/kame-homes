/// <reference lib="webworker" />
/**
 * Guest Form Management — custom service worker (Workbox `injectManifest`).
 *
 * Responsibilities, by plan phase:
 *   1. Precache the app shell; SPA navigation fallback; offline fallback page;
 *      update-on-demand (`SKIP_WAITING`); kill-switch (`/pwa-version.json`).
 *   2. Runtime caching for fonts / images / static assets / allowlisted API GETs.
 *   3. Web Push: `push`, `notificationclick`, `pushsubscriptionchange`.
 *   4. Offline write: Background Sync `sync` handler draining the outbox.
 *   5. Periodic Background Sync refresh.
 *
 * Never import app (`@/…`) code here — it would pull DOM-only modules into the
 * worker bundle. Worker-only. See docs/architecture/pwa.md.
 */
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

import {
  CACHE_PREFIX,
  OUTBOX_SYNC_TAG,
  PERIODIC_REFRESH_TAG,
  PWA_VERSION_CHECK_INTERVAL_MS,
  PWA_VERSION_URL,
  RUNTIME_CACHES,
  SW_MESSAGE,
} from './shared';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};
declare const __PWA_BUILD_ID__: string;

const BUILD_ID = Number(__PWA_BUILD_ID__) || 0;
const OFFLINE_URL = 'offline.html';

// ───────────────────────────── precache ──────────────────────────────────────

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ─────────────────────────── lifecycle ───────────────────────────────────────

self.addEventListener('install', () => {
  // Do NOT skipWaiting automatically — the app prompts the user, then posts
  // SKIP_WAITING. This keeps a running operator from being reloaded mid-edit.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await dropStrayCaches();
      await checkKillSwitch('activate');
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string } | undefined;
  if (!data?.type) return;

  // `SKIP_WAITING` is what vite-plugin-pwa's prompt register posts; the prefixed
  // constant is for anything else the app sends directly.
  if (data.type === SW_MESSAGE.SKIP_WAITING || data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
    return;
  }
  if (data.type === SW_MESSAGE.CHECK_VERSION) {
    event.waitUntil(checkKillSwitch('message'));
    return;
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
 * their bookings + notifications caches, and refresh the NetworkFirst API cache
 * for anything already stored.
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

// ─────────────────────────── navigation ──────────────────────────────────────

const navigationHandler = createHandlerBoundToURL('index.html');

registerRoute(
  new NavigationRoute(
    async (options) => {
      try {
        return await navigationHandler(options);
      } catch {
        const cache = await caches.open(RUNTIME_CACHES.static);
        const cached = (await cache.match(OFFLINE_URL)) ?? (await caches.match(OFFLINE_URL));
        return cached ?? Response.error();
      }
    },
    {
      // Let the SW ignore these — they must always hit the network / other routes.
      denylist: [
        /^\/functions\//,
        /^\/api\//,
        /^\/auth\//,
        /\/[^/?]+\.[^/]+(\?.*)?$/, // anything that looks like a file request
      ],
    }
  )
);

// ─────────────────────── runtime caching (Phase 2) ───────────────────────────

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
    ],
  })
);

// Same-origin build assets not caught by precache (hashed lazy chunks etc.).
registerRoute(
  ({ url, request, sameOrigin }) =>
    sameOrigin &&
    url.pathname.startsWith('/assets/') &&
    (request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'worker'),
  new StaleWhileRevalidate({
    cacheName: RUNTIME_CACHES.static,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 60 * 60 * 24 * 30,
        purgeOnQuotaError: true,
      }),
    ],
  })
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

// Allowlisted read-only Edge Function GETs — NetworkFirst with a short timeout so
// the app stays live but can fall back to the last good copy offline. The
// allowlist itself is enforced app-side (`@/lib/pwa/offlineQueryAllowlist`); here
// we just cache any GET to a function whose name looks read-only. Booking status
// is excluded (see `BOOKING_STATUS_FUNCTION_RE` above) — it gets a much shorter
// max age since staleness there is operationally misleading, not just cosmetic.
const READONLY_FUNCTION_RE =
  /\/functions\/v1\/(?!(?:get-booking|list-bookings)(?:[/?]|$))(get-|list-|dashboard-stats|finance-summary|finance-bookings|finance-line-items|maintenance-items|maintenance-summary|notifications-list|social-inbox-threads|social-inbox-messages|org-settings|property-templates-settings|parking-settings|guest-trips|guest-messages|guest-profile)/;

registerRoute(
  ({ url, request }) => request.method === 'GET' && READONLY_FUNCTION_RE.test(url.pathname),
  new NetworkFirst({
    cacheName: RUNTIME_CACHES.api,
    networkTimeoutSeconds: 6,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 3,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// No setDefaultHandler: unmatched requests (POSTs, SSE streams like the dashboard
// assistant, auth) pass straight to the network with no SW involvement.
setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    const cached = (await caches.match('index.html')) ?? (await caches.match(OFFLINE_URL));
    if (cached) return cached;
  }
  return Response.error();
});

// ─────────────────────────── web push (Phase 3) ─────────────────────────────

/** Only allow same-origin, app-relative click targets (defence in depth). */
function safeAppPath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

type PushPayload = {
  title: string;
  body?: string;
  path?: string;
  tag?: string;
  notificationId?: string;
  type?: string;
};

self.addEventListener('push', (event) => {
  let payload: PushPayload;
  try {
    payload = event.data?.json() as PushPayload;
  } catch {
    payload = { title: 'New notification', body: event.data?.text() };
  }
  if (!payload?.title) payload = { ...payload, title: 'New notification' };

  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: '/icons/pwa-192.png',
    badge: '/icons/notification-badge.png',
    tag: payload.tag ?? payload.notificationId ?? payload.type ?? 'gfm',
    data: { path: safeAppPath(payload.path), notificationId: payload.notificationId ?? null },
  };
  // `renotify` re-alerts when a same-tag notification is replaced; not yet in the
  // TS lib's NotificationOptions.
  (options as NotificationOptions & { renotify?: boolean }).renotify = true;

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = safeAppPath((event.notification.data as { path?: unknown } | undefined)?.path);
  const targetUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        client.postMessage({ type: SW_MESSAGE.NOTIFICATION_CLICK, path });
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

// ──────────────────────────── kill-switch ────────────────────────────────────

let lastVersionCheck = 0;

/**
 * Fetches `/pwa-version.json`. If it says this build is disabled or below the
 * required floor, the SW wipes every cache, unregisters itself and tells open
 * clients to hard-reload onto the plain network app.
 *
 * `{ "disabled": false, "minBuild": 0 }`
 */
async function checkKillSwitch(reason: string): Promise<void> {
  const now = Date.now();
  if (reason === 'interval' && now - lastVersionCheck < PWA_VERSION_CHECK_INTERVAL_MS) return;
  lastVersionCheck = now;

  type VersionDescriptor = { disabled?: boolean; minBuild?: number };
  let descriptor: VersionDescriptor | null = null;
  try {
    const res = await fetch(`${PWA_VERSION_URL}?t=${now}`, { cache: 'no-store' });
    if (res.ok) {
      const parsed: unknown = await res.json();
      if (parsed && typeof parsed === 'object') descriptor = parsed as VersionDescriptor;
    }
  } catch {
    return; // network down / malformed — never self-destruct on a failed check
  }
  if (!descriptor) return;

  const killed = descriptor.disabled === true || (descriptor.minBuild ?? 0) > BUILD_ID;
  if (!killed) return;

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

/** Best-effort cleanup of caches from a prior major SW design. */
async function dropStrayCaches(): Promise<void> {
  const keys = await caches.keys();
  const known = new Set<string>([
    ...Object.values(RUNTIME_CACHES),
    `${CACHE_PREFIX}google-fonts-css`,
  ]);
  await Promise.all(
    keys.filter((k) => k.startsWith(CACHE_PREFIX) && !known.has(k)).map((k) => caches.delete(k))
  );
}

// Opportunistic kill-switch re-check on navigation, throttled to the interval.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.waitUntil(checkKillSwitch('interval'));
  }
});
