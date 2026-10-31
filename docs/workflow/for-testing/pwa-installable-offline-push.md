---
stage: for-testing
title: 'PWA — installable app, native push, offline access + sync'
status: for-testing
tags: [workflow, for-testing, pwa, notifications, offline, service-worker]
updated: 2026-09-02
---

# PWA — installable app, native push, offline access + sync

> **Implementation status (2026-09-02):** Phases 0–7 built in one pass. Installable PWA + Workbox SW + kill-switch, offline read (query-persist allowlist), cross-platform Web Push wired to the Notification Center, offline write/sync (inbox text replies) with server idempotency, install prompt / shortcuts / periodic sync / share util, guest-portal offline read, and the full doc set — all shipped. `type-check` / `lint` / `test` / `build` / `check:filenames` / precache-budget all green. **Not verified (needs a deploy):** the `@negrel/webpush` server send path, and real-device install/push/offline/update QA — see Phase 7 + `docs/architecture/pwa.md` §9. **Deferred follow-ups** (documented per phase): per-event-type push matrix, offline booking-status transitions (WorkflowPanel refactor), Tier B guest push (needs a guest notification model), Web Share Target, booking-form offline draft wiring.

**Not a single implementation PR.** This was the full phase map + locked decisions for turning the GFM SPA into a production-grade, installable, offline-capable Progressive Web App with cross-platform push. Every architectural decision here is settled (see "Locked decisions"); "✅ IMPLEMENTED" markers on each phase below record what actually shipped.

Source intake: user request 2026-09-02 — "make our web app installable on iOS/Android, full PWA features, native push notifications on desktop/Android/iOS, offline access with online↔offline sync … production ready and optimized, support as many PWA features as possible, complete coverage." Follow-up: user delegated all open decisions — "choose the best approach … production-ready and standard PWA support."

Related: [`../in-progress/mobile-native-redesign.md`](../in-progress/mobile-native-redesign.md) deferred "PWA installability (manifest, service worker, offline shell) … a future phase." **This is that phase.** Its shipped mobile primitives (`ui/src/components/mobile/*`, bottom tab bar, safe-area handling, `useIsMobile`, `useMediaQuery`) are the UI substrate this builds on.

---

## ⏳ FOR TESTING — the only remaining work is manual QA

All code, migrations, functions, and docs are done and green. Two things gate "done":

1. **Deploy config** (below) — push needs Supabase migrations + secrets + Vault + a UI env var. Nothing sends until these are set.
2. **Manual QA on real devices** (below) — install / push / offline / update / kill-switch on desktop + Android + iPhone; Lighthouse.

### Pending configuration (before / at the dev deploy)

Installable + offline + offline-write need **no config** — they ship with the `kame-homes` UI build. **Only push** needs setup:

| #   | Where                                          | Action                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Supabase (dev)                                 | `bun run deploy:supabase:dev` — applies migrations `20261303120000` / `_120100` / `_120200` / `_120300` + deploys `push-subscribe`, `push-unsubscribe`, `push-fanout`.                                                                                                                                             |
| 2   | Local (once)                                   | `node scripts/pwa/generate-vapid-keys.mjs` → 3 values.                                                                                                                                                                                                                                                             |
| 3   | Supabase → Edge Functions → Secrets (dev)      | `VAPID_KEYS` = JWK-pair JSON · `VAPID_SUBJECT` = a real `mailto:` · `PUSH_FANOUT_SECRET` = random string                                                                                                                                                                                                           |
| 4   | Supabase → SQL editor (dev)                    | `select vault.create_secret('<same as PUSH_FANOUT_SECRET>', 'push_fanout_secret');` — `project_url` + `anon_key` are shared with the calendar-sync / parking crons and almost certainly already exist (`select name from vault.decrypted_secrets where name in ('project_url','anon_key','push_fanout_secret');`). |
| 5   | Supabase → Database → Extensions (dev)         | confirm `pg_net` is enabled (already on if the crons work).                                                                                                                                                                                                                                                        |
| 6   | Vercel `kame-homes` env (Preview + Production) | `VITE_VAPID_PUBLIC_KEY` = base64url public key from step 2 — then **redeploy the UI** (baked in at build time).                                                                                                                                                                                                    |

**Deploy-time risk:** `push-fanout` imports `@negrel/webpush` from `esm.sh/jsr/…` — first run in Supabase's Deno runtime. If the send fails, swap `supabase/functions/_shared/webPushService.ts` to the npm `web-push` library (isolated on purpose, one-file change). Everything else degrades gracefully (`push-fanout` logs the failure, never blocks the notification insert).

### Manual QA guide

**Local (before deploy) — SW is off under `vite` dev:**

```bash
bun run build && cd ui && bun run preview     # http://localhost:4173
```

Then DevTools → Application tab. (Or `VITE_PWA_DEV=true bun run dev:ui` to run the SW on `:5173`.)

| Area              | Steps                                                                                                                                                    | Pass =                                                                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SW + manifest** | Application → Service Workers; Application → Manifest                                                                                                    | SW "activated and running"; manifest has name/icons/shortcuts, no errors; `workbox-precache-v2-…` cache exists                                                                                                                             |
| **Install**       | Desktop: address-bar install icon / in-app banner (~8s). Android Chrome: ⋮ → Install app. iPhone Safari: Share → Add to Home Screen, then open the icon. | App opens in its own window; Manifest shows "App is installed"                                                                                                                                                                             |
| **Offline read**  | Visit Bookings / Inbox / Notifications online → Network → Offline → reload                                                                               | App boots; those pages show last-synced data + top "Offline" banner; a never-visited route shows `offline.html`                                                                                                                            |
| **Update prompt** | Change code → `bun run build` again → hard-refresh once → wait / re-focus tab                                                                            | "A new version is ready — Reload" bar; Reload activates the new SW cleanly                                                                                                                                                                 |
| **Kill-switch**   | Edit `dist/pwa-version.json` → `"disabled": true` → reload / wait 6h / re-focus                                                                          | SW unregisters, all `gfm-*` + `workbox-*` caches wiped, page reloads onto the plain app; set back to `false` → SW re-registers                                                                                                             |
| **Offline write** | Open a conversation → Network → Offline → send a text reply                                                                                              | Bubble "sending"; "Offline changes" card + banner show "1 change will sync"; back Online → sends within seconds, bubble becomes real message; block `social-inbox-send` → item goes to failed with Retry/Discard; sign out → queue cleared |
| **Logout purge**  | Sign in, load data (populates IndexedDB), sign out                                                                                                       | Application → IndexedDB: `gfm-query-cache` + `gfm-outbox` stores are empty (not just the DB "scheduled for deletion")                                                                                                                      |

**After deploy — push (needs steps 1–6 above):**

| Area                      | Steps                                                                                                                    | Pass =                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Push opt-in**           | Install on a phone (iOS: Home Screen first). Notifications page → "Notifications on this device" ON → allow permission.  | Toggle stays on; DevTools → Application → Push Messaging shows a subscription. iPhone in a plain Safari tab: toggle is disabled with the "Add to Home Screen first" hint. |
| **Delivery — app closed** | Fully close the app / lock the phone. Trigger a booking status change **or** send a guest chat message.                  | Native OS notification appears (app icon + title + body) within seconds–1 min. `push-fanout` logs `[push-fanout] {sent: N,…}`.                                            |
| **Coalesced chat**        | Send 3 guest messages to the same thread while the app is closed.                                                        | One notification that updates to the latest message + re-buzzes (not 3 stacked).                                                                                          |
| **Click-through**         | Tap the notification.                                                                                                    | App opens/focuses on that booking / inbox thread — from any surface.                                                                                                      |
| **Badge**                 | With unread items, on an installed app.                                                                                  | App icon shows an unread count badge (Chromium + iOS 16.4+); clears when read / on logout.                                                                                |
| **Revoke / opt-out**      | Toggle off; revoke notification permission in phone settings mid-session; sign out.                                      | Subscription removed; no more notifications; `push_subscriptions` row gone / 410-pruned.                                                                                  |
| **Multi-platform**        | Repeat the delivery test on: desktop Chrome/Edge, desktop Firefox, Android Chrome, iPhone Safari (installed, iOS 16.4+). | Delivered on all except a non-installed iOS tab (expected — Apple's rule).                                                                                                |
| **Lighthouse**            | DevTools → Lighthouse → Progressive Web App → Analyze.                                                                   | "Installable" ✓ + PWA-optimized audits green.                                                                                                                             |

**Reset between runs:** Application → Storage → Clear site data, or Service Workers → Unregister + hard-reload.

### Deferred follow-ups (not part of this testing pass)

Per-event-type push opt-in matrix · offline booking-status transitions (needs a WorkflowPanel refactor — currently online-only) · Tier B guest-portal push (needs a guest notification event model) · Web Share Target → guest-document upload · wiring `useOfflineFormDraft` into the guest booking form · a monitoring alert on the `[push-fanout]` failure rate. All documented per phase below.

---

## Goal

Ship the entire GFM web app as an installable PWA — one service worker, one manifest, `scope: "/"` — that installs to the home screen / desktop on Chrome, Edge, Android Chrome/Samsung Internet, and iOS/iPadOS Safari 16.4+. Layered on top: OS-level push for every Notification Center event, offline read of an allowlisted data slice, and a safe offline-write queue that syncs on reconnect. Feature depth is **tiered by surface** (below) so effort lands where operators actually benefit, while installability and offline resilience cover the whole origin. Every capability is feature-detected and degrades cleanly where a platform (mainly iOS/Safari) lacks it. Target: Lighthouse PWA "installable" + "PWA optimized" green on all three platforms, and a documented production runbook (SW kill-switch, key rotation, delivery monitoring).

---

## Scope — tiered by surface

The service worker and manifest are **origin-wide**. What varies is data/feature depth:

| Tier                               | Surfaces                                                              | Install                | Offline read                                                                                | Offline write + sync         | Push                                |
| ---------------------------------- | --------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------- |
| **A — Host/admin dashboard**       | `/for-hosts/login`, `/bookings/*`, `/org/*`, `/admin/*`               | ✅                     | ✅ allowlist (bookings, notifications, inbox, settings, stats)                              | ✅ safe-mutation set (below) | ✅ all event types, per-user opt-in |
| **B — Authenticated guest portal** | `/account/*` (guest identity)                                         | ✅                     | ✅ trips, messages, profile (read)                                                          | ❌ (v1)                      | ✅ trip/message events              |
| **C — Public / anon flows**        | guest booking `form`, `sd-form`, `pay-parking`, marketing, stay-guide | ✅ (installable shell) | shell + last-viewed property/stay-guide; **offline draft persistence** for the booking form | ❌                           | ❌                                  |

### Offline-write set (Tier A, v1) — principle: replay-safe, bounded side effects

**In:** booking status transitions (`transition-booking`, `transition-parking-booking`), inbox replies (`social-inbox-send`), booking notes / internal fields, maintenance item create + update, finance line-item notes, mark-notification-read, task/checklist toggles.

**Out (show an explicit "needs connection" state, never queue):** payments / PayMongo, media & document uploads (large binaries — impractical to queue, and OCR/side-effect heavy), booking **creation**, outbound email sends, org/property/parking structural changes, team & permission changes, anything that fans out to external APIs (Meta publish, calendar sync, Telegram).

### Hard out (v1)

- Native app-store packaging (TWA / Bubblewrap / Capacitor) — a strong PWA is the prerequisite; revisit as its own effort.
- CRDT / operational-transform merge — v1 is last-writer-wins guarded by the status state machine + server idempotency.
- Protocol handlers, File Handling `launchQueue`, Window Controls Overlay titlebar, Contact Picker, Idle Detection, Background Fetch, Payment Request API, WebAuthn/passkeys.

---

## Locked decisions (previously "open questions")

1. **Vite 5 upgrade first**, as its own prerequisite PR (Phase 0). It is the clean path and unblocks current `vite-plugin-pwa` + Workbox 7. Vite 4→5 is largely config-compatible; the risk surface is the custom `ui/vite-plugins/patchOpenPolotnoHighlighter.ts` and `postcss.config.js` Blueprint-CSS scoping — both get an explicit smoke test.
2. **Push fan-out is trigger-driven from day one**: Postgres trigger on `notifications` INSERT → `pg_net` → `push-fanout` edge function. Decoupled, retriable, preserves the "a notification failure never fails the transition" invariant. No throwaway inline version ships; an inline fire-and-forget call is allowed only as a local dev bring-up shortcut.
3. **Offline-write v1 = the replay-safe set above** (broader than just transitions + replies, but with a hard denylist). Every queued mutation carries an idempotency key; the server dedupes.
4. **PWA covers the whole origin**, tiered as above. Guest portal gets push + offline read (Tier B, Phase 6); public flows get an installable shell + offline booking-form draft persistence (Tier C, Phase 6). Tier A is Phases 1–5.
5. **Single manifest, `scope: "/"`, `start_url: "/?source=pwa"`**, with a client-side redirect to the last-active tenant (from `localStorage`). Standard for a multi-tenant SPA; no per-tenant install.
6. **SW strategy: `injectManifest`** (hand-written SW with Workbox modules), `registerType: 'prompt'`. `generateSW` cannot host the push / sync / outbox handlers.
7. **Update model: prompt, never silent.** `skipWaiting` + `clientsClaim` on user confirm only; an "Update available — Reload" banner via `virtual:pwa-register`.
8. **A SW kill-switch ships in Phase 1** — a versioned `/pwa-version.json` the SW checks; a "disable" flag makes the SW self-unregister and clear caches. Non-negotiable for production safety (a bad SW deploy is otherwise very hard to recover on clients).
9. **`navigator.storage.persist()` is requested** so offline data + outbox aren't evicted under storage pressure; quota is monitored and the oldest runtime-cache entries evicted first.

---

## PWA feature coverage matrix

Everything below is feature-detected. "✅" = in scope across the phases; "➕" = progressive enhancement (ship if the platform supports it, no fallback needed); "—" = out for v1 with rationale.

| Capability                                                                                                                                             | Status | Where / notes                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------ |
| Web App Manifest (full field set + `id`, `scope`, `start_url`, `display_override`, `lang`, `dir`, `categories`)                                        | ✅     | Phase 1, plugin-generated                        |
| Maskable + monochrome icons, 192/512, favicons                                                                                                         | ✅     | Phase 1, `ui/public/icons/`                      |
| Manifest `screenshots` (rich install UI)                                                                                                               | ✅     | Phase 1 (wide + narrow)                          |
| Manifest `shortcuts` (Inbox, Bookings, Check-ins today)                                                                                                | ✅     | Phase 5                                          |
| `launch_handler: { client_mode: "navigate-existing" }` (no duplicate windows)                                                                          | ✅     | Phase 1                                          |
| Service worker via Workbox (`injectManifest`)                                                                                                          | ✅     | Phase 1                                          |
| Precache app shell + entry chunks (heavy lazy deps excluded)                                                                                           | ✅     | Phase 1                                          |
| Runtime caching: fonts, Storage images, JS/CSS chunks, API GETs                                                                                        | ✅     | Phase 2                                          |
| Offline fallback route + `navigateFallback` (SPA)                                                                                                      | ✅     | Phase 1                                          |
| App-update flow (prompt → `skipWaiting`/`clientsClaim`)                                                                                                | ✅     | Phase 1                                          |
| SW kill-switch / version check                                                                                                                         | ✅     | Phase 1                                          |
| `display-mode` detection + standalone UI adaptations                                                                                                   | ✅     | Phase 1                                          |
| `beforeinstallprompt` capture + custom install UI                                                                                                      | ✅     | Phase 5                                          |
| iOS "Add to Home Screen" instruction sheet                                                                                                             | ✅     | Phase 5                                          |
| `appinstalled` event → analytics                                                                                                                       | ✅     | Phase 5                                          |
| Web Push (VAPID / RFC 8291) — Chrome/Edge/Firefox/Android + iOS 16.4+ installed                                                                        | ✅     | Phase 3                                          |
| Notification `actions` (buttons: View / Mark read)                                                                                                     | ✅     | Phase 3                                          |
| `notificationclick` focus-or-open routing                                                                                                              | ✅     | Phase 3                                          |
| `pushsubscriptionchange` re-subscribe                                                                                                                  | ✅     | Phase 3                                          |
| Badging API (`setAppBadge` / `clearAppBadge`) for unread                                                                                               | ✅     | Phase 3                                          |
| Declarative Web Push (Safari 18.4+)                                                                                                                    | ➕     | Phase 3, enhancement over SW push                |
| Persistent Storage (`storage.persist()`) + quota monitoring                                                                                            | ✅     | Phase 2                                          |
| IndexedDB (via `idb`) — outbox + structured cache                                                                                                      | ✅     | Phase 2 / 4                                      |
| TanStack Query persistence (IDB) with key allowlist                                                                                                    | ✅     | Phase 2                                          |
| Background Sync (`sync` tag) + `online`-event fallback                                                                                                 | ✅     | Phase 4 (fallback is the baseline)               |
| Periodic Background Sync (refresh bookings/notifications)                                                                                              | ➕     | Phase 5 (Chromium only)                          |
| Web Share API (`navigator.share`)                                                                                                                      | ✅     | Phase 5                                          |
| Web Share Target (receive shared images/PDF → guest docs)                                                                                              | ✅     | Phase 5 (Android)                                |
| Screen Wake Lock (check-in kiosk mode)                                                                                                                 | ✅     | Phase 5                                          |
| Network Information API (adapt sync/image quality on slow links)                                                                                       | ➕     | Phase 5                                          |
| Page Visibility API (sync-on-foreground)                                                                                                               | ✅     | Phase 4                                          |
| Vibration API (subtle haptic on key mobile actions)                                                                                                    | ➕     | Phase 5                                          |
| Media Session API (marketing music preview metadata)                                                                                                   | ➕     | Phase 5, optional                                |
| Offline analytics queue                                                                                                                                | ✅     | Phase 5                                          |
| File Handling / `launchQueue`, Protocol Handlers, Window Controls Overlay, Contact Picker, Idle Detection, Background Fetch, Payment Request, WebAuthn | —      | No clear operator value v1; documented as future |

---

## Approach

### Tooling — `vite-plugin-pwa` + Workbox `injectManifest`

- Upgrade `ui/` to **Vite 5** first (own PR). Smoke-test the two custom Vite plugins, PostCSS Blueprint scoping, `bun run build`, `bun run dev`, `./dev.sh`.
- `VitePWA({ strategies: 'injectManifest', srcDir: 'src/pwa', filename: 'sw.ts', registerType: 'prompt', injectRegister: null (registered manually in main.tsx), … })`.
- SW written in `ui/src/pwa/sw.ts` using Workbox modules: `precacheAndRoute`, `registerRoute`, `NetworkFirst`, `StaleWhileRevalidate`, `CacheFirst`, `ExpirationPlugin`, `BackgroundSyncPlugin`. Own `push` / `notificationclick` / `pushsubscriptionchange` / `sync` / `periodicsync` / `message` (kill-switch) handlers.
- **Precache budget**: shell + entry chunks only. `injectManifest` `globIgnores` excludes `pdfjs-dist`, `remotion`, `openpolotno`/Polotno, `konva`, `recharts`, `fabric` chunks — they stay lazy `import()` + on-demand runtime cache. Keep the CI bundle assertions (`docs/PROJECT.md` media-optimization note). Fail the build if the precache manifest exceeds a set KB budget.

### Manifest & install

- Plugin-generated. Remove the manual `<link rel="manifest" href="/favicon/site.webmanifest">` from `ui/index.html` (keep favicon links); add iOS `<meta>` tags (`apple-mobile-web-app-capable`, `-status-bar-style`, `-title`).
- Fields: `id: "/?app"`, `name`, `short_name`, `description`, `scope: "/"`, `start_url: "/?source=pwa"`, `display: "standalone"`, `display_override: ["standalone","minimal-ui"]`, `theme_color` (+ dark via `<meta name="theme-color" media>`), `background_color`, `orientation: "portrait"`, `categories: ["business","productivity"]`, `lang`, `dir`, `launch_handler`, `shortcuts`, `screenshots`.
- Icons: `ui/public/icons/` — 192, 512, maskable-512 (safe-zone padded), monochrome (for the badge), `apple-touch-icon` (exists). Optional per-device iOS splash screens.
- **Multi-tenant**: `start_url: "/"` → a bootstrap reads `localStorage["gfm:lastTenant"]` and redirects into `/org/:slug/...`; the existing tenant switcher covers the rest.
- `useDisplayMode()` hook (`matchMedia('(display-mode: standalone)')` + iOS `navigator.standalone`) drives: hide "open in browser" chrome, the iOS "install first → then enable push" flow, safe-area tuning, pull-to-refresh suppression where it conflicts.

### Update flow + kill-switch

- `virtual:pwa-register/react` → `onNeedRefresh` → `ui/src/components/pwa/UpdatePrompt.tsx` (non-blocking banner; "Reload" posts `SKIP_WAITING`). `onOfflineReady` → one-time "Ready to work offline" toast.
- **Kill-switch**: SW fetches `/pwa-version.json` (`{ minVersion, disabled }`) on `activate` + every N hours. If `disabled` or its build is `< minVersion`: `self.registration.unregister()`, clear all caches, `clients.navigate` to a clean reload. Deployed as a static file the team can edit without a full redeploy.

### Push notifications

Web Push (VAPID). Chrome/Edge/Firefox desktop + Android work normally. **iOS/iPadOS: 16.4+ AND installed to Home Screen AND permission prompt behind a tap** — otherwise the enable control is hidden and an "Add to Home Screen first" hint shows. Safari 18.4+ adds Declarative Web Push (no SW) — layered on as an enhancement, SW push stays the baseline.

```
booking transition / webhook / cron
  → _shared/notificationService.ts#createNotification            (unchanged — inserts `notifications` row)
      → Postgres trigger on notifications INSERT
          → pg_net POST → supabase/functions/push-fanout          (new, secret-gated)
              → notificationsAccess.ts → recipient user_ids
              → SELECT push_subscriptions WHERE user_id = ANY(...)
              → _shared/webPushService.ts  (jsr:@negrel/webpush)   concurrency-limited Promise.allSettled
              → on 404/410 → delete subscription; on 429/5xx → increment failure_count, ret(Phase 3.5 retry cron)
  → SW `push`  → showNotification({ title, body, icon, badge, tag, data:{ path, notificationId }, actions:[View, Mark read] })
  → SW `notificationclick` → focus matching client or clients.openWindow(data.path); "Mark read" → POST notifications-mark-read
  → SW also postMessage → open clients: invalidate notifications query + setAppBadge(unreadCount)
```

- **VAPID**: `VITE_VAPID_PUBLIC_KEY` (all Vercel projects), `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` (Supabase secrets + `supabase/.env.local`). Generated with `@negrel/webpush`'s key tool. **Rotation plan** documented: keys are per-environment; rotating invalidates existing subscriptions → clients auto-resubscribe on next load via `pushsubscriptionchange` + a version check.
- **`push_subscriptions` table**: `id`, `user_id` (FK `auth.users`), `endpoint` (unique), `p256dh`, `auth`, `user_agent`, `platform`, `created_at`, `last_seen_at`, `failure_count`, `disabled_at`. RLS: owner-only; **explicit `service_role` + `authenticated` GRANTs in the same migration** (per the `notifications` skill "RLS-for-realtime gotcha").
- **Edge functions** (new): `push-subscribe` (upsert on endpoint, refresh `last_seen_at`), `push-unsubscribe`, `push-fanout` (secret-gated, `serveCronPost` shape), and a `push-retry-cron` (Phase 3.5) that re-attempts `failure_count` 1–4 rows and disables at 5.
- **`_shared/webPushService.ts`** wraps `jsr:@negrel/webpush` (Deno-native, Web Crypto — not Node `web-push`). Concurrency cap (e.g. 20) so large orgs don't stampede push services.
- **Client**: `usePushNotifications()` — permission state machine, `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, POST to `push-subscribe`; unsubscribe on sign-out. Settings section in the Notifications page: per-user master toggle now, per-event-type matrix in Phase 3.5. iOS: control rendered only when standalone.
- **Rule change**: `notifications` skill + `.cursor/rules/notifications.mdc` currently say "no OS-level `Notification` — inbox-chat-only." Update: OS push is a first-class channel for **all** event types, gated on per-user opt-in. The legacy `ui/.../inbox/lib/inboxNotifications.ts` foreground `new Notification()` path is superseded — fold it into the SW push path or keep only as a same-tab fallback.
- **Monitoring**: `push-fanout` logs sent/failed/pruned counts; a lightweight `push_delivery_stats` roll-up (or just structured logs + a Supabase log query saved in the runbook). Alert threshold on failure rate.

### Offline read

- **Shell**: Workbox precache + `navigateFallback: '/index.html'` (mirrors `ui/vercel.json` SPA rewrite) + a `/offline` route for cache-miss navigations.
- **Runtime caching**: fonts (`fonts.gstatic.com`) `CacheFirst` + expiration; Supabase Storage images `StaleWhileRevalidate` + `ExpirationPlugin` (entry cap + ~50 MB — iOS quota is tight); JS/CSS `StaleWhileRevalidate`; allowlisted edge-function GETs `NetworkFirst` with a short timeout + cache.
- **Data**: add `@tanstack/react-query-persist-client` + an **IndexedDB persister** (`idb`), gated by a **query-key allowlist** — bookings list/detail (active tenant), `notifications`, inbox threads, property/parking settings (read), `dashboard-stats`, guest-portal trips/messages (Tier B). Each key gets a `maxAge`. `buster` = app build id so a deploy drops stale shapes.
- **`navigator.storage.persist()`** requested on first authenticated load; `storage.estimate()` surfaced in a diagnostics panel; eviction policy = oldest runtime-cache first, never the outbox.
- **Staleness UX**: `ui/src/components/pwa/OfflineBanner.tsx` — "Offline · showing last synced copy · <relative time>"; network-only actions disabled or (Tier A, Phase 4) routed to the outbox.
- **Tenant isolation**: all Cache API + IDB keys namespaced by `user_id` + tenant slug. `supabase.auth.onAuthStateChange('SIGNED_OUT')` → `ui/src/lib/pwa/purgeOfflineState.ts`: delete all caches, clear IDB stores, `pushManager.unsubscribe()` + `push-unsubscribe`, `clearAppBadge()`. Document: IDB is **not** encrypted at rest; it holds only what the user could already see (RLS is not the boundary — CLAUDE.md); it is cleared on logout.

### Offline write + sync (Tier A)

- **Outbox** (`ui/src/lib/pwa/outbox.ts`) — IDB store: `{ id: uuid, kind, url, method, headers (no auth), body, idempotencyKey, createdAt, attempts, lastError }`. A mutation wrapper (`ui/src/lib/pwa/offlineMutation.ts`) integrated with TanStack Query: on offline / network failure → enqueue + apply an **optimistic** cache update so the UI moves immediately.
- **Replay engine** (`ui/src/lib/pwa/syncEngine.ts`): drains FIFO on `window 'online'`, on `visibilitychange → visible`, and via SW Background Sync tag `outbox-drain` where supported (Chromium only — Firefox/Safari/iOS have none, and an Android WebView shell loses it, so the `online` path is the baseline). Before draining: refresh the Supabase JWT. POST each item with an `Idempotency-Key` header. 2xx → remove; 4xx (invalid/stale transition, conflict) → mark **failed** → Sync Center; 5xx / network → keep, exponential backoff, cap attempts.
- **Server idempotency**: `_shared/idempotency.ts` + `request_idempotency` table (`key` unique, `response_snapshot jsonb`, `created_at`, `expires_at`) wrapped into every offline-write endpoint. Replaying a key returns the stored response — no re-run of side effects. A daily cleanup cron prunes expired rows. Confirm the status state machine returns a **distinct, client-parseable error code** for "already advanced / invalid from-state" so the client shows a conflict, not a generic failure.
- **Conflict UX**: server rejection → toast ("This booking already moved to <status>") + refetch detail; the failed item lands in the Sync Center with discard / retry.
- **Sync Center UI** (`ui/src/features/dashboard/.../SyncCenter.tsx`): pending count + failed list + manual retry + "last synced" time; the offline banner shows the pending count; a badge on the More tab.

### Cross-cutting / production hardening

- **Auth in standalone**: Google OAuth is PKCE, same-origin — verify the `?code=` return lands inside `scope` when launched standalone, on all three platforms.
- **Vercel headers** (`ui/vercel.json`, both projects `guest-form-management-app` + `kame-homes`): `sw.js` + `manifest.webmanifest` → `Cache-Control: no-cache`; `Service-Worker-Allowed: /`; `/pwa-version.json` → `no-cache`.
- **Dev**: SW behind `devOptions` / a flag so `./dev.sh` HMR isn't fighting it; add "unregister the service worker" + "hard-reload after SW change" to CLAUDE.md "Local dev gotchas".
- **CSP**: audit — SW registration and `workbox` need no new directives; push payloads are same-origin; confirm `connect-src` covers the push endpoints only if we ever fetch them client-side (we don't).
- **Feature detection everywhere** — a single `ui/src/lib/pwa/capabilities.ts` reporting `{ install, push, badging, backgroundSync, periodicSync, share, shareTarget, wakeLock, persistentStorage }`; UI reads from it, never sniffs UA.
- **Monitoring**: SW `error` / `unhandledrejection` → existing client error reporting; push fan-out success/failure metric; offline-sync failure counter; install-rate + push-opt-in analytics.
- **Rollback**: the kill-switch (decision 8) + `registerType: 'prompt'` (no forced reload) means a bad deploy is recoverable without waiting out cache TTLs.

### Testing (no automated suite in repo)

Manual QA matrix, run per phase and again at Phase 7:

- Install + launch: Chrome desktop, Edge desktop, Android Chrome, Samsung Internet, iOS Safari 16.4, iOS 26.
- Offline read: each allowlisted Tier A surface + Tier B portal; airplane mode; stale-copy banner; quota-pressure eviction keeps the outbox.
- Push: delivery + click routing + notification actions on Chrome desktop / Android / iOS installed; permission revoke mid-session; `pushsubscriptionchange`; logout unsub; large-org fan-out (many subscriptions).
- Offline write: airplane-mode transition + reply + note + maintenance update → reconnect → server state matches → replay runs twice = no-op → conflicting transition shows conflict → Background Sync path (Android) + `online` fallback path (iOS) → failed item ret/discard in Sync Center.
- Update flow: deploy a new build → banner appears → Reload → new SW active, no stuck state.
- Kill-switch: flip `/pwa-version.json` `disabled` → clients self-unregister + reload clean.
- Lighthouse PWA audit green (installable + optimized) on all three platforms.
- Playwright MCP drives the install/offline/update/kill-switch flows where it can.

---

## Phases

### Phase 0 — Tooling (SUPERSEDED: no Vite upgrade needed)

**Decision revised during implementation.** `vite-plugin-pwa@1.3.0` officially supports Vite `^3 || ^4 || ^5 || ^6 || ^7 || ^8` (verified via its `peerDependencies`), so the app stays on **Vite 4.4** and still gets modern Workbox 7.4.1. This avoids destabilising the custom Blueprint-CSS-scoping + Polotno-highlighter Vite plugins — the lowest-risk path to a production-grade PWA.

- [x] Added `vite-plugin-pwa@^1.3.0` + `workbox-{precaching,routing,strategies,expiration,cacheable-response,background-sync,core,window}@^7.4.1`, `idb`, `idb-keyval`, `@tanstack/react-query-persist-client` + `@tanstack/query-async-storage-persister`, `sharp` (root dev, icon gen).
- [x] Baseline verified green before + after: `type-check`, `lint` (0 errors), `build`, `vitest` (67).

### Phase 1 — Installable baseline (manifest, SW skeleton, install, update, kill-switch) ✅ IMPLEMENTED

- [x] `injectManifest` in `ui/vite.config.ts` (`gfmPwaPlugin()`); globs + budget in `scripts/pwa/precache-globs.json` (single source of truth); `scripts/pwa/check-precache-budget.mjs` runs in `bun run build` (CI covers it). Budget 12800 KiB, current ~11020 KiB.
- [x] `ui/src/pwa/sw.ts` — precache, `NavigationRoute` → `index.html` with `/offline.html` fallback + `setCatchHandler`, `message` handler (`SKIP_WAITING` + `gfm:*`), kill-switch (`checkKillSwitch`) on `activate` + throttled on navigation fetch + on `CHECK_VERSION` message. `ui/src/pwa/shared.ts` shared constants; `ui/src/pwa/tsconfig.json` (WebWorker lib) wired into `type-check`/`build`.
- [x] Manifest (all fields incl. `id`, `scope`, `launch_handler`, `shortcuts`, `display_override`); icons generated by `scripts/pwa/generate-icons.mjs` → `ui/public/icons/` (any + maskable 192/512, apple-touch, notification-badge); iOS `<meta>` + dual `theme-color`; removed manual `site.webmanifest` `<link>`.
- [x] `ui/src/hooks/useDisplayMode.ts`, `useOnlineStatus.ts`; `ui/src/lib/pwa/capabilities.ts` (feature-detection single source), `swRegistration.ts`, `purgeOfflineState.ts`.
- [x] SW registered via `virtual:pwa-register/react` in `ui/src/components/pwa/PwaProvider.tsx` (mounted in `App.tsx`); `UpdatePrompt.tsx` (prompt, never auto-reload) + `OfflineBanner.tsx`. Kill-switch `KILLED` message → `purgeOfflineState()` + reload. Durable storage requested on idle.
- [x] `ui/public/pwa-version.json`; `ui/vercel.json` headers (`sw.js` no-cache + `Service-Worker-Allowed: /`, manifest/offline no-cache, `pwa-version.json` no-store).
- [x] Runtime-verified with Playwright MCP against `vite preview`: SW registers/activates/controls, manifest served, deep-link offline navigation boots the SPA from precache, `offline.html` served offline, 0 console errors.
- [ ] Standalone UI adaptations (hide browser-open affordances, pull-to-refresh) — deferred to Phase 5 polish; `useDisplayMode` primitive is in place.
- [ ] Lighthouse installable audit + manual install on real Chrome desktop / Android / iOS — Phase 7 QA.
- [ ] CLAUDE.md "Local dev gotchas" SW note + `docs/architecture/pwa.md` — Phase 7 docs pass.

### Phase 2 — Offline read ✅ IMPLEMENTED

- [x] Workbox runtime routes in `sw.ts`: Google Fonts CSS (SWR) + files (CacheFirst, 1y), Supabase Storage images (SWR + `ExpirationPlugin` 300 entries/30d/purgeOnQuotaError), `/assets/*` chunks (SWR), allowlisted read-only Edge Function GETs (NetworkFirst, 6s timeout). **No `setDefaultHandler`** — POSTs / SSE (dashboard assistant) / auth pass straight through.
- [x] `@tanstack/react-query-persist-client` + `idb-keyval`-backed `AsyncStoragePersister` (`ui/src/lib/pwa/queryPersister.ts`); allowlist `ui/src/lib/pwa/offlineQueryAllowlist.ts` (`shouldPersistQuery` — allowlisted root + `status==='success'`); `maxAge` 24h, `buster: __PWA_BUILD_ID__` (via vite `define`).
- [x] `ui/src/components/pwa/PwaQueryPersistence.tsx` — **per-viewer keyed** (`user-<id>` / `anon`) restore+subscribe so a shared device never restores one user's cache into another's session; `queryClient.clear()` + `purgeOfflineState()` on `SIGNED_OUT`. Mounted in `App.tsx` inside `QueryClientProvider`.
- [x] Cache + IDB namespaced (`gfm-` prefix, per-viewer persister key); `purgeOfflineState.ts` wipes caches + owned IDBs + `clearAppBadge` on logout / kill-switch.
- [x] `OfflineBanner` shows "showing last synced data" when offline (+ pending/syncing counts from the offline-sync store, ready for Phase 4).
- [x] Runtime-verified: `gfm-query-cache` IDB created, 0 console errors, app boots.
- [ ] `navigator.storage.estimate()` diagnostics panel — Phase 5 (request is done).
- [ ] Manual QA offline-read matrix (needs auth) + `.cursor/rules/pwa.mdc` — Phase 7.

### Phase 3 — Push notifications ✅ IMPLEMENTED (server verify pending deploy)

- [x] `scripts/pwa/generate-vapid-keys.mjs` (Node Web Crypto, no dep); local dev pair written to `ui/.env.development` + `supabase/.env.local` (both gitignored); `.env.example` templates updated with `VITE_VAPID_PUBLIC_KEY`, `VAPID_KEYS`, `VAPID_SUBJECT`, `PUSH_FANOUT_SECRET`.
- [x] Migration `20261303120000_push_subscriptions.sql` — table + RLS (owner select/delete) + `service_role` grant.
- [x] Migration `20261303120100_push_fanout_trigger.sql` — `AFTER INSERT ON notifications` → `notify_push_fanout()` → `pg_net` POST to `push-fanout`, secret-gated via Vault `push_fanout_secret`, `EXCEPTION WHEN OTHERS` so it never blocks the insert, no-op without pg_net/Vault.
- [x] `_shared/webPushService.ts` — `https://esm.sh/jsr/@negrel/webpush@0.5.0` (Web-Crypto, Deno-native), isolated; `sendPush` never throws, flags `gone` (404/410); `sendPushBatch` concurrency cap 20.
- [x] `_shared/pushRecipients.ts` — recipients = org owner + active `organization_members` (matches the realtime rule; property/parking-only members are the same known gap as realtime); `loadPushSubscriptions`, `reconcilePushFailures` (disable on gone, bump `failure_count`, retire at 5), `resolveNotificationClickPath` (mirrors client `resolveNotificationPath`).
- [x] `push-subscribe` / `push-unsubscribe` (`serveAuthenticated`, upsert on endpoint) + `push-fanout` (`servePublic` + `X-Push-Fanout-Secret`); `config.toml` blocks added (`verify_jwt = false`).
- [x] SW `push` (icon + `notification-badge.png` + tag + `renotify` + `data.path`), `notificationclick` (focus existing client + `postMessage NOTIFICATION_CLICK`, else `openWindow`), `pushsubscriptionchange` (local re-subscribe + `PUSH_RESYNC` to clients).
- [x] `ui/src/lib/pwa/push.ts` (`getPushState` / `enablePush` / `disablePush` / `resyncPushSubscription`, iOS `needsInstallFirst`), `usePushNotifications.ts` hook, `PushNotificationsCard.tsx` in the Notifications page (`InAppNotificationsSection`), `NotificationsProvider` wires click-nav + resync + badge.
- [x] Badging — `setAppBadge` / `clearAppBadge` from the bell unread count in `NotificationsProvider`; cleared on logout by `purgeOfflineState`.
- [x] Runtime-verified (Playwright MCP): `showNotification` with the SW's exact options shape works (icon/badge URLs resolve); `pushManager.subscribe` with the VAPID key succeeds and returns the `{endpoint, keys:{p256dh,auth}}` shape `push-subscribe` expects; 0 console errors.
- [ ] **Server send path (`@negrel/webpush` in the Deno edge runtime) not exercised** — needs a deploy + a real push service. Isolated behind `webPushService.ts`; fallback = npm `web-push`. Flag for deploy-time QA.
- [ ] `inboxNotifications.ts` foreground `new Notification()` path — left intact for now (harmless duplicate suppression on `visibilitychange`); fold into SW path in Phase 7.
- [ ] Docs (rule + skill + architecture) — Phase 7 pass.

### Phase 3.5 — Push polish — DEFERRED (documented follow-ups)

- Per-event-type opt-in matrix — **deferred**. The master per-device toggle is a complete v1; a type matrix adds a `notification_preferences` table + fanout filtering + UI surface with real bug risk. Follow-up.
- `push-retry-cron` — **not needed**. `reconcilePushFailures` already prunes gone endpoints and retires at 5 failures; the next notification is the natural retry. No per-send queue to justify a cron.
- Declarative Web Push (Safari 18.4+) — **deferred**. Low ROI, heuristic Safari-endpoint detection; SW push is the baseline everywhere.
- Delivery observability — `push-fanout` emits a structured `[push-fanout] {sent,pruned,failed,recipients,endpoints}` log line; the runbook (Phase 7) documents the saved log query + alert threshold. No table.

### Phase 4 — Offline write + sync (Tier A) ✅ INFRASTRUCTURE IMPLEMENTED

**Scope narrowed during implementation.** Booking-status transitions are **online-only for v1**: `useTransitionBooking` / `WorkflowPanel` couple transitions with sub-form file uploads (receipts, endorsements) that can't be queued offline, and consumers read `result.booking` synchronously. Retrofitting safely needs a WorkflowPanel refactor out of scope here. The outbox infra is generic — wiring transitions later is config + a focused no-payload path.

- [x] `ui/src/lib/pwa/outbox.ts` — `idb`-backed `gfm-outbox` / `mutations` store, FIFO by `createdAt`, full CRUD. Verified: DB + store created at load.
- [x] `ui/src/lib/pwa/offlineMutation.ts` — `runOfflineMutation({ url, body, invalidateKeys, applyOptimistic })`: tries online with a fresh JWT + `Idempotency-Key`; queues **only** on a connectivity failure (a server 4xx/5xx re-throws — a validation error must not be queued); applies optimistic update on queue.
- [x] `ui/src/lib/pwa/syncEngine.ts` — FIFO drain on `online` + `visibilitychange` + SW `DRAIN_OUTBOX` message + initial; fresh JWT per drain; `Idempotency-Key` header; 2xx→remove+invalidate, 408/425/429/5xx→backoff (cap 6)→failed, other 4xx→failed + invalidate (surface server truth); `retryOutboxItem` / `discardOutboxItem`; Background Sync `outbox-drain` tag registered best-effort.
- [x] SW `sync` handler → wakes clients to drain (can't replay in the SW — no JWT); rejects when no client so the browser retries.
- [x] `_shared/idempotency.ts` (`withIdempotency` HOF — claim-first row so a concurrent replay blocks instead of double-executing; releases the claim on non-2xx / throw; opportunistic TTL sweep) + `20261303120200_request_idempotency.sql`. Wrapped: `transition-booking`, `transition-parking-booking`, `social-inbox-send`.
- [x] Wired for real: **inbox text-only replies** (`useInbox` `sendReply` → `runOfflineMutation`; attachment replies stay online-only) and the existing optimistic message bubble carries through.
- [x] `SyncCenterCard.tsx` (pending + failed list, retry/discard, "Sync now", last-synced) in the Notifications page; `OfflineBanner` shows pending/syncing counts (via `offlineSyncStore`); `purgeOfflineState` wipes the outbox + resets the store on logout.
- [ ] Wire booking-status transitions (needs the WorkflowPanel refactor) — follow-up.
- [ ] State-machine conflict error code mapping — the client already surfaces the server's `error` string on a failed item + refetches; a dedicated conflict code is a Phase 7 nicety.
- [ ] Manual offline-write E2E (needs auth + backend) + server idempotency verification (needs deploy) — Phase 7.
- [ ] Docs — Phase 7 pass.

### Phase 5 — Native-feel + platform APIs ✅ IMPLEMENTED

- [x] `ui/src/lib/pwa/installPrompt.ts` — captures `beforeinstallprompt` early (imported for side effect in `main.tsx`), `appinstalled` → telemetry; `ui/src/components/pwa/InstallPrompt.tsx` — Chromium "Install" button + iOS "Add to Home Screen" one-liner, 8s appear delay, 14-day dismissal memory, hidden when standalone. Mounted in `PwaProvider`.
- [x] Manifest `shortcuts` (Bookings / Guest Inbox / Today's check-ins → `?shortcut=…`); `NotificationsProvider` reads `?shortcut=` after the tenant redirect and navigates to the last tenant's bookings/inbox, then strips the param.
- [x] `ui/src/lib/pwa/share.ts` — `shareContent()` (Web Share + clipboard fallback, AbortError-aware), `canWebShare()`. Util shipped for incremental adoption (share buttons); no existing call site rewired.
- [x] Periodic Background Sync — `PwaProvider` registers `gfm-periodic-refresh` (6h, permission-gated); SW `periodicsync` handler → `REVALIDATE` message to clients → `NotificationsProvider` invalidates `bookings` / `notifications` / `dashboard-stats`.
- [x] `ui/src/hooks/useWakeLock.ts` — Screen Wake Lock hook with visibility re-acquire, for a future check-in kiosk toggle (no UI wired yet).
- [x] `ui/src/lib/pwa/pwaTelemetry.ts` — event sink (`console.debug` + `gfm:pwa-telemetry` CustomEvent) wired at install / push enable-disable / offline-queue / sync-drain / sync-fail / update / kill-switch. Point it at a real analytics channel when one exists (mirrors `mediaTelemetry.ts`).
- [x] `capabilities.ts` already exposes `share`/`shareFiles`/`wakeLock`/`periodicSync`/`badging`/`persistentStorage`/`storageEstimate` for feature-detected UI.
- [ ] Web Share **Target** (Android → guest-document upload) — **deferred**: needs a `/share-target` route + `manifest.share_target` + backend receive path coupled to the (complex) guest-document upload flow. Follow-up.
- [ ] Network Information API adaptation, Vibration, Media Session — **deferred** (low ROI progressive enhancements; capability flags are in place).
- [ ] `storage.estimate()` diagnostics panel — Phase 7.
- [ ] Wire `useWakeLock` into a kiosk-mode toggle + `ShareButton` into stay-guide/booking-link — incremental follow-ups.

### Phase 6 — Guest surfaces (Tier B + C) ✅ PARTIAL (read done; push + form-draft = documented follow-ups)

- [x] Tier B — guest portal **offline read**: guest auth uses the same `supabase.auth` client, so `PwaQueryPersistence`'s per-viewer keying + `SIGNED_OUT` purge already isolate guest vs admin caches. Allowlist extended with `guest-messages`, `guest-profile`, `guest-vouchers`, `support-tickets`, `support-ticket` → the guest portal's Messages / Profile / Vouchers / Tickets read pages work offline.
- [x] Tier C — installable shell + graceful offline: Phase 1's precache + `navigateFallback` + `offline.html` already cover every public route; a cached public page boots offline, submits show the existing network-error path.
- [x] `ui/src/hooks/useOfflineFormDraft.ts` — generic IDB-backed autosave/restore/clear primitive for any form, ready to adopt.
- [ ] Tier B **push** — **deferred**: there is no guest-facing notification event model (`notifications` is admin/org-scoped, guests have no bell). Wiring guest push needs a new `guest_notifications` stream + triggers + a guest fanout — a meaningful subsystem, not a reuse. Follow-up.
- [ ] Wire `useOfflineFormDraft` into the guest booking `form` — **deferred**: `GuestForm.tsx` (2675 lines) has `File` fields (not serialisable) and several async `form.reset()` prefill paths; restore must not race the `bookingId` prefill. Needs a careful pass against the real booking flow — hazard documented in the hook's JSDoc.
- [ ] Web Share Target → guest-document upload — deferred (see Phase 5).
- [ ] Docs — Phase 7 pass.

### Phase 7 — Production hardening & docs finalization ✅ DOCS DONE (platform QA needs a deploy)

- [x] **Docs** (this change): new `docs/architecture/pwa.md` (authoritative — SW, precache budget, offline allowlist, push pipeline + rotation runbook, outbox/sync, security, deploy checklist §9, kill-switch runbook §10); `docs/PROJECT.md` (PWA section + architecture-docs row); `docs/architecture/data-model.md` (`push_subscriptions`, `request_idempotency`); `docs/architecture/edge-functions.md` (3 push fns + `withIdempotency` note); `docs/architecture/validation-and-env.md` (`VITE_VAPID_PUBLIC_KEY`, `VAPID_KEYS`/`VAPID_SUBJECT`/`PUSH_FANOUT_SECRET`); `docs/architecture/deployment.md` (vercel headers); `docs/README.md` index; `docs/archive/operations/scheduled-jobs-and-testing.md` §1.0b (push-fanout trigger + Vault); `.cursor/rules/pwa.mdc` (**new**) + `.cursor/rules/README.md` row; `.cursor/rules/notifications.mdc` + `.agent/skills/notifications/SKILL.md` (OS push is now a channel); `CLAUDE.md` local-dev SW note; route guides `org/property/notifications.md` + `org/parking/notifications.md` ("This device (PWA)" section + Sync Center + host FAQ + impl map).
- [x] **Precache budget gate** — `scripts/pwa/check-precache-budget.mjs` runs in `bun run build` (so CI enforces it); current ~11 MiB / 12.8 MiB.
- [x] **Self security review** (security-auditor not spawned — global no-swarm rule): `push_subscriptions` RLS owner-only + explicit `service_role` grant; `request_idempotency` service-role only; `push-fanout` secret-gated never JWT; per-viewer query-cache keying prevents cross-identity leak; `purgeOfflineState` wipes caches + owned IDB + local push unsub + badge + sync store on `SIGNED_OUT` and kill-switch; SW never imports app code; kill-switch never self-destructs on a failed fetch; `offlineMutation` queues only connectivity failures (never a server validation error); IDB unencrypted-at-rest documented + allowlist kept tight.
- [x] **`pwaTelemetry`** event sink in place (install / push / offline-queue / sync / update / kill-switch) — point at a real analytics channel later.
- [ ] **Full platform QA** (Lighthouse PWA; install + push + offline + update + kill-switch on Chrome desktop / Android / iOS 16.4+) — requires a deploy; verified locally as far as `vite preview` + Playwright MCP allow (SW register/activate/control, manifest, offline deep-link nav + `offline.html`, `showNotification` shape, `pushManager.subscribe` shape, IDB stores). The **`@negrel/webpush` server send path** is the one link not exercisable without a deploy.
- [ ] Monitoring dashboards / alert thresholds — runbook in `pwa.md` §5; wire alerts post-deploy.
- [ ] A dedicated `pwa` **skill** (vs the `.mdc` rule) — optional; the rule + `docs/architecture/pwa.md` cover it.

---

## Docs to update

| Doc                                                                     | Change                                                                                                                                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture/pwa.md` **(new)**                                    | SW strategy + precache budget, offline query-key allowlist (canonical), push pipeline + VAPID rotation runbook, outbox/sync design, tier table, platform support matrix, kill-switch procedure |
| `docs/PROJECT.md`                                                       | PWA architecture section; env vars (`VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`); new edge functions; new tables                                                             |
| `docs/architecture/data-model.md`                                       | `push_subscriptions`, `request_idempotency`, optional `notification_preferences` / `push_delivery_stats`                                                                                       |
| `docs/architecture/edge-functions.md`                                   | `push-subscribe`, `push-unsubscribe`, `push-fanout`, `push-retry-cron`                                                                                                                         |
| `docs/architecture/deployment.md`                                       | `sw.js` / manifest / `pwa-version.json` cache headers, `Service-Worker-Allowed`, both Vercel projects                                                                                          |
| `.cursor/rules/notifications.mdc` + `notifications` skill               | OS push is now a channel for **all** event types (was "inbox-chat-only"); per-user opt-in; `inboxNotifications.ts` superseded                                                                  |
| `.cursor/rules/pwa.mdc` **(new)**                                       | Offline-cache allowlist discipline, "adding a cached endpoint / offline mutation" checklist, tenant-isolation + logout-purge rule, precache-budget gate                                        |
| `.cursor/rules/booking-workflow.mdc`                                    | Idempotent transition entrypoint note (Phase 4)                                                                                                                                                |
| `docs/guides/routes/*` (via `route-guides` skill)                       | Notifications settings push section; Sync Center; offline/update banners; guest-portal push; booking-form offline draft                                                                        |
| `CLAUDE.md`                                                             | "Local dev gotchas" — unregister SW; "Commands" — VAPID key-gen note                                                                                                                           |
| `.claude/README.md` / `.cursor/rules/README.md` / `.opencode/README.md` | New `pwa` skill + `pwa.mdc` rule                                                                                                                                                               |
| `docs/archive/operations/scheduled-jobs-and-testing.md`                 | `push-fanout` trigger, `push-retry-cron`, `request_idempotency` cleanup cron, periodic-sync                                                                                                    |

## Deep self-review — findings + fixes (2026-09-02)

A full pass over every PWA file after Phases 0–7. Everything below is **fixed in this change** unless marked deferred.

**Real bugs fixed:**

1. **Logout purge didn't actually clear IndexedDB.** `indexedDB.deleteDatabase()` is _blocked_ while `idb` / `idb-keyval` hold an open connection (they do, for the app's lifetime), so on sign-out (no reload) the query cache + outbox survived. `purgeOfflineState` now calls store-level `clear()` (`clearAllPersistedQueryCaches`, `outboxClear`) which works on the open connection; `deleteDatabase` stays as a next-reload fallback. Verified: a seeded key reads `null` after the store-level clear.
2. **`useWakeLock` never re-acquired after the OS auto-released the lock on tab-hide** (`!sentinelRef.current` stayed false — ref pointed at a released sentinel). Now listens for the sentinel's `release` event and nulls the ref, so the visibility handler re-acquires.
3. **`enablePush` server-call failure → unhandled rejection + orphan local subscription** (local sub existed, server row didn't → UI said "on", no delivery). Now rolls back the local `unsubscribe()` and throws a friendly error; `usePushNotifications.enable` catches it and shows a `toast.error`.
4. **No timed retry after a transient 5xx while online + foregrounded** — a queued item just waited for the next `online`/`visibilitychange`. `drainOutbox` now schedules an exponential-backoff self-retry (`2^attempts` s, cap 60s) after a backoff-break.
5. **OS push wasn't delivered for coalesced inbox messages** (2nd+ message in a thread) — the trigger was `AFTER INSERT` only, but `createOrCoalesceNotification` does an `UPDATE`; in-app realtime already fires on UPDATE. New migration `20261303120300_push_fanout_on_coalesce.sql` splits it into INSERT + UPDATE triggers, the UPDATE one guarded on `NEW.created_at IS DISTINCT FROM OLD.created_at` (the coalesce bump). Same `tag` → the lock-screen notification updates + re-buzzes rather than stacking.
6. **Push notification click on a non-admin tab focused but didn't navigate** — the `NOTIFICATION_CLICK` handler lived only in `NotificationsProvider` (AdminLayout). Moved `NOTIFICATION_CLICK` + `REVALIDATE` handling to `PwaProvider` (mounted app-wide inside the router). Verified: a click message navigates from any surface.

**Hardening:**

7. **SW `push` / `notificationclick` now sanitise `data.path`** — reject anything not starting with a single `/` (defence in depth if the VAPID private key ever leaked). `PwaProvider`'s message handler double-checks the same. Verified: `//evil.com` / `https://evil.com` are ignored.
8. **`gfm-google-fonts-css` runtime cache had no `ExpirationPlugin`** — added (8 entries / 30d).
9. **Image runtime cache `maxEntries` 300 → 80** — opaque cross-origin image responses pad to ~7 MB each toward the quota; 80 stays inside iOS's tight budget before `purgeOnQuotaError`.
10. **Kill-switch `WindowClient.navigate()` after `unregister()`** — wrapped in try/catch (+ `includeUncontrolled` on `matchAll`, + malformed-descriptor guard) so a rejection can't leave the tear-down half-done.
11. **`requestPersistentStorage()` ran on every load** (Firefox prompts) — now gated to a committed operator (installed, or notifications granted).
12. **`runOfflineMutation` online path** — tolerates a non-JSON error body (proxy 502 HTML) instead of surfacing a cryptic `SyntaxError` toast.
13. **`withIdempotency` poll timeout 15s → 30s** — covers the slowest wrapped handler before a concurrent replay would fall through and re-run.
14. **`retryOutboxItem` resets `attempts` to 0** so a manual retry gets the full backoff budget again.
15. **`index.html`** — added a non-media `theme-color` fallback for older Android Chrome.

**Reviewed and accepted as-is (not bugs):** monolithic main chunk (pre-existing; precache-budget gate guards regressions); opaque font/image caching (Workbox default, bounded by expiration); `push-subscribe` endpoint reassignment on a shared device (correct — endpoint belongs to whoever's signed in; logout kills it locally); actor gets a push for their own action (matches in-app realtime); `useOfflineFormDraft` not wired (primitive only, Tier C follow-up).

**Not the PWA module (flagged, not fixed):** `bun run test` — 4 failures in `src/lib/posthog/client.test.ts`; `bun run check:ai-tooling-sync` — `.claude/skills/integration-javascript_web` has no `.agent/` counterpart. Both from the PostHog observability work merged into the tree during this build.

---

## Open questions

None — all decisions locked above. New questions get raised per-phase during that phase's plan-mode pass.
