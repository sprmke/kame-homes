---
title: 'PWA — installable app, service worker, precache tiers, push, offline'
status: active
tags: [architecture, pwa, service-worker, offline, notifications, install]
updated: 2026-11-01
---

# PWA — installable app, service worker, precache tiers, push, offline

Part of the [`docs/PROJECT.md`](../PROJECT.md) architecture split.
Current plan: [`docs/workflow/for-testing/pwa-v2-native-app-experience.md`](../workflow/for-testing/pwa-v2-native-app-experience.md) (v2, implementation complete — device QA remains).
Shipped v1 baseline: [`docs/workflow/for-testing/pwa-installable-offline-push.md`](../workflow/for-testing/pwa-installable-offline-push.md).

---

## 1. Shape of the app

The whole origin is one installable PWA (one manifest, one service worker, `scope: "/"`). Capability is **tiered by route**, and the tier table lives in code —
`ui/src/lib/pwa/routeCapabilities.ts` — so the install offer, the precache tier and the offline behaviour of every route are one decision, not three.

| Tier                       | Surfaces                                                                          | Install offer                            | Offline read                                  | Offline write                              | Push                |
| -------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------- | ------------------------------------------ | ------------------- |
| **A — Host / operator**    | `/org/**` (dashboard, bookings, inbox, finance, pricing, maintenance, analytics…) | proactive (engaged hosts only)           | allowlisted reads + booking status            | inbox text replies, notification mark-read | Notification Center |
| **B — Guest portal**       | `/account/**`, `/properties/:slug/**`, `/parkings/:slug/**`                       | passive; inline card on `/account/trips` | last viewed page (SW API cache) + form drafts | none (drafts are local)                    | not yet (own plan)  |
| **C — Public / anonymous** | marketing, legal, auth, booking form, sd-form, pay-parking                        | passive only; **blocked** mid-task       | shell + last viewed page                      | none                                       | —                   |
| **Staff**                  | `/admin/**`                                                                       | passive only                             | none (online only)                            | none                                       | —                   |

The full per-route contract (install offer / precache tier / offline mode) is the table in the plan, §6, and is asserted by `routeCapabilities.test.ts`.

### Launch routing

`start_url` is **`/app?source=pwa`**, never `/`. `/app` (`ui/src/features/launch/pages/AppLaunchPage.tsx`) is a resolver with no UI:

1. Signed-in host with an org → `resolvePostSignInPath('/org')` (last org + last property/parking), then the `?shortcut=` is applied to that dashboard.
2. Signed-in super admin without an org → `/admin`.
3. Signed-in guest (no org) → `/account`.
4. Signed out → host login with a return path if this device has hosted before (`gfm:install:memory.hostInstall`), else the public landing.
5. Offline cold start → the last tenant dashboard, so an installed host app opens on cached data instead of a blank screen.

Shortcuts (`bookings`, `inbox`, `checkins`) are resolved **here**, not inside `AdminLayout` — v1 handled them in `NotificationsProvider`, which only mounts inside the dashboard, so the shortcuts did nothing (P0-1). `checkins` maps to the bookings list filtered to today's arrival date in **Asia/Manila**.

## 2. Build wiring

- **`ui/vite.config.ts`** — `VitePWA({ strategies: 'injectManifest', srcDir: 'src/pwa', filename: 'sw.ts', registerType: 'prompt', injectRegister: false })`.
  The manifest lives in `ui/src/pwa/manifest.ts` (`buildWebAppManifest(platformAppName)`) so it can be snapshot-tested.
- **Vite 7.3.7** (the v1 doc said 4.4 — that was stale).
- **`__PWA_BUILD_ID__`** — epoch-seconds `define`; the kill-switch, `forceUpdateBelow` and the query-persist `buster` compare against it.
- **Precache tiers** — `scripts/pwa/precache-globs.json` is the single source of truth. `scripts/pwa/generate-precache-tiers.mjs` runs as a `closeBundle` step, reads `dist/.vite/manifest.json`, and writes `dist/precache-tiers.json`:
  - **shell** — precached on install for every visitor (`features/guest/**`, the entry, vendored shell deps, `index.html`, `offline.html`, icons). Target ≤ 4.5 MiB.
  - **host** — warmed into the runtime cache after a host signs in (or immediately in standalone) on Wi-Fi/unmetered.
  - **on-demand** — never precached (editors, PDF render/export, charts, video, media compression); runtime-cached the first time a route needs them.

  Classification is by **source folder plus the import graph** (a chunk inherits the lightest tier of its importers, so a shared vendor chunk reaches the shell tier whenever shell code needs it). `scripts/pwa/check-precache-budget.mjs` fails the build on a shell / host / total budget overrun.

- **Icons + splash + screenshots** — `scripts/pwa/generate-icons.mjs` (icons, monochrome, shortcut glyphs, iOS launch screens) and `scripts/pwa/generate-screenshots.mjs` (install-dialog screenshots). Both write into `ui/public/`.
- **`ui/index.html`** — one `theme-color` meta (kept in sync by `theme-init.js` before first paint and by `ThemeProvider` on an in-app toggle), `apple-touch-startup-image` links for the current device sizes (light + dark), `interactive-widget=resizes-content` in the viewport.
- **`ui/vercel.json`** — `sw.js` served `no-cache` + `Service-Worker-Allowed: /`; `precache-tiers.json` and `pwa-version.json` `no-store`; `offline.html` `no-cache`; splash/icons long-lived. The legacy-apex redirects **must not** catch `sw.js`, `pwa-version.json`, `manifest.webmanifest`, `precache-tiers.json` or `retirement-sw.js` — a redirected service worker script can never install, which stranded every install on the old origin (P0-3). `ui/src/lib/legacyApexRedirects.test.ts` asserts this.

## 3. Service worker (`ui/src/pwa/sw.ts`)

Worker-only (never imports `@/…` app code). Type-checked with `ui/src/pwa/tsconfig.json` (WebWorker lib). Pure helpers live in `ui/src/pwa/swLogic.ts` and are unit-tested (`swLogic.test.ts`); shared constants are in `ui/src/pwa/shared.ts`.

| Concern                  | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Precache                 | Custom `PrecacheController` (`gfm-precache`). **The tier list is rebuilt on every worker start** from a cached copy of `/precache-tiers.json`, not only during `install` — a worker is stopped aggressively by the browser, and a list that existed only in the install handler left the app unable to boot offline. The copy is stored under a **build-scoped cache key** (`/precache-tiers.json?b=<buildId>`) and validated against the worker's `__PWA_BUILD_ID__` (`isTiersManifestForBuild`): the list holds hashed asset names, so reading a previous build's list made every later worker precache and serve the build that was live at the user's first install. |
| Navigation               | **Network-first while online** (`navigationResponse`): the current `index.html` is fetched (3s cap, `redirect: 'follow'`, `cache: 'no-cache'`); the precached shell answers when offline or the network is slow, then `offline.html`. `denylist` for `/functions/`, `/api/`, `/auth/`, file-looking paths. Cache-first navigation was the reason a plain reload after a deploy kept serving the previous build's shell (and its removed chunks), which showed "Something went wrong" until a hard refresh.                                                                                                                                                               |
| Chunk-load recovery      | `reloadForChunkError` (`ui/src/lib/chunkReload.ts`) runs from both error boundaries and Vite's `vite:preloadError`: 1) reload, 2) unregister the worker then reload (a tab still on a pre-network-first worker), 3) give up and show the crash UI. The crash UI's Reload button always unregisters the worker first (`resetAppShellAndReload`), so it can never re-enter a stale shell loop.                                                                                                                                                                                                                                                                             |
| Build assets             | `gfm-static` runtime cache, resolved precache → runtime cache → network (a plain `CacheFirst` would miss precached shell chunks on the second visit)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Runtime caches (`gfm-*`) | Google Fonts (SWR + 1y), Supabase Storage images (SWR, 80 entries / 30d / `purgeOnQuotaError`), public Edge Function GETs (`SW_CACHEABLE_FUNCTIONS`, NetworkFirst 6s / 10 min), booking status (NetworkFirst 6s / 10 min, separate cache). No `setDefaultHandler` — POSTs / SSE / auth go straight to the network                                                                                                                                                                                                                                                                                                                                                        |
| Updates                  | `install` never `skipWaiting`; the update controller decides (see §5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Kill-switch              | `/pwa-version.json` → `{ disabled, minBuild, forceUpdateBelow }`. `disabled`/`minBuild` wipes caches + unregisters; `forceUpdateBelow` only asks the app to show the blocking update sheet. Checked on `activate`, throttled on navigation, and on a `gfm:check-version` message                                                                                                                                                                                                                                                                                                                                                                                         |
| Push                     | `push` → `showNotification` (icon, badge, `tag`, `renotify`, actions Open / Mark read, truncated body) + **per-user `unreadCount` → `setAppBadge`**; `notificationclick` → focus + `postMessage`, else `openWindow`; `pushsubscriptionchange` → re-subscribe + `PUSH_RESYNC`                                                                                                                                                                                                                                                                                                                                                                                             |
| Background Sync          | `sync` (`gfm-outbox-drain`) → wake clients with `DRAIN_OUTBOX` (the SW cannot replay; each request needs the app's fresh JWT)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Periodic Sync            | `periodicsync` (`gfm-periodic-refresh`) → `REVALIDATE` → clients invalidate `bookings` / `notifications` / `dashboard-stats`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Supported app→SW messages: `SKIP_WAITING`, `CHECK_VERSION`, `WARM_HOST_TIER`, `SET_BADGE`, `CLOSE_NOTIFICATIONS`. SW→app: `KILLED`, `FORCE_UPDATE`, `REVALIDATE`, `PUSH_RESYNC`, `NOTIFICATION_CLICK`, `WARM_DONE`.

### API cache allowlist

`SW_CACHEABLE_FUNCTIONS` (`ui/src/pwa/shared.ts`) is the **canonical, explicit** set of Edge Function names the SW may runtime-cache as a GET. Every entry must be a genuinely public read whose server classification is `publicStatic` / `publicDynamic` / `publicAvailability`. `ui/src/lib/pwa/swCacheableFunctions.test.ts` enforces three things: the function exists on disk, its own source declares a public cache class, and its name follows the public-read convention. Adding a name is a security decision.

The SW also refuses to store a response whose `Cache-Control` is `private` or `no-store`, and never matches `get-public-showcase?preview=1` / `?embed=1`.

### Local dev

The SW is **off** under `vite` dev (it would fight HMR). Test it with `bun run build && cd ui && bun run preview`, `bun run test:e2e:pwa`, or set `VITE_PWA_DEV=true`.
To clear a stuck SW: DevTools → Application → Service Workers → Unregister, then hard-reload.

## 4. Install experience

`ui/src/lib/pwa/installEligibility.ts` is the single decision point: it takes capabilities, platform, route, viewer role, engagement counters, dismissal history and current UI state and returns `{ show: false, reason }` or `{ show: true, variant, placement }`. Components only render.

- **Never offered**: already installed / standalone, in-app browsers (Facebook, Messenger, Instagram, TikTok, LINE, Viber, Google app, Telegram), browsers that cannot install, mid-task routes (`routeCapabilities.installOffer === 'blocked'`), a dirty unsaved-changes guard, an open sheet/dialog, another PWA surface, the first page view of a session, the first-ever visit, and during a dismissal cooldown.
- **Who gets a proactive offer**: an engaged host (a value moment, or a 2nd session within 7 days on mobile / 3rd session on desktop). Guests with an upcoming trip get an inline card on `/account/trips`. Anonymous visitors never get a floating offer — only the permanent entry point.
- **Cooldown**: dismissal 1 → 14 days, 2 → 30 days, 3 → 90 days, 4+ → passive entry only. "Don't ask again" ends proactive offers.
- **Variants**: Chromium native `beforeinstallprompt`; iOS/iPadOS Safari step guide (version-aware: iOS 26 moved Share behind "…"); other iOS browsers get an "open in Safari" path; macOS Safari 17+ "Add to Dock"; Android overflow-menu guide.
- **Memory** (`ui/src/lib/pwa/installMemory.ts`, `gfm:install:memory`) is **device-scoped on purpose**: it survives sign-out so a later cold launch goes to host login instead of the public marketplace, and it is therefore _not_ part of `purgeOfflineState`.
- **Permanent entry**: `InstallAppEntry` in the admin More sheet, the marketing More sheet/footer, and Help & Support (`AppInfoCard`, which also shows the build id and a "Check for updates" action).
- **First standalone launch**: one-time welcome sheet. On iOS the installed app has separate storage from Safari, so it explains the sign-in and offers notifications behind a real user gesture.
- **One surface at a time**: `ui/src/lib/pwa/pwaSurfaceStore.ts` arbitrates kill notice > forced update > offline strip > update prompt > push ask > install offer.

### First launch

`FirstLaunchWelcome` shows **only when the app is running installed** (`useDisplayMode().standalone`). It explains that an iOS install has its own storage, offers a one-tap sign-in with the return path, and asks for notifications behind a real user gesture. It is marked seen once. It must never open in a browser tab: an earlier build keyed only off the device flag and covered the guest landing page on every first visit.

## 5. Updates

`ui/src/lib/pwa/updateController.ts` (pure) + `useRegisterSW` (wiring).

- Phases: waiting → `needRefresh` → accepted → `controllerchange` → one reload.
- **Safe auto-apply** with no prompt when nothing would be lost (`canApplyNow`): no dirty unsaved-changes guard, no open sheet/dialog, no outbox drain, no in-flight task. Applied at the next route change, after ≥30 s in the background, or on cold start — installed apps are rarely closed, so waiting for a click meant updates never landed (P1-3).
- **"Later" snoozes 4 hours**, not the whole session.
- **Multi-tab** via `BroadcastChannel('gfm-pwa')`: one tab applies; the others reload only when their own guard is clean.
- **Loop guard**: at most two **automatic** reloads per tab session (`gfm:pwa:auto-reloads`). After the limit, auto-apply stops and the Update ready prompt is shown; tapping **Reload** / Force update always proceeds (`isUpdateApplyBlocked('user')` is never true). A 2s fallback reload covers the rare case where `skipWaiting` never fires `controllerchange`.
- **`forceUpdateBelow`** shows a blocking but polite sheet; caches are kept, so no reinstall is needed.
- `registration.update()` is throttled to once per 10 minutes.

## 6. Connectivity and offline UX

- **Three states** (`ui/src/lib/pwa/connectivity.ts`): `online`, `offline`, `degraded` (browser says online but requests fail — li-fi). Driven by real request outcomes reported from `callEdgeFunction`, cleared by the next success. No polling.
- **`OfflineBanner`** is anchored to the **bottom**, above the tab bar / contextual action bar. In v1 it was `fixed top-0 z-[55]` with no offset and covered page headers and the standalone status bar (P1-7). It shows when the device is offline or degraded, or when a change is waiting or failed. Tapping it opens the Sync Center only in that queued case. A background drain of an empty outbox stays invisible, including after **Clear offline data**, so the sheet cannot open as an empty close button.
- **Action-level gating**: `useConnectivity()` + `NeedsConnectionHint` for online-only actions. Applied today to notification-preference saves and the Sync Center; other online-only actions still fail with a toast (see §15).
- **Stale data label**: `StaleDataLabel` (`ui/src/lib/pwa/staleData.ts`) shows "Updated 2h ago" from the query's `dataUpdatedAt` **only** while offline or degraded. Wired into bookings, inbox and notifications.
- **Pull to refresh** (standalone): `usePullToRefresh` + `PullToRefreshIndicator` — a downward drag from the top of the list refreshes the query. Wired into bookings and inbox. Normal scrolling is untouched (the gesture only starts at `scrollTop === 0`).
- **Scroll restore across an update reload**: `ui/src/lib/pwa/scrollMemory.ts` saves the window plus `[data-admin-content-scroll]` offsets on `pagehide` and restores them once on the next mount of the same path. A normal navigation still starts at the top.
- **Resume**: after ≥60 s hidden, `PwaProvider` refreshes the Supabase session, reconnects the realtime socket (iOS drops sockets in the background) and refetches active queries.
- **Guest form drafts**: `ui/src/hooks/useOfflineFormDraft.ts`. Text values and file `Blob`s live in IndexedDB (`gfm-drafts`), 7-day TTL, never synced, cleared on submit and by `purgeOfflineState`. **Restoring is an explicit tap** on a toast, offered only after the server prefill has settled, so it can never race the `bookingId` `form.reset()` paths. Wired into the booking form and the parking registration form. The SD refund wizard is deliberately **not** drafted: its only local inputs are bank account fields, the flow is three short steps and server-prefilled, and keeping account numbers on a shared device is worse than retyping them.
- **Submit while offline**: booking submits are never queued (captcha, availability, payments); the draft is what survives.

## 7. Offline read

- **App shell** — shell-tier precache + navigation fallback.
- **Query cache** — TanStack `persistQueryClient` over an `idb-keyval` persister (`ui/src/lib/pwa/queryPersister.ts`), keyed **per signed-in identity** (`user-<uuid>` / `anon`) so a shared device never restores one viewer's cache into another's session. `maxAge` 24h, `buster: __PWA_BUILD_ID__`. `queryClient.clear()` + `purgeOfflineState()` on `SIGNED_OUT`.
- **Allowlist** — `ui/src/lib/pwa/offlineQueryAllowlist.ts` (`OFFLINE_PERSIST_KEY_ROOTS`) is canonical. Only allowlisted roots with `status === 'success'` and data are persisted; infinite queries are capped at two pages so a deep scroll cannot grow the cache without bound.
- **Persistent storage** — requested at the first standalone launch / when notifications are granted; `purgeOnQuotaError` on runtime caches; the persister drops its largest entries first and retries.

## 8. Push notifications

```
booking transition / webhook / cron
  → _shared/notificationService.ts#createNotification
      → trigger trg_notifications_push_fanout_{ins,upd} → pg_net POST → supabase/functions/push-fanout (X-Push-Fanout-Secret)
              → _shared/pushRecipients.ts: org owner + active org members
                                           + property_members / parking_members scoped to the notification,
                                             gated on `notifications:view` + the section leaf for the type
              → _shared/notificationPreferences.ts: drop users who muted the type group,
                                             or whose quiet window covers "now" (Asia/Manila)
              → load push_subscriptions (disabled_at IS NULL), grouped per user
              → _shared/webPushService.ts (jsr @negrel/webpush, concurrency 20), per-user `unreadCount`
              → 404/410 → disable subscription; 429/5xx → failure_count++ (retire at 5)
  → SW push → showNotification + setAppBadge → notificationclick → focus/navigate
```

- **Recipients** closed the v1 gap where property-only and parking-only team members got no push (P1-4). RBAC is enforced in `permissionForNotificationType`: a finance-scoped notification never reaches a member without `finance:view`.
- **One notification per message**: the inbox no longer fires a foreground `new Notification()` next to the push path (P1-6); a focused tab gets an in-app toast instead.
- **Reading in-app clears the OS tray** (`closeOsNotifications`) and the badge.
- **VAPID** — `scripts/pwa/generate-vapid-keys.mjs` prints `VITE_VAPID_PUBLIC_KEY` (UI env, every Vercel project), `VAPID_KEYS` (JWK pair JSON, Supabase secret), `VAPID_SUBJECT`. Also set `PUSH_FANOUT_SECRET` (Supabase secret) and the Vault secret `push_fanout_secret`.
- **Client** — `ui/src/lib/pwa/push.ts` (`getPushState` / `enablePush` / `disablePush` / `resyncPushSubscription` / `closeOsNotifications`), `usePushNotifications`, `PushNotificationsCard` on the Notifications page. `enablePush` must run inside a user gesture (iOS). `NotificationsProvider` heals a rotated / pruned subscription on session start.
- **Preferences (per user, global across orgs)** — `notification_preferences` (`20261316129000_notification_preferences.sql`) stores muted type groups and a quiet-hours window. Read by `push-fanout`; written by `notification-preferences` (authenticated) and edited on the Notifications page (`NotificationPreferencesCard` for groups, `QuietHoursCard` for the window, instant saves). Only the OS push is filtered — the in-app bell keeps every row. `calendar_sync_failing` bypasses quiet hours; a mute still wins. A missing row means "everything on", so no backfill exists.
- **Quiet hours** — `start > end` wraps midnight; `start === end` means "no window" (a mis-set form can never silence push for a full day). Local time comes from the stored IANA zone, not the server's.
- **Guest push (Tier B)** is **not** in this plan — it needs its own notification model; tracked separately.
- **Delivery observability** — `push-fanout` logs `[push-fanout] {notificationId,type,recipients,endpoints,sent,pruned,failed}`. Alert on a rising `failed/sent` ratio.

### VAPID rotation

Rotating invalidates every subscription; clients re-subscribe on next load. Procedure: generate a new pair → update `VITE_VAPID_PUBLIC_KEY` (redeploy UI) + `VAPID_KEYS` (Supabase secret). Old subscriptions 410 on the next fanout and are pruned.

## 9. Offline write + sync

- **Outbox** — `ui/src/lib/pwa/outbox.ts` (`gfm-outbox` / `mutations`), FIFO by `createdAt`.
- **Enqueue** — `runOfflineMutation`: tries online first with a fresh JWT + `Idempotency-Key`; queues **only** on a connectivity failure. A server rejection re-throws — a validation error is never queued. Applies an optimistic cache update.
- **Drain** — `drainOutbox`: FIFO, fresh JWT, `Idempotency-Key`. 2xx → remove + invalidate; 408/425/429/5xx → keep + exponential backoff (cap 60 s), `failed` at 6 attempts; other 4xx → `failed` + invalidate so the server's real state shows. Triggers: `online`, `visibilitychange`, SW `DRAIN_OUTBOX`, the backoff timer, init.
- **Server idempotency** — `_shared/idempotency.ts#withIdempotency` wraps `transition-booking`, `transition-parking-booking`, `social-inbox-send`, `notifications-mark-read`, and `guest-web-chat-messages`. Claim-first, releases the claim on non-2xx, opportunistic 48 h TTL sweep.
- **Wired offline writes**: host inbox text-only replies, guest portal text-only messages, notification mark-read / mark-all-read. Attachments, template replies, booking transitions and maintenance status stay online-only (uploads and irreversible email side effects — see the plan's D3).
- **UI** — `SyncCenterCard` (pending + failed, retry/discard, "Sync now", last synced), opened from the offline strip.

## 10. Security / privacy

- **Tenant isolation** — all Cache API + IndexedDB keys are `gfm-`-prefixed; the query persister is keyed per viewer id. `purgeOfflineState()` (on `SIGNED_OUT`, kill-switch, and "Clear offline data") deletes every `gfm-*` / `workbox-*` cache, clears the owned IndexedDB stores (store-level `clear()` — an open `idb` connection blocks `deleteDatabase`), clears drafts, unsubscribes push locally, and clears the badge.
- **Host-tier warming caches code only** — never API responses.
- **Cached data = what the viewer could already see.** RLS is not the boundary in this app (edge-function checks are); the offline cache holds only responses that viewer's session fetched. IndexedDB is **not encrypted at rest** and is cleared on logout — keep the allowlist tight.
- **Drafts hold guest PII** — device-local, 7-day TTL, cleared on submit and logout, never synced.
- **`push-fanout`** is secret-gated (`X-Push-Fanout-Secret`), never JWT-authed.
- **Launch/notification paths** are same-origin only: `/app` has no `next=` parameter, and the SW sanitises every click path (`safeAppPath`).
- **Notification preferences are per user, not per org** — RLS lets a user read/write only `user_id = auth.uid()`; `push-fanout` reads with the service client. It is a personal device preference, so `activity-log: N/A`.
- **External links** — every `target="_blank"` anchor sets `rel=noopener` and every `window.open(..., '_blank')` passes `noopener,noreferrer`; `ui/src/lib/pwa/externalLinks.test.ts` fails the build otherwise, because a standalone window has no browser chrome to escape from.

## 11. Retirement of a legacy origin

`ui/public/retirement-sw.js` is a standalone worker that wipes `gfm-*` / `workbox-*` caches and IndexedDB, unregisters, and navigates clients to the canonical origin. It is inert until the legacy host rewrites `/sw.js` to it. When the domain move goes live:

```json
{
  "source": "/sw.js",
  "has": [{ "type": "host", "value": "kamehomes.space" }],
  "destination": "/retirement-sw.js"
}
```

The in-app `LegacyOriginNotice` shows a one-time sheet when `VITE_CANONICAL_APP_ORIGIN` is set and `VITE_LEGACY_APP_HOSTS` contains the current host.

## 12. Deploy checklist

1. `bun run deploy:supabase:dev` — applies `20261303120000_push_subscriptions.sql`, `20261303120100_push_fanout_trigger.sql`, `20261303120200_request_idempotency.sql`, `20261303120300_push_fanout_on_coalesce.sql`, `20261316129000_notification_preferences.sql`; deploys `push-subscribe` / `push-unsubscribe` / `push-fanout` / `notifications-mark-read` / `notification-preferences`.
2. Supabase secrets: `VAPID_KEYS`, `VAPID_SUBJECT`, `PUSH_FANOUT_SECRET`.
3. Vault secrets: `push_fanout_secret` (= `PUSH_FANOUT_SECRET`), `project_url`, `anon_key`.
4. `VITE_VAPID_PUBLIC_KEY` on every Vercel UI project; redeploy the UI.
5. Verify: install on Chrome desktop / Android / iOS 16.4+; confirm the launch resolver opens the last dashboard; every shortcut lands correctly; airplane mode on bookings / inbox / stay-guide; queue a reply and sync; update while open (clean and dirty form); push arrives with the app closed, badge updates, click routes.
6. **Server send path** (`@negrel/webpush` in the Deno edge runtime) can only be exercised after deploy. Fallback: swap `_shared/webPushService.ts` to npm `web-push`.

## 13. Kill-switch runbook

To disable the SW for every installed client (bad deploy): edit `ui/public/pwa-version.json` → `"disabled": true` and redeploy that file. Within ~6 h (or on next foreground / navigation) every SW unregisters, wipes its caches and reloads onto the plain network app. To retire only old builds, set `"minBuild"` to a recent epoch-seconds value. To force an update without wiping, set `"forceUpdateBelow"` — those builds keep working but show a blocking update sheet.

`minBuild` is a monotonic floor: a rollback deploy built _before_ the current value retires itself on its next version check, so reset it to `0` in the rollback commit. It was set to `1793764300` on 2026-11-04 to retire every install built before the stale-shell fix (build-scoped precache tiers + network-first navigation); those clients wipe their caches, unregister and reload onto the fixed build once, then behave normally.

## 14. Testing

| Layer            | Command                           | Covers                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (Vitest)    | `bun run test`                    | `platform`, `installEligibility`, `installMemory`, `installPrompt`, `routeCapabilities`, `offlineQueryAllowlist`, `updateController`, `swLogic`, `outbox`, `syncEngine`, `purgeOfflineState`, `connectivity`, `pwaSurfaceStore`, `manifest` snapshot, `swCacheableFunctions`, `launchRouting`, `staleData`, `scrollMemory`, `notificationPreferences` parity, `externalLinks` |
| Edge (Deno)      | `bun run test:edge`               | `notificationPreferences` (groups, quiet hours, payload validation), `webPushService` (payload caps, batch, retire), `pushRecipients`                                                                                                                                                                                                                                         |
| E2E (production) | `bun run test:e2e:pwa`            | installability, manifest assets, shell-only precache, `/app` routing, offline deep link, `offline.html` CSP, Cache Storage allowlist                                                                                                                                                                                                                                          |
| Manual           | plan §13.4 (real-device QA sheet) | in-app browsers, OAuth returns, push on real hardware, splash, rotation                                                                                                                                                                                                                                                                                                       |

## 15. Accepted non-goals (documented, not built)

These were considered in the v2 plan and deliberately closed without code. Revisit only with a new product requirement.

| Capability                                                                | Why it is out                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Declarative Web Push (Safari 18.4+)                                       | `@negrel/webpush` sends RFC 8291 encrypted payloads; Safari's declarative format needs a different server payload shape and a `web_push` header path. The encrypted path already works on iOS 16.4+ standalone, so this adds maintenance for one browser generation.                                                |
| File Handling, Protocol Handlers, Contact Picker, Window Controls Overlay | No product flow needs them today (receipts and marketing files go through the in-app picker; desktop install stays `standalone`).                                                                                                                                                                                   |
| Web Share Target                                                          | Requires a manifest `share_target` + a service-worker POST handler; no host workflow consumes incoming shares yet.                                                                                                                                                                                                  |
| Route view transitions / haptics                                          | Cosmetic. `prefers-reduced-motion` already governs the existing motion.                                                                                                                                                                                                                                             |
| Pull to refresh on every list                                             | Shipped on bookings and inbox (the two lists operators scroll most). Other lists keep their explicit refresh and native browser behaviour rather than wrapping every scrollport.                                                                                                                                    |
| Custom scroll restoration on back/forward                                 | React Router's navigation already scrolls to top; history restoration is a separate UX decision, not an update-reload concern.                                                                                                                                                                                      |
| `NeedsConnectionHint` on every online-only control                        | The hook and the inline hint ship and are used on settings-style saves. Wiring every upload / payment / AI / marketing-publish button is a UI pass across ~9 unrelated modules, and disabling an action wrongly is worse than the toast those actions already show. Add the hint when that surface is next touched. |
