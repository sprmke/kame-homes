/// <reference lib="webworker" />
/**
 * Retirement service worker for the old origin (`kamehomes.space`).
 *
 * Why this exists (P0-3): `ui/vercel.json` 301-redirects every path on the old
 * host, including `/sw.js`. A browser refuses to install a service worker whose
 * script was redirected, so an already-installed app on the old origin could never
 * update or receive the kill-switch and kept serving its precached shell forever.
 *
 * `/sw.js` and `/pwa-version.json` are now excluded from that redirect and this
 * script is served at `/sw.js` on the legacy host only (Vercel host-scoped
 * rewrite). It takes over, wipes every app cache, unregisters itself and moves each
 * open window to the same path on the canonical origin.
 *
 * Plain JS on purpose: it must not depend on the app bundle or the build.
 */
const CANONICAL_ORIGIN = 'https://kamespace.com';
const CACHE_PREFIXES = ['gfm-', 'workbox-'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

async function wipeCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .map((key) => caches.delete(key))
  );
}

async function wipeIndexedDb() {
  if (typeof indexedDB === 'undefined' || !indexedDB.databases) return;
  try {
    const databases = await indexedDB.databases();
    await Promise.all(
      databases
        .filter((db) => db.name && CACHE_PREFIXES.some((prefix) => db.name.startsWith(prefix)))
        .map(
          (db) =>
            new Promise((resolve) => {
              const request = indexedDB.deleteDatabase(db.name);
              request.onsuccess = request.onerror = request.onblocked = () => resolve();
            })
        )
    );
  } catch {
    // Older Safari has no `indexedDB.databases()`; the app-side purge still runs.
  }
}

function canonicalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl, self.location.origin);
    if (url.origin === CANONICAL_ORIGIN) return url.href;
    return `${CANONICAL_ORIGIN}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return `${CANONICAL_ORIGIN}/`;
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await wipeCaches();
      await wipeIndexedDb();

      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of windowClients) {
        client.postMessage({ type: 'gfm:retired', url: CANONICAL_ORIGIN });
        try {
          await client.navigate(canonicalUrl(client.url));
        } catch {
          // Some clients refuse navigation; they follow on the next open.
        }
      }
      await self.registration.unregister().catch(() => {});
    })()
  );
});

// Never serve cached content from the retired origin again.
self.addEventListener('fetch', () => {
  // No respondWith: every request goes straight to the network (which redirects).
});
