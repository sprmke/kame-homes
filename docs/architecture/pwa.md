---
title: 'PWA — installable app, service worker, push, offline'
status: active
tags: [architecture, pwa, service-worker, offline, notifications]
updated: 2026-09-02
---

# PWA — installable app, service worker, push, offline

Part of the [`docs/PROJECT.md`](../PROJECT.md) architecture split.
Plan: [`docs/workflow/for-testing/pwa-installable-offline-push.md`](../workflow/for-testing/pwa-installable-offline-push.md).

---

## 1. What ships

The whole origin is one installable PWA (one manifest, one service worker, `scope: "/"`). Feature depth is **tiered**:

| Tier                         | Surfaces                                                        | Install              | Offline read                               | Offline write                                   | Push                                                 |
| ---------------------------- | --------------------------------------------------------------- | -------------------- | ------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------- |
| **A — Host/admin dashboard** | `/for-hosts/login`, `/bookings/*`, `/org/*`, `/admin/*`         | ✅                   | ✅ allowlist                               | ✅ inbox text replies (transitions = follow-up) | ✅ all Notification Center events, per-device opt-in |
| **B — Guest portal**         | `/account/*`                                                    | ✅                   | ✅ messages / profile / vouchers / tickets | —                                               | — (needs a guest notification model — follow-up)     |
| **C — Public / anon**        | booking `form`, `sd-form`, `pay-parking`, marketing, stay-guide | ✅ installable shell | shell + last-viewed page                   | —                                               | —                                                    |

Platform support: desktop Chrome/Edge/Firefox + Android work fully. **iOS/iPadOS: push and reliable SW need the app installed to the Home Screen** (16.4+); the "Notifications on this device" control is hidden until then.

## 2. Build wiring

- **`ui/vite.config.ts`** — `VitePWA({ strategies: 'injectManifest', srcDir: 'src/pwa', filename: 'sw.ts', registerType: 'prompt', injectRegister: false })`. The manifest is defined inline in `gfmPwaPlugin()`. `injectManifest` (not `generateSW`) because the SW hand-rolls push / sync / periodicsync / kill-switch handlers.
- **Vite stays on 4.4** — `vite-plugin-pwa@1.3.0` supports Vite `^3..^8` (verified via its `peerDependencies`); no upgrade needed.
- **`__PWA_BUILD_ID__`** — epoch-seconds `define` in `vite.config.ts`; the SW kill-switch and the query-persist `buster` compare against it.
- **Precache budget** — `scripts/pwa/precache-globs.json` is the single source of truth for `globPatterns` / `globIgnores` / `budgetKiB` (12800). `scripts/pwa/check-precache-budget.mjs` runs at the end of `bun run build` (so CI enforces it) and fails if the precache set exceeds budget. Heavy feature-lazy chunks (Polotno studio, mediabunny encoders, html2canvas, `browser-image-compression`) are `globIgnores`d and runtime-cached on demand instead.
- **Icons** — `scripts/pwa/generate-icons.mjs` (root `sharp` devDep) → `ui/public/icons/` (`pwa-{192,512}.png` any, `pwa-maskable-{192,512}.png`, `apple-touch-icon.png`, `notification-badge.png`). Re-run after changing `ui/public/favicon/web-app-manifest-512x512.png`.
- **`ui/index.html`** — iOS `<meta>` tags + dual `theme-color`; fallback `<title>`, `application-name`, and `apple-mobile-web-app-title` are **Kame Homes**. The plugin injects `<link rel="manifest">`. The old `favicon/site.webmanifest` link was removed.
- **`ui/vercel.json`** — `sw.js` served `no-cache` + `Service-Worker-Allowed: /`; `manifest.webmanifest`, `offline.html`, `pwa-version.json` served `no-cache`/`no-store`. Applies to both Vercel projects (`guest-form-management-app`, `kame-homes`) — same file.

## 3. Service worker (`ui/src/pwa/sw.ts`)

Worker-only (never imports `@/…` app code — that would pull DOM modules into the worker). Type-checked with `ui/src/pwa/tsconfig.json` (WebWorker lib), wired into `bun run type-check` / `build`. Shared constants live in `ui/src/pwa/shared.ts` (importable by app + worker).

| Concern                  | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Precache                 | `precacheAndRoute(self.__WB_MANIFEST)` + `cleanupOutdatedCaches()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Navigation               | `NavigationRoute` → precached `index.html`; falls back to `offline.html` when the shell isn't cached; `denylist` for `/functions/`, `/api/`, `/auth/`, file-looking paths                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Runtime caches (`gfm-*`) | Google Fonts CSS (SWR) + files (CacheFirst 1y), Supabase Storage images (SWR, 80 entries / 30d / `purgeOnQuotaError` — opaque responses pad ~7 MB each toward quota), `/assets/*` chunks (SWR), allowlisted read-only Edge Function GETs (NetworkFirst, 6s timeout, 3d max-age; `RUNTIME_CACHES.api`) — **except** `get-booking`/`list-bookings`, which get their own cache (`RUNTIME_CACHES.bookingStatus`, same NetworkFirst/6s timeout but a 10-minute max-age) since booking status is operator-actionable and a multi-day-stale fallback would be misleading, not just cosmetic. **No `setDefaultHandler`** — POSTs, SSE (dashboard assistant), auth pass straight to the network |
| Update                   | `install` does **not** `skipWaiting`; the app prompts, then posts `SKIP_WAITING` (or `gfm:skip-waiting`) → `self.skipWaiting()` + `clientsClaim()` on `activate`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Kill-switch              | fetches `/pwa-version.json` (`{ disabled, minBuild }`) on `activate`, throttled on each navigation, and on a `gfm:check-version` message. If `disabled` or `minBuild > __PWA_BUILD_ID__`: wipe all `gfm-*` + `workbox-*` caches, `postMessage KILLED` to clients, `registration.unregister()`, navigate clients to a clean reload                                                                                                                                                                                                                                                                                                                                                      |
| Push                     | `push` → `showNotification` (icon + `notification-badge.png` + `tag` + `renotify` + `data.path`); `notificationclick` → focus an existing same-origin client + `postMessage NOTIFICATION_CLICK`, else `openWindow(path)`; `pushsubscriptionchange` → best-effort local re-subscribe + `PUSH_RESYNC` to clients                                                                                                                                                                                                                                                                                                                                                                         |
| Background Sync          | `sync` (tag `gfm-outbox-drain`) → wake clients with `DRAIN_OUTBOX` (the SW can't replay — each request needs the app's fresh JWT); rejects if no client so the browser retries                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Periodic Sync            | `periodicsync` (tag `gfm-periodic-refresh`) → `REVALIDATE` message → clients invalidate `bookings` / `notifications` / `dashboard-stats`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

App-side glue: **`ui/src/components/pwa/PwaProvider.tsx`** (mounted in `App.tsx`) registers the SW via **`@/lib/pwa/useRegisterSW`** (`workbox-window` — not `virtual:pwa-register/*`), renders `UpdatePrompt` / `OfflineBanner` / `InstallPrompt`, reacts to `KILLED` (→ `purgeOfflineState` + reload), polls `registration.update()` hourly + on foreground, requests `navigator.storage.persist()` on idle, registers periodic sync, and calls `initSyncEngine(queryClient)`. Under plain `vite` serve the hook is a no-op stub so HMR is never contested.

### Local dev

The SW is **off** under `vite` dev (would fight HMR). Test it with `bun run build && cd ui && bun run preview`, or set `VITE_PWA_DEV=true`. To clear a stuck SW: DevTools → Application → Service Workers → Unregister, then hard-reload.

## 4. Offline read

- **App shell** — precache + `navigateFallback`. A cached page boots offline; the SPA then shows `OfflineBanner` and serves stale query data.
- **Query cache** — `@tanstack/react-query-persist-client` + an `idb-keyval`-backed `AsyncStoragePersister` (`ui/src/lib/pwa/queryPersister.ts`), keyed **per signed-in identity** (`user-<uuid>` / `anon`) so a shared device never restores one viewer's cache into another's session. `maxAge` 24h, `buster: __PWA_BUILD_ID__`. Wired by `ui/src/components/pwa/PwaQueryPersistence.tsx`; `queryClient.clear()` + `purgeOfflineState()` on `SIGNED_OUT`.
- **Allowlist** — `ui/src/lib/pwa/offlineQueryAllowlist.ts` (`OFFLINE_PERSIST_KEY_ROOTS`) is **canonical**. Only allowlisted query-key roots with `status === 'success'` are written to IndexedDB. **Adding a root is a deliberate decision** (it puts operator PII on a possibly shared, unencrypted-at-rest device that's wiped on logout) — see `.cursor/rules/pwa.mdc`.
- **Persistent storage** — `requestPersistentStorage()` asks for durable storage; `getStorageEstimate()` exposes usage/quota. Eviction: Workbox `ExpirationPlugin` `purgeOnQuotaError` on runtime caches; the query persister drops its largest entries first and retries.

## 5. Push notifications

```
booking transition / webhook / cron
  → _shared/notificationService.ts#createNotification            (unchanged — inserts a `notifications` row)
      → trigger trg_notifications_push_fanout_{ins,upd}  (INSERT, or a coalesced
         UPDATE where created_at moved — matches the in-app realtime rule)
          → notify_push_fanout()  → pg_net POST → supabase/functions/push-fanout   (X-Push-Fanout-Secret)
              → _shared/pushRecipients.ts: recipients = org owner + active organization_members
              → load push_subscriptions (disabled_at IS NULL)
              → _shared/webPushService.ts (jsr @negrel/webpush, concurrency 20)
              → 404/410 → disable subscription; 429/5xx → failure_count++ (retire at 5)
  → SW push → showNotification → notificationclick → focus/navigate
```

- **VAPID** — `scripts/pwa/generate-vapid-keys.mjs` (Node Web Crypto, no dep) prints `VITE_VAPID_PUBLIC_KEY` (base64url raw public key, UI env — all Vercel projects), `VAPID_KEYS` (JWK pair JSON, Supabase secret), `VAPID_SUBJECT` (`mailto:` — Supabase secret). Also set the Supabase secret **`PUSH_FANOUT_SECRET`** and the Vault secret **`push_fanout_secret`** (same value) for the trigger.
- **`push_subscriptions`** — one row per device endpoint (`endpoint` unique). RLS: owner select/delete; writes via edge functions (service role). See [[data-model]].
- **Edge functions** — `push-subscribe` / `push-unsubscribe` (`serveAuthenticated`), `push-fanout` (`servePublic` + secret). All `verify_jwt = false` in `config.toml`. See [[edge-functions]].
- **Client** — `ui/src/lib/pwa/push.ts` (`getPushState` / `enablePush` / `disablePush` / `resyncPushSubscription`), `usePushNotifications` hook, `PushNotificationsCard` in the Notifications page. `enablePush` must be called from a user gesture (iOS). `NotificationsProvider` heals a rotated / server-pruned subscription on session start and sets the app icon badge from the bell unread count.
- **This changes the old "no OS notifications" rule** — OS push is now a first-class channel for **every** Notification Center event, gated on the per-device opt-in. See `.cursor/rules/notifications.mdc`.

### VAPID rotation

Keys are per-environment. Rotating invalidates every existing subscription; clients re-subscribe automatically on next load (`resyncPushSubscription` + `pushsubscriptionchange`). Procedure: generate a new pair → update `VITE_VAPID_PUBLIC_KEY` (redeploy UI) + `VAPID_KEYS` (Supabase secret). Old subscriptions 410 on the next fanout and are pruned by `reconcilePushFailures`.

### Delivery observability

`push-fanout` logs `[push-fanout] {notificationId,type,recipients,endpoints,sent,pruned,failed}` per run. Save a Supabase log query filtering `[push-fanout]` and alert on a rising `failed/sent` ratio. No stats table.

## 6. Offline write + sync (Tier A)

- **Outbox** — `ui/src/lib/pwa/outbox.ts`, an `idb` store `gfm-outbox` / `mutations`, FIFO by `createdAt`.
- **Enqueue** — `ui/src/lib/pwa/offlineMutation.ts#runOfflineMutation({ url, body, invalidateKeys, applyOptimistic })`: tries online first with a fresh JWT + `Idempotency-Key`; queues **only** on a connectivity failure. A server 4xx/5xx **re-throws** — a validation error must never be queued. Applies an optimistic cache update on queue.
- **Drain** — `ui/src/lib/pwa/syncEngine.ts#drainOutbox()`: FIFO, fresh JWT per drain, `Idempotency-Key` header. 2xx → remove + invalidate; 408/425/429/5xx → keep + an exponential-backoff self-retry (`2^attempts` s, cap 60s), then `failed` at 6 attempts; other 4xx → `failed` + invalidate (surface the server's real state). Triggers: `online`, `visibilitychange`, SW `DRAIN_OUTBOX`, the backoff timer, and on init. Background Sync tag registered best-effort (Chromium).
- **Server idempotency** — `_shared/idempotency.ts#withIdempotency(handler)` wraps `transition-booking`, `transition-parking-booking`, `social-inbox-send`. Claim-first: inserts a placeholder row (`request_idempotency`, `status = 0`) before running the handler, so a concurrent replay blocks and returns the stored response instead of double-executing. Releases the claim on non-2xx / throw. Opportunistic TTL sweep (~48h). See [[data-model]].
- **Wired** — inbox **text-only** replies (`useInbox` `sendReply`); attachment replies stay online-only. Booking-status transitions are online-only for v1 (WorkflowPanel couples them with file uploads; see the plan).
- **UI** — `SyncCenterCard` (pending + failed list, retry/discard, "Sync now", last-synced) in the Notifications page; `OfflineBanner` shows pending/syncing counts. `offlineSyncStore` (zustand) is the in-memory projection the sync engine keeps current. `purgeOfflineState` wipes the outbox + resets the store on logout.

## 7. Native-feel extras

`InstallPrompt` (title **Install {platform app name}**, default **Kame Homes**; Chromium `beforeinstallprompt` button + iOS instruction line, dismissal memory; on `max-lg` sits above the floating bottom tab bar via `aboveBottomTabBarOverlayClassName` so nav stays usable — same offset as `UpdatePrompt`; both use `z-[45]` so they stay under Sheet `z-50` / Dialog `z-100` and never cover choice sheets or modals), manifest `name` / `short_name` **Kame Homes**, `shortcuts` (`?shortcut=bookings|inbox` handled in `NotificationsProvider`), `ui/src/lib/pwa/share.ts` (Web Share + clipboard fallback), Periodic Background Sync, `ui/src/hooks/useWakeLock.ts` (kiosk mode), `ui/src/hooks/useOfflineFormDraft.ts` (generic form-draft persistence), `ui/src/lib/pwa/pwaTelemetry.ts` (event sink — point at a real analytics channel later). Feature detection: `ui/src/lib/pwa/capabilities.ts` — UI reads from here, never sniffs UA.

## 8. Security / privacy

- **Tenant isolation** — all Cache API + IndexedDB keys are `gfm-`-prefixed; the query persister is keyed per viewer id. `purgeOfflineState()` (on `SIGNED_OUT` and kill-switch) deletes every `gfm-*` / `workbox-*` cache, **empties** the owned IndexedDB stores via a store-level `clear()` (an open `idb` connection _blocks_ `deleteDatabase`, so `clear()` is what actually removes the bytes without a reload — `deleteDatabase` is still attempted as a next-reload fallback), unsubscribes push locally, clears the badge, and resets the sync store.
- **Cached data = what the viewer could already see.** RLS is not the boundary in this app (edge-function checks are); the offline cache holds only responses the viewer's own session fetched. IndexedDB is **not encrypted at rest** and is cleared on logout — documented tradeoff, keep the allowlist tight.
- **`push_subscriptions`** RLS is owner-only; `request_idempotency` is service-role-only. Both migrations add explicit `service_role` grants (RLS-enabled tables without grants fail "permission denied" — same lesson as `notifications`).
- **`push-fanout`** is secret-gated (`X-Push-Fanout-Secret`), never JWT-authed. The trigger only fires it when the Vault secret is present.

## 9. Deploy checklist

1. `bun run deploy:supabase:dev` (or prod with `kamewave`) — applies `20261303120000_push_subscriptions.sql`, `20261303120100_push_fanout_trigger.sql`, `20261303120200_request_idempotency.sql`, `20261303120300_push_fanout_on_coalesce.sql` and deploys `push-subscribe` / `push-unsubscribe` / `push-fanout`.
2. Set Supabase secrets: `VAPID_KEYS`, `VAPID_SUBJECT`, `PUSH_FANOUT_SECRET`.
3. Set Vault secrets (SQL): `push_fanout_secret` (= `PUSH_FANOUT_SECRET`); `project_url` + `anon_key` if not already present (shared with the calendar-sync cron).
4. Set `VITE_VAPID_PUBLIC_KEY` on every Vercel UI project; redeploy the UI.
5. Verify: install on Chrome desktop / Android / iOS 16.4+; toggle "Notifications on this device"; trigger a booking transition and confirm the push arrives + click-through routes; toggle airplane mode on an inbox reply and confirm it queues + syncs.
6. **Server send path** (`@negrel/webpush` in the Deno edge runtime) is only exercisable after deploy — this is the one link not verified locally. Fallback if it misbehaves: swap `_shared/webPushService.ts` to npm `web-push`.

## 10. Kill-switch runbook

To disable the SW for every installed client (bad deploy): edit `ui/public/pwa-version.json` → `"disabled": true` and redeploy (or serve that one file changed). Within ~6h (or on next foreground / navigation) every SW unregisters, wipes its caches, and reloads clients onto the plain network app. To retire only old builds, set `"minBuild"` to a recent epoch-seconds value instead.
