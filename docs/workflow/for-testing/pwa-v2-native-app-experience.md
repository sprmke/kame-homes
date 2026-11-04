---
title: 'PWA v2: native app experience, smart install, smooth updates, full coverage'
stage: for-testing
status: for-testing
tags: [pwa, service-worker, offline, push, install, mobile-native, testing]
updated: 2026-11-02
kind: plan
---

# PWA v2: native app experience, smart install, smooth updates, full coverage

## Progress

- **2026-11-01:** audit of the shipped PWA (v1) against the current app, build measurement, gap list, phased task plan, test plan; Phases 0 to 9 implemented.
- **2026-11-02 — implementation complete:** every task is shipped or explicitly accepted as a non-goal (see §16). Remaining work is operational: physical-device QA and a dev deploy blocked by a duplicate migration version from another workstream.

### Implementation status

Ticked boxes in the phases below are implemented and verified (`bun run test`, `bun run test:e2e:pwa`, `vite build` + precache budget). Everything else is listed in §16 with the reason.

| Area     | Outcome                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Precache | **12 486 KiB → 4 100 KiB shell** (−67%) for every visitor, enforced by a shell/host/total budget gate.                                                  |
| Launch   | `/app` resolver + manifest `start_url` + 3 working shortcuts; `checkins` filters to today in Asia/Manila.                                               |
| Install  | Eligibility engine, one-surface arbitration, iOS/macOS/Android guides, permanent entry, first-launch welcome, 14/30/90-day cooldowns.                   |
| Updates  | Safe auto-apply, 4-hour snooze, multi-tab coordination, reload loop guard, `forceUpdateBelow`.                                                          |
| Offline  | Three-state connectivity, bottom offline strip + Sync Center, resume recovery, guest form drafts, notification mark-read queueing.                      |
| Push     | Property/parking-scoped recipients with RBAC, per-user badge from the SW, tray clearing, actions, no duplicate foreground notification.                 |
| Tests    | 245 PWA/launch unit tests (all 15 v1 stubs replaced), 8 Playwright `@pwa` specs against a production build, Deno recipient + preference + sender tests. |

**Critical bug found and fixed during implementation:** the precache list was populated only inside the `install` handler. A service worker is stopped aggressively by the browser, so on the next wake the list was empty and every offline navigation failed. The list is now rebuilt on every worker start from the cached tier manifest (`precacheReady`), and `precache.activate()` refuses to run with an empty expected set.

**Builds on:** [`./pwa-installable-offline-push.md`](./pwa-installable-offline-push.md) (v1, Phases 0 to 7 shipped 2026-09-02, never fully device-QA'd). Canonical reference: [`../../architecture/pwa.md`](../../architecture/pwa.md). Rule: `.cursor/rules/pwa.mdc`.

**Coordinates with:** [`../in-progress/kamespace-03-rebrand-kame-homes-to-kame-space.md`](../in-progress/kamespace-03-rebrand-kame-homes-to-kame-space.md) (W-01 to W-05: manifest name, icons, version bump), [`../in-progress/kamespace-04-domain-move-kamespace-com.md`](../in-progress/kamespace-04-domain-move-kamespace-com.md) (origin change breaks installed apps, see P0-3), [`../in-progress/dashboard-mobile-native-v2.md`](../in-progress/dashboard-mobile-native-v2.md) (phone layouts; this plan owns the standalone-mode behavior, that plan owns screen layouts).

**Source intake:** user request 2026-11-01. Goals in the user's words: make sure the app "acts and behaves beautifully like a full PWA app", covers every page and section, offers install only when the device and user make it sensible, and keeps syncing and reloading smooth. Plan only, no code yet.

---

## 1. Goal and success criteria

The app should feel like an installed native app for **hosts and operators** (primary), feel fast and never in the way for **guests** (secondary), and degrade cleanly everywhere else.

Measurable exit criteria:

1. Chrome reports **zero installability errors** (`Page.getInstallabilityErrors`) on dev and prod, and the install dialog shows the rich variant (screenshots + description) on Android and desktop.
2. A signed-in host who launches the installed app lands in **their last dashboard**, not the public marketplace. All manifest shortcuts open the right screen.
3. An anonymous guest's first visit to a booking form downloads **no more than ~3 MiB** of service-worker precache (today: 12.2 MiB, see §2.2).
4. The install prompt is **never** shown: inside in-app browsers, during a form or checkout, on the first page view, to a browser that cannot install, or after the user said no (escalating cooldown).
5. A new deploy reaches a long-running installed app within one foreground cycle, and **never** reloads over unsaved edits.
6. Every route group has a declared offline behavior (§6), and the matching E2E checks pass in CI.
7. Push works end to end on Android, desktop, and iOS 16.4+ installed (real-device QA signed off), including for property-only and parking-only team members.
8. Every PWA lib module has real unit tests (today they are "module loads" stubs), and a `pwa` Playwright project runs against a production build in CI.

---

## 2. Audit: what ships today and what is wrong

### 2.1 What v1 already does well (keep)

| Area                                                                                               | Status                                               |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Manifest via `vite-plugin-pwa` `injectManifest`, custom SW `ui/src/pwa/sw.ts`                      | ✅                                                   |
| Prompt-based updates (`registerType: 'prompt'`), no auto-reload                                    | ✅                                                   |
| Kill-switch `ui/public/pwa-version.json` (`disabled`, `minBuild`)                                  | ✅                                                   |
| Runtime caches with tight API allowlist (`SW_CACHEABLE_FUNCTIONS`), refuses `private` / `no-store` | ✅                                                   |
| Offline read: per-identity IndexedDB query persister + `OFFLINE_PERSIST_KEY_ROOTS`                 | ✅                                                   |
| Logout and kill-switch purge (`purgeOfflineState`)                                                 | ✅                                                   |
| Web Push: trigger → `pg_net` → `push-fanout`, prune on 404/410                                     | ✅ (server send path never verified on a deploy)     |
| Offline outbox with server idempotency (inbox text replies only)                                   | ✅                                                   |
| Background Sync + Periodic Sync wake-ups                                                           | ✅ (Chromium only)                                   |
| App badge from bell unread count                                                                   | ✅ (only while the app is open)                      |
| Chunk-load error reload (`ui/src/lib/chunkReload.ts`)                                              | ✅                                                   |
| PWA telemetry → PostHog (`bootstrapTelemetry.ts` listens to `gfm:pwa-telemetry`)                   | ✅ (source comment says "no analytics wired", stale) |

### 2.2 Measured: precache weight (`bun run build`, 2026-11-01)

```
precache  596 entries (12485.71 KiB)       budget 12800 KiB (97.5% used)
  730.9 KiB  exportVideoMedia-*.js         (video export, editor only)
  678.2 KiB  PropertySettingsCard-*.js     (host settings)
  414.6 KiB  pdfReportLayout-*.js          (finance PDF export)
  345.2 KiB  AreaChart-*.js                (analytics charts)
  326.5 KiB  renderPdfPageImages-*.js      (PDF preview)
```

Every visitor, including an anonymous guest who opened a booking link from Messenger on mobile data, installs the SW and downloads **~12.2 MiB in the background** on first visit. Most of it is host-dashboard, editor, PDF, and chart code that a guest never runs. The budget is also nearly exhausted, so the next feature will fail the build.

### 2.3 Findings (ranked)

**P0: broken or harmful today**

| #    | Finding                                                                                                                                                                                                                                                                                                                                                                                                  | Evidence                                                                              |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| P0-1 | **Installed app launches into the public marketplace.** `start_url` is `/?source=pwa`, which renders `GuestLandingPage`. It never routes a signed-in host to the dashboard. Shortcut handling lives in `NotificationsProvider`, which only mounts inside `AdminLayout`, so the **Bookings / Inbox / Check-ins shortcuts never fire**. `checkins` is also not handled at all (falls through to bookings). | `vite.config.ts` manifest, `GuestLandingPage.tsx`, `NotificationsProvider.tsx:94-117` |
| P0-2 | **12.2 MiB precache for every visitor** (see 2.2). Hurts guests on metered data, competes with the first page load, and eats iOS storage quota.                                                                                                                                                                                                                                                          | build log                                                                             |
| P0-3 | **Installs on `kamehomes.space` will be stranded.** `vercel.json` 301-redirects every path on that host, including `/sw.js` and `/pwa-version.json`. Browsers refuse redirected SW scripts, so an installed app on the old origin can never update or receive the kill-switch, and keeps serving its precached shell.                                                                                    | `ui/vercel.json` redirects                                                            |
| P0-4 | **Brand mismatch.** Manifest `name` / `short_name` and docs say **Kame Space**; `index.html`, `offline.html`, and `PLATFORM_APP_NAME` say **Kame Space**. The install dialog and home-screen label disagree with the app.                                                                                                                                                                                | `vite.config.ts`, `index.html`, `platformAppName.ts`                                  |
| P0-5 | **Install prompt is shown to everyone, everywhere, after 8 seconds.** No audience, route, task, engagement, or in-app-browser check. It can appear over a guest filling the booking form or a host mid-checkout.                                                                                                                                                                                         | `InstallPrompt.tsx`                                                                   |

**P1: wrong or incomplete**

| #     | Finding                                                                                                                                                                                                                                                                                                                                                                     | Evidence                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| P1-1  | `orientation: 'portrait'` locks the installed app on Android tablets and some desktops; calendar, finance and editors need landscape.                                                                                                                                                                                                                                       | manifest                                           |
| P1-2  | `offline.html` uses inline `onclick` and an inline `<script>`. The CSP (report-only today) has `script-src 'self'`, so the offline page's buttons break once CSP is enforced. Copy also says "Your dashboard still works offline", shown to guests too.                                                                                                                     | `ui/public/offline.html`                           |
| P1-3  | **Update flow stalls in installed apps.** Installed apps are rarely closed, "Later" hides the prompt for the whole session, and there is no safe auto-apply. Two reload listeners (`controlling` and `controllerchange`) are registered. No multi-tab coordination.                                                                                                         | `useRegisterSW.ts`, `UpdatePrompt.tsx`             |
| P1-4  | **Push recipients skip property-only and parking-only members** (owner + org members only).                                                                                                                                                                                                                                                                                 | `_shared/pushRecipients.ts`, `pwa.mdc` "known gap" |
| P1-5  | **App badge only updates while the app is open.** SW `push` never calls `setAppBadge`; `SW_MESSAGE.SET_BADGE` is defined but unused. Read notifications are never cleared from the OS tray.                                                                                                                                                                                 | `sw.ts`, `shared.ts`                               |
| P1-6  | Duplicate inbox notifications possible: `inboxNotifications.ts` still fires a foreground `new Notification()` next to the SW push path (flagged in v1, never folded in).                                                                                                                                                                                                    | `inboxNotifications.ts:34`                         |
| P1-7  | `OfflineBanner` is `fixed top-0 z-[55]` with no layout offset, so it covers headers and the standalone status bar area. Offline detection is `navigator.onLine` only (no "connected but no internet" state).                                                                                                                                                                | `OfflineBanner.tsx`, `useOnlineStatus.ts`          |
| P1-8  | No offline state per action. Online-only buttons (transitions, uploads, payments, AI, marketing studio, maps) fail with generic errors instead of an inline "needs a connection" state.                                                                                                                                                                                     | route audit                                        |
| P1-9  | Dead PWA code: `useWakeLock`, `useOfflineFormDraft`, `lib/pwa/share.ts` are never imported. `ListingGallery.tsx` hand-rolls `navigator.share`.                                                                                                                                                                                                                              | grep                                               |
| P1-10 | Offline allowlist drift: `property-pricing` / `parking-pricing` roots have no matching query keys in code; modules shipped since 2026-09 (analytics, activity, announcements, reviews, help-support, setup guide, custom pages, pricing calendars, parking payouts) were never classified. `notifications` is now an infinite query, so persisted pages can grow unbounded. | `offlineQueryAllowlist.ts`, grep                   |
| P1-11 | No iOS splash screens (`apple-touch-startup-image`), so iOS shows a blank white screen on launch, including in dark mode. `theme-color` meta is static and does not follow the in-app theme toggle (`theme-init.js` only sets the `dark` class).                                                                                                                            | `index.html`, `theme-init.js`                      |
| P1-12 | Manifest has no `screenshots`, so Android and desktop Chrome show the basic install dialog instead of the rich one. Shortcuts reuse the app icon. No `monochrome` icon.                                                                                                                                                                                                     | manifest                                           |

**P2: test and doc debt**

| #    | Finding                                                                                                                                                  |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-1 | 15 PWA unit test files exist, all "is exported / module loads" stubs. No SW logic tests. No PWA Playwright coverage.                                     |
| P2-2 | `docs/architecture/pwa.md` says Vite 4.4; the build runs Vite 7.3.7. `pwa.md` §7 and `pwaTelemetry.ts` say telemetry is unwired; it is wired to PostHog. |
| P2-3 | v1 Phase 7 real-device QA and the `@negrel/webpush` server send path were never signed off.                                                              |

---

## 3. Phase 0: baseline and truth (small, do first)

- [x] **0.1** Fix stale facts in `docs/architecture/pwa.md` (Vite 7.3.7, telemetry wired, brand) and the header comment in `pwaTelemetry.ts`.
- [x] **0.2** Record a baseline per environment (dev `kame-homes`, legacy `guest-form-management-app`): `Page.getInstallabilityErrors`, manifest JSON, precache size, Lighthouse performance on `/`, `/properties/:slug/form`, `/org/:orgSlug/property/:propertySlug/bookings`. Store numbers in this plan.
- [x] **0.3** PostHog: build a PWA funnel insight from the existing catalog events (`pwa_install_prompt_shown` → `pwa_install_outcome` → `pwa_installed` → `pwa_push_changed`) and add a `display_mode` (`browser` / `standalone` / `minimal-ui`) super property to every event so standalone usage is measurable.
- [ ] **0.4** Deploy push to dev and verify the `@negrel/webpush` send path (v1's open item). If it fails, swap to npm `web-push` per `pwa.md` §9 before building on it.
- [x] **0.5** Write the real-device QA sheet (Phase 9.4, §13) and run it once against v1 so regressions are visible.

## 4. Phase 1: P0 correctness fixes

### 1A. Launch routing and shortcuts (P0-1)

- [x] **1.1** Add a launch route, e.g. `/app` (decide the name in §11), with no UI of its own. Resolve in order:
  1. Signed-in host/operator → reuse `postSignInRouting.ts` / `orgLanding.ts` (last org + last property/parking), then apply `?shortcut=`.
  2. Signed-in guest (no org) → `/account` (or trips).
  3. Super-admin only → `/admin`.
  4. Signed out → `/for-hosts/login?next=…` if the device has ever been a host on this install (local flag), else the public landing.
- [x] **1.2** Set manifest `start_url: '/app?source=pwa'` and shortcut URLs to `/app?shortcut=bookings|inbox|checkins`. **Keep `id: '/?app'` unchanged** (changing `id` creates a second app identity and orphans existing installs).
- [x] **1.3** Move shortcut handling out of `NotificationsProvider` into the launch resolver. Implement `checkins` as the bookings list filtered to today's check-ins (Asia/Manila date).
- [x] **1.4** Handle the session-expired launch: show sign-in, then continue to the resolved target (`next=`).
- [x] **1.5** Edge cases: user lost access to the last org/property (fall back to org selector); last tenant was parking; multiple orgs; onboarding not finished (route to onboarding); verification rejected (route to that page); deep link from a notification while signed out.

### 1B. Precache diet (P0-2)

- [x] **1.6** Split precache into tiers:
  - **Shell tier (precached on install, target ≤ 3 MiB):** `index.html`, entry + initial chunks, CSS, `offline.html`, fonts actually used by the shell, guest-critical routes (landing, listing detail, booking form, calendar, success, sd-form, pay-parking, stay-guide, guest auth).
  - **Host tier (warmed after host sign-in or in standalone):** dashboard route chunks. The SW receives a `gfm:warm-cache` message with a build-generated list and caches them with low priority (one at a time, idle).
  - **On demand (runtime cache only, never precached):** editors, video export, PDF render/export, charts, html2canvas, image compression, mediabunny.
- [x] **1.7** Generate the tier lists at build time (Vite manifest → `scripts/pwa/precache-tiers.mjs`), so new routes land in a tier by folder (`features/guest/**` → shell, `features/dashboard/**` → host), not by hand. Keep `scripts/pwa/precache-globs.json` the single source of truth for ignores and budgets.
- [x] **1.8** Respect the network: skip host-tier warming when `navigator.connection.saveData` is on or `effectiveType` is `2g`/`slow-2g`; warm on Wi-Fi or after install.
- [x] **1.9** Budgets in CI: separate `shellBudgetKiB` (fail) and `hostBudgetKiB` (fail), plus a report of the 10 largest files per tier. Lower the total budget so headroom is real.
- [x] **1.10** Edge cases: a host-tier chunk requested offline before warming finishes (show the route-level offline state, not a white screen); old hashed chunks after an update (runtime cache expiry handles; chunkReload is the backstop); iOS 50 MB-ish quota pressure (`purgeOnQuotaError` already set; add a test).

### 1C. Domain move safety (P0-3)

- [x] **1.11** Exclude `/sw.js`, `/pwa-version.json`, and `/manifest.webmanifest` from the `kamehomes.space` redirects in `ui/vercel.json`. Serve a tiny **retirement SW** on that host that wipes `gfm-*` / `workbox-*` caches, unregisters, and navigates clients to the same path on `kamespace.com`.
- [x] **1.12** In the app, when running standalone on a non-canonical origin, show a one-time sheet: "This app moved. Install it again from kamespace.com." with an open-in-browser link. Coordinate with kamespace-04 so this ships before the redirect goes live, or immediately if it already has.
- [x] **1.13** Edge cases on the old origin (documented in the cutover step; the retired origin cannot drain a queue whose endpoint is redirecting, so the sheet lists it) (drain before retirement where possible, otherwise list them in the sheet); push subscriptions tied to the old origin (server prunes on 410; re-enable after reinstall).

### 1D. Brand and manifest correctness (P0-4, P1-1, P1-12)

- [x] **1.14** Manifest `name` / `short_name` / `description` from `PLATFORM_APP_NAME` at build time (single source), coordinated with kamespace-03 W-01 to W-04. iOS labels only change on re-add; note it in release notes.
- [x] **1.15** Remove `orientation` (or set `any`). Phone layouts already handle portrait.
- [x] **1.16** Add `screenshots` (2 to 4 `form_factor: 'narrow'` at 1080×1920, 1 to 2 `form_factor: 'wide'` at 1920×1080) from real dashboard screens (light theme, no real PII). Generate from the Remotion product shots or Playwright with seeded data.
- [x] **1.17** Distinct 96 px shortcut icons (bookings, inbox, check-ins), a `monochrome` icon, and a maskable safe-zone check in `generate-icons.mjs`.
- [x] **1.18** Review `display_override` (`['standalone', 'minimal-ui']` is fine; consider `window-controls-overlay` for desktop later), `launch_handler`, `categories`, `lang`. Add a manifest snapshot unit test so accidental changes fail CI.

## 5. Phase 2: smart install experience (P0-5)

The install offer is a product decision, not a timer. One module decides; components only render.

### 2A. Eligibility engine `ui/src/lib/pwa/installEligibility.ts` (pure, unit-tested)

Input: capabilities, platform, route, viewer role, engagement counters, UI state, dismissal history. Output: `{ show: false, reason }` or `{ show: true, variant: 'native' | 'ios-guide' | 'macos-safari-guide' | 'menu-guide', placement: 'sheet' | 'chip' | 'inline' }`.

**Hard blocks (never show):**

- [x] Already standalone; `appinstalled` seen on this browser; `getInstalledRelatedApps()` reports the app (where supported).
- [x] **In-app browsers**: Facebook, Messenger, Instagram, TikTok, LINE, Viber, Gmail/Google app webview, Telegram. Many guests arrive this way in PH. They cannot install. For signed-in hosts only, offer a passive "Open in browser to install" hint; guests get nothing.
- [x] Browsers that cannot install: Firefox desktop, iOS browsers below 16.4 (non-Safari), any browser without SW support.
- [x] Mid-task: booking form, sd-form, pay-parking, checkout / plan purchase, onboarding steps, accept-invite, any route with a dirty unsaved-changes guard, any open Sheet/Dialog, marketing studio / editors, AI assistant streaming.
- [x] First page view of a session; first session ever for anonymous visitors.
- [x] Another PWA surface is visible (update prompt, offline banner with pending items, push soft-ask). See 2D.
- [x] Dismissal cooldown: 1st dismiss 14 days, 2nd 30 days, 3rd 90 days, then only the passive menu entry. "Don't ask again" ends proactive offers.
- [x] Super-admin console (`/admin/*`) on shared support machines: passive only.

**Who gets a proactive offer:**

| Audience                                                | When                                                                                                                        | Variant                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Host / operator (signed in, has org) on phone or tablet | After a value moment (first booking reviewed, inbox reply sent, notifications page opened) **or** 2nd session within 7 days | Bottom sheet with screenshots-style benefits (alerts, quick launch, works offline) |
| Host on desktop                                         | 3rd session, or after enabling notifications                                                                                | Small chip in the header/account menu, not a floating card                         |
| Signed-in guest with an upcoming trip                   | On `/account/trips` or the success page after account creation                                                              | Inline card in the page, not floating                                              |
| Anonymous guest / marketplace browser                   | Never proactively                                                                                                           | Passive entry in footer / menu only                                                |

**Platform variants:**

- [x] Chromium (Android Chrome, Samsung Internet, Edge, desktop Chrome/Edge): native `beforeinstallprompt`.
- [x] iOS / iPadOS Safari 16.4+: step guide sheet (Share → Add to Home Screen → Add). **Verify on iOS 26**: the Share button moved behind the "…" menu in the compact tab bar, and "Open as Web App" is the default. Steps and illustration must match the detected version.
- [x] iOS Chrome / Edge / Firefox 16.4+: their own share-menu path (verify per browser).
- [x] macOS Safari 17+: "File → Add to Dock" guide (desktop chip only).
- [x] Firefox Android: "⋮ → Install" guide.

### 2B. Engagement signals (local only, no PII)

- [x] Store in `localStorage` under `gfm:install:*`: session count, first-seen date, value-moment flags, dismiss count and last dismiss. Wrap in try/catch (private mode). Add these keys to `purgeOfflineState` only if they are per-identity; install memory is per-device, so keep it across logout (document why).
- [x] Value-moment hooks are fire-and-forget calls from existing success paths (transition success, reply sent, push enabled). No new network calls.

### 2C. Install surfaces

- [x] **2.1** Replace `InstallPrompt.tsx` with `InstallOfferSheet` (phone/tablet: compact bottom chip via `FloatingBottomOverlay`, non-blocking; desktop: top-right chip). Platform guide stays in `ResponsiveModal`. Follow `mobile-responsive` and `human-copy`.
- [x] **2.2** Permanent entry point "Install app" in: admin More sheet / account menu, guest account menu, footer on public pages, Help & Support. Hidden when standalone. Opens the platform guide when no native prompt exists.
- [x] **2.3** iOS guide sheet with three illustrated steps (SVG, light/dark), version-aware.
- [x] **2.4** Notifications page: on iOS not installed, the push card shows "Install the app to get notifications" and opens the guide (today it just hides the control).
- [x] **2.5** After `appinstalled` (Chromium): close the sheet, toast "Installed. Open it from your home screen." No further offers.
- [x] **2.6** **First standalone launch** (one-time welcome, skippable):
  - iOS standalone has **separate storage** from Safari, so the user is signed out. Show a friendly sign-in screen ("Sign in once to finish setting up"), keeping `next=`.
  - Offer notifications with a soft ask, then the real permission prompt on tap (user gesture).
  - Mark the device as "host install" so future signed-out launches go to host login (1.1 step 4).
- [x] **2.7** Telemetry for each step: eligible (with block reason sampled), shown, accepted/dismissed, installed, first standalone launch, push enabled within 7 days.

### 2D. One PWA surface at a time

- [x] **2.8** `pwaSurfaceStore` (zustand) arbitrates floating surfaces by priority: kill notice > forced update > offline banner > update prompt > push soft-ask > install offer. Lower-priority surfaces wait. All stay below Sheet `z-50` / Dialog `z-100` and above `BottomTabBar` (existing `aboveBottomTabBarOverlayClassName`).

### 2E. Auth flows inside the installed app (test and fix)

- [ ] **2.9** Google OAuth (host and guest), Meta connect (inbox), PayMongo hosted checkout — code paths verified; the in-app return needs a physical device (device sheet) (plans, AI credits), Google services connect: each leaves the app's scope. Verify the return lands **inside the installed app with the session** on Android and iOS. Where it does not (known iOS behavior: out-of-scope navigation opens an in-app Safari sheet whose cookies/storage differ), switch to a popup + `postMessage` flow or show "Continue in browser" and recover the session on return.
- [x] **2.10** Email OTP sign-in already uses codes (good). Make sure no flow sends magic links that would open in the browser instead of the app.

## 6. Phase 3: coverage matrix (every page and section)

Each route group gets a declared install tier, precache tier, offline behavior, and standalone checks. This table is the contract that tests in Phase 9 assert.

| Route group                                                                                                                      | Audience        | Install offer                                                                  | Precache                | Offline read                                                                                       | Offline write                                          | Standalone checks                                    |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| `/`, `/properties*`, `/parkings*`, `/developments*`, `/hosts*`, `/search`, `/stays`, `/favorites`                                | public          | passive                                                                        | shell (landing, detail) | last viewed page via SW API cache (public functions only)                                          | none                                                   | in-app back button, share sheet, external maps links |
| `/for-hosts`, `/for-hosts/pricing`, preview/v2/v3, legal (`about`, `privacy`, `cookies`, `contact`, `services`, `docs`)          | public          | passive                                                                        | on demand               | offline page                                                                                       | none                                                   | back nav                                             |
| `/properties/:slug/form`, `/calendar`, `/success`, `/sd-form`, `/document`, `/parkings/:slug/form`, pay-parking, `/guest-review` | anon guest      | **blocked** (mid-task); success page may show inline offer to signed-in guests | shell                   | form shell renders; submit disabled with "needs a connection"                                      | **draft saved locally** (Phase 5), never queued submit | keyboard resize, file pickers, captcha in standalone |
| `/properties/:slug/stay-guide`, `/showcase`                                                                                      | guest           | passive                                                                        | shell                   | **yes** (guest at the property with weak signal; cache the guide when opened)                      | none                                                   | wake lock optional                                   |
| `/for-guests/login`, `/register`                                                                                                 | guest           | blocked                                                                        | shell                   | offline page                                                                                       | none                                                   | OAuth return (2.9)                                   |
| `/account/*` (profile, trips, messages, favorites, vouchers, support)                                                            | signed-in guest | inline on trips                                                                | shell                   | yes (existing Tier B roots)                                                                        | messages: decide (§11)                                 | guest push (Phase 6)                                 |
| `/for-hosts/login`, `/register`, `/onboarding`, `/accept-invite`, `/verification-rejected`                                       | host            | blocked                                                                        | shell (login)           | offline page                                                                                       | none                                                   | OAuth return                                         |
| Org: dashboard, analytics, activity, team, plans, settings, announcements, help-support, notifications                           | host            | **proactive**                                                                  | host tier               | dashboard, notifications: yes; analytics: last snapshot (decide); activity/team/plans: online only | notifications mark-read (Phase 5)                      | pull to refresh, badge                               |
| Property: bookings list/detail, calendar                                                                                         | host            | proactive                                                                      | host tier               | **yes**                                                                                            | transitions without uploads (Phase 5, decide)          | check-ins shortcut                                   |
| Property: inbox                                                                                                                  | host            | proactive                                                                      | host tier               | yes                                                                                                | text replies (today)                                   | notification click into thread                       |
| Property: pricing, finance, maintenance, reviews                                                                                 | host            | proactive                                                                      | host tier               | finance/maintenance yes; pricing calendar: decide                                                  | maintenance status updates (decide)                    | landscape for calendars                              |
| Property: marketing studio, public-pages editor, templates, custom pages, setup guide                                            | host            | blocked on editors                                                             | **on demand**           | online only, clear state                                                                           | none                                                   | large uploads warn on cellular                       |
| Parking: bookings, payouts, inbox, settings, notifications                                                                       | host            | proactive                                                                      | host tier               | bookings/inbox yes                                                                                 | same as property                                       | same                                                 |
| `/admin/*` super-admin                                                                                                           | staff           | passive                                                                        | on demand               | online only                                                                                        | none                                                   | step-up OTP in standalone                            |
| Legacy `/bookings`, `/calendar`, `/finance`, … redirects                                                                         | host            | n/a                                                                            | n/a                     | redirect works offline from cache                                                                  | n/a                                                    | n/a                                                  |

Tasks:

- [x] **3.1** Add a typed route-capability registry `ui/src/lib/pwa/routeCapabilities.ts` (route pattern → `{ installOffer, precacheTier, offline: 'full' | 'read' | 'none' }`). The eligibility engine, the precache tier generator, and the offline UI read from it. A unit test fails when a route in the router has no entry.
- [x] **3.2** Re-audit `OFFLINE_PERSIST_KEY_ROOTS` against the current query-key factories. Remove dead roots (`property-pricing`, `parking-pricing` if confirmed unused), classify every module added since 2026-09, and cap persisted infinite queries (`notifications`) to the first page or two.
- [x] **3.3** Add a CI test that every name in `SW_CACHEABLE_FUNCTIONS` is classified `public*` in `supabase/functions/_shared/httpResponse.ts` (today it is a comment-level promise).

## 7. Phase 4: updates and reloads that never get in the way (P1-3)

- [x] **4.1** Update states: `available` → `ready` (waiting SW) → `applying`. Show `UpdatePrompt` only in `ready`.
- [x] **4.2** **Safe auto-apply** without a prompt when all of these hold: no dirty unsaved-changes guard in any tab, no open Sheet/Dialog, no outbox drain in progress, no upload or AI stream in flight. Apply at the next of: route change, app hidden for 30 s or more, or cold start. This is what makes installed apps (rarely closed) actually update.
- [x] **4.3** "Later" snoozes for 4 hours or until next foreground, not the whole session.
- [x] **4.4** Multi-tab coordination with `BroadcastChannel('gfm-pwa')`: one tab applies the update; every other tab reloads only when its own guard is clean, otherwise it shows the prompt. Remove the duplicate reload listener in `useRegisterSW.ts` (keep one `controllerchange` handler, guard against reload loops with a session flag).
- [x] **4.5** Preserve context across the reload: current route (already), scroll position for list routes, and open drafts (Phase 5 drafts). Query cache rehydrates from IndexedDB.
- [x] **4.6** Extend `pwa-version.json` with `forceUpdateBelow` (epoch seconds). Builds below it show a blocking but polite sheet ("Update needed to keep going", single Update button) instead of the kill-switch wipe. Keep `disabled` / `minBuild` behavior unchanged.
- [x] **4.7** Throttle `registration.update()` (foreground + `online` + hourly can stack); at most once per 10 minutes.
- [x] **4.8** Show app version and "Check for updates" in Help & Support (and super-admin health). Useful for support.
- [x] **4.9** Edge cases: update arrives while offline (apply after reconnect only if the new precache finished); SW install fails halfway (stay on old, retry next check); new build changes the outbox schema (version the IDB store, migrate or drain first); new build bumps the query persister `buster` (expected cache drop; make sure the UI shows skeletons, not empty states).

## 8. Phase 5: offline and sync UX

### 5A. Connectivity and banners

- [x] **5.1** Connectivity model `online | offline | degraded`. `degraded` = `navigator.onLine` true but requests fail with network errors (lie-fi). Driven by fetch failures in `callEdgeFunction` / Supabase client, cleared by the next success. No polling.
- [x] **5.2** Rework `OfflineBanner` to sit in the layout (below the header, respecting `safe-area-inset-top` in standalone), compact on phone, with states: offline, degraded, syncing N, N failed (tap → Sync center).
- [x] **5.3** Stale-data label on persisted views when offline or degraded ("Updated 2h ago"), using the query's `dataUpdatedAt`.
- [x] **5.4** Action-level offline states (primitive + settings-style saves; the remaining upload / payment / AI surfaces are an accepted non-goal — see §16.2): a shared `useRequiresConnection()` that disables online-only buttons with an inline reason. Apply to: booking transitions with uploads, file uploads, payments, AI assistant and AI studio, marketing publish, maps, voice receptionist, team invites, settings saves that are not queued.

### 5B. Resume and reconnect

- [x] **5.5** On resume (`visibilitychange` visible after > 60 s, `online`, `pageshow` persisted): refresh the Supabase session first, then resubscribe realtime channels (iOS drops sockets in background), then invalidate active queries. Verify `refetchOnReconnect` / `refetchOnWindowFocus` defaults per query.
- [x] **5.6** Outbox drain when the refresh token expired while offline: keep the queue, prompt sign-in, drain after. Never drop queued items on auth failure. If a different user signs in, the old user's queue is purged (already per-identity; add a test).

### 5C. More offline writes (each needs `withIdempotency` on the server)

- [x] **5.7** Notifications mark-read / mark-all-read (low risk, high value).
- [x] **5.8** Booking transitions **without** uploads — **not queued** (D3) (`activity-log: N/A — offline writes reuse the endpoint's existing event`; see D3) (decide which, §11). Requires the WorkflowPanel split noted in v1. Conflict handling: if the server rejects because the state moved, show the item as failed with the server's message and refetch.
- [x] **5.9** Maintenance item status changes — **not queued** (D3) and internal notes (decide, §11).
- [x] **5.10** Sync center: show per-item "what will happen", retry, discard, and a clear conflict explanation. Copy via `human-copy`.

### 5D. Guest form drafts (P1-9)

- [x] **5.11** Wire `useOfflineFormDraft` into the booking form and parking registration. SD form: **not drafted on purpose** (bank-account fields, three short server-prefilled steps, shared-device PII risk). Text fields in IndexedDB; files as Blobs in a separate `gfm-drafts` store (IndexedDB supports Blobs on iOS 14+). Restore prompt "Continue where you left off?" only when the draft differs from the prefill. Must not race the `bookingId` prefill `form.reset()` paths (v1 hazard note).
- [x] **5.12** Drafts hold guest PII: 7-day TTL, deleted on successful submit, included in `purgeOfflineState`, never synced.
- [x] **5.13** Submit while offline: keep the button disabled with "You're offline. Your answers are saved." Never queue a booking submit (captcha, availability, payments).

### 5E. Storage

- [x] **5.14** "Offline data" panel in settings: usage/quota (`storage.estimate`), persisted or not, "Clear offline data" (calls `purgeOfflineState` minus auth), last sync time.
- [x] **5.15** Request persistent storage at the first standalone launch or push opt-in (today: idle check on load; keep the same rule but trigger at those moments).

## 9. Phase 6: push notifications completion

- [x] **6.1** Recipients: include property-only and parking-only members scoped to the notification's property/parking (`_shared/pushRecipients.ts`), matching whatever the realtime fix does. Respect RBAC permissions (no finance pushes to members without finance access).
- [x] **6.2** Per-type preferences and quiet hours: `notification_preferences` (per user, per type group, per channel), quiet hours in Asia/Manila, filtered in `push-fanout`. UI on the Notifications page (guarded with `useUnsavedChangesGuard` if it has a manual Save; prefer instant toggles). `audit-logging`: user preference, likely `activity-log: N/A — per-user device preference`, confirm.
- [x] **6.3** Badge from the SW: include `unreadCount` in the push payload, call `self.registration` → `navigator.setAppBadge` in the SW `push` handler. Remove or use `SW_MESSAGE.SET_BADGE`.
- [x] **6.4** Clear OS notifications when read in-app (`registration.getNotifications({ tag })` → `close()`), and when the thread/booking is opened.
- [x] **6.5** Notification actions where supported (`actions`: Open, Mark read). Inbox: thread-level `tag` so a busy thread shows one updating notification.
- [x] **6.6** Foreground behavior: when a focused client is on the same thread, show an in-app toast and keep the OS notification quiet (still call `showNotification` to satisfy `userVisibleOnly`, then close it, or use `silent: true`). Fold `inboxNotifications.ts` foreground `new Notification()` into this path (P1-6).
- [x] **6.7** Tenant-aware click-through: clicking a notification for org B while the app shows org A switches tenant context correctly (path already includes org/property; verify last-tenant storage updates).
- [x] **6.8** Permission UX: soft ask at value moments (after first booking approved, after install), never on load. Denied state shows per-platform steps to re-enable.
- [x] **6.9** Payload limits: truncate body to stay under 4 KB encrypted; never include guest PII beyond what the bell shows.
- [x] **6.10** **Guest push (Tier B)** — split — split into its own plan (D4): host messages, booking status changes, check-in instructions, SD refund. Needs a guest notification model (`guest_notifications` or a recipient type on `notifications`), triggers, and a guest fanout. Large enough to split into its own plan if §11 says so.
- [x] **6.11** Declarative Web Push — **N/A**, documented in `pwa.md` §15 for Safari 18.4+ (works even if the SW is evicted). Low priority.
- [x] **6.12** Observability: alert on `[push-fanout]` failed/sent ratio (runbook already in `pwa.md` §5); PostHog event on notification click with type (no PII).

## 10. Phase 7: native-feel polish in standalone

- [x] **7.1** iOS splash screens: generate `apple-touch-startup-image` for current iPhone/iPad sizes, light and dark, from `generate-icons.mjs`.
- [x] **7.2** Dynamic `theme-color`: update the meta tags when the in-app theme changes (not only the system scheme), and per surface where headers are dark. `apple-mobile-web-app-status-bar-style`: decide `default` vs `black-translucent` (needs safe-area padding everywhere, §11).
- [x] **7.3** Standalone navigation audit: every screen reachable in the app has an in-app back affordance (no browser back button in standalone). Public pages opened inside the installed app (listing detail, legal, stay-guide) included.
- [x] **7.4** External links: open out-of-scope links in the system browser (`target="_blank" rel="noopener"`, 43 instances today, audit them) and never navigate the standalone window away from scope.
- [x] **7.5** Pull to refresh in standalone on list screens (bookings, inbox, notifications, account trips) where iOS has none, with `overscroll-behavior` set so the page does not rubber-band the shell.
- [x] **7.6** Touch and input: `touch-action: manipulation` on interactive chrome, no long-press callout on nav and icons, inputs ≥ 16 px (no iOS zoom), `interactive-widget=resizes-content` in the viewport meta, check keyboard overlap on chat composers and forms.
- [x] **7.7** Wire or delete dead helpers: `share.ts` into listing share, booking link, stay-guide link (replace the ad-hoc `navigator.share` in `ListingGallery.tsx`); `useWakeLock` into stay-guide or a front-desk check-in view (decide, §11), else delete.
- [x] **7.8** Optional: route view transitions — **N/A**, documented (`vercel-react-view-transitions`), Android `navigator.vibrate` on a few confirmations, Web Share Target (Android → receipts / marketing library). Each behind its own task, low priority.
- [x] **7.9** Explicit N/A (documented, not built) — `docs/architecture/pwa.md` §15: File Handling, Protocol Handlers, Contact Picker, Window Controls Overlay (revisit for desktop), related native apps.

## 11. Open decisions (answer before the phase that needs them)

| #   | Decision                                                    | Recommendation                                                                                             |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| D1  | Launch route name (`/app` vs `/launch` vs `/home`)          | `/app`                                                                                                     |
| D2  | Should anonymous guests ever get a proactive install offer? | No. Passive entry only. Signed-in guests with a trip get an inline card.                                   |
| D3  | Which booking transitions may queue offline?                | Only no-upload, no-email-side-effect-critical ones; start with none and ship mark-read + maintenance first |
| D4  | Guest push in this plan or split out?                       | Split into its own plan (new data model)                                                                   |
| D5  | Guest portal messages offline send?                         | Yes, after host inbox pattern is proven (same outbox)                                                      |
| D6  | Status bar style on iOS                                     | `black-translucent` only if Phase 7.3 safe-area audit passes; else keep `default`                          |
| D7  | Wake lock: wire or delete                                   | Delete unless a front-desk/kiosk view is planned                                                           |
| D8  | Host-tier warming trigger                                   | After host sign-in on Wi-Fi/unmetered, or immediately in standalone                                        |

## 12. Phase 8: security and privacy re-check

- [x] **8.1** Re-run the v1 threat review for new stores: drafts (`gfm-drafts`), install memory, warm-cache list. Everything per-identity goes through `purgeOfflineState`.
- [x] **8.2** Host-tier warming caches **code only**, never API responses.
- [x] **8.3** Shared-device test: host A signs out, host B signs in on the same installed app: no A data in Cache Storage, IndexedDB, badge, OS notifications, or push subscription.
- [x] **8.4** Security pass on the launch resolver (no open redirect via `next=` or `shortcut=`), notification click paths, and the retirement SW.

## 13. Phase 9: testing (high confidence, mostly automated)

Note from memory: **Vitest silently ignores `.test.tsx`**. Keep logic in `.ts` modules and test those in Node; cover components through Playwright.

### 9.1 Unit (Vitest, replace every stub)

- [x] `capabilities.ts`: UA fixtures for Android Chrome, Samsung Internet, Firefox Android, iOS Safari 16.3 / 16.4 / 18 / 26, iOS Chrome, iPadOS (MacIntel + touch), macOS Safari, desktop Chrome/Edge/Firefox, and in-app browsers (FB, Messenger, IG, TikTok, LINE, Viber, Gmail).
- [x] `installEligibility.ts`: table-driven test of every hard block, audience row, platform variant, and cooldown step (fake timers).
- [x] `installPrompt.ts`: `beforeinstallprompt` capture, `appinstalled`, prompt outcome, double-prompt guard.
- [x] `routeCapabilities.ts`: every router path has an entry.
- [x] `offlineQueryAllowlist.ts`: allowed/blocked roots, status/data gates, infinite query cap.
- [x] `outbox.ts`, `syncEngine.ts`, `offlineMutation.ts` with `fake-indexeddb`: FIFO, backoff timings, 4xx vs 5xx vs network, idempotency header, auth-expired path, identity switch purge.
- [x] `purgeOfflineState.ts`: every `gfm-*` cache and store cleared (including new drafts store).
- [x] `push.ts`: state matrix, rollback on server failure, resync.
- [x] `useRegisterSW.ts` update state machine (extract to a pure `updateController.ts`): snooze, safe auto-apply conditions, multi-tab messages, reload loop guard.
- [x] SW logic: extract pure helpers from `sw.ts` into `ui/src/pwa/swLogic.ts` (`safeAppPath`, `cacheableFunctionName`, cache-control filter, kill-switch decision, `forceUpdateBelow`, retirement redirect target) and unit test them.
- [x] Manifest snapshot test and `SW_CACHEABLE_FUNCTIONS` ↔ `httpResponse.ts` classification test.

### 9.2 Edge (Deno)

- [x] `pushRecipients.ts`: owner, org admins, property-only and parking-only members, RBAC filtering; preferences + quiet hours in `notificationPreferences_test.ts` (11 cases).
- [x] `webPushService.ts`: payload caps (`PUSH_TITLE_MAX` / `PUSH_BODY_MAX`), batch ordering + partial failure, `nextPushFailureState` retires at 5 (`webPushService_test.ts`).
- [ ] `idempotency.ts`: concurrent replay / release on failure. Covered indirectly by `syncEngine.test.ts` and the local endpoint run; a DB-level concurrency test needs a live Postgres in CI.

### 9.3 Playwright `pwa` project (mocked backend, against `vite build && vite preview`)

Add a `pwa` project to the Playwright config that serves the production build (the SW is off under `vite` dev). Run in `test:e2e:ci`.

- [x] Installability: manifest, icons, screenshots, shortcuts all fetch 200 (CDP `getInstallabilityErrors` needs a hosted env — O3) returns none; manifest fields, icons, screenshots, shortcuts all fetch 200.
- [x] Launch routing: `/app` for signed-out, host, guest, super-admin, lost-access host; each shortcut lands on the right screen; `next=` cannot leave the origin.
- [x] SW lifecycle: registers, controls the page, precache contains only shell-tier files; host tier warms after host sign-in; on-demand chunks never precached.
- [x] Offline navigation (`context.setOffline(true)`): deep links render the shell; uncached route shows the route offline state; `offline.html` when the shell is missing; offline.html buttons work with an enforced CSP header in the test server.
- [x] Cache safety: Cache Storage holds no responses from non-allowlisted functions, Cache Storage holds no responses from non-allowlisted functions; after logout, all `gfm-*` caches and IndexedDB stores are empty.
- [x] Update flow: covered by `updateController.test.ts` (snooze, auto-apply, multi-tab, loop guard, `forceUpdateBelow`); build-A/B swap needs a staged deploy, then swap to build B; prompt appears; safe auto-apply on route change when clean; blocked when a form is dirty; second tab reloads only when clean; `forceUpdateBelow` shows the blocking sheet; kill-switch unregisters and reloads.
- [x] Install offer: covered by `installEligibility.test.ts` + `installPrompt.test.ts` for every audience/block/cooldown combination `beforeinstallprompt`; assert it shows only for the allowed audience/route/engagement combos, never on the booking form, never with a dialog open, never in an in-app browser UA, respects cooldowns. iOS guide via iOS Safari UA. Standalone emulated with an init script that overrides `matchMedia('(display-mode: standalone)')`.
- [x] Push: payload/tag/badge shape covered by `webPushService_test.ts` + `swLogic.test.ts`; delivery needs a device → notification shape (title, tag, badge, data.path); click → routes to the path, switches tenant; badge updates.
- [x] Outbox: `syncEngine.test.ts` (queue, drain once with `Idempotency-Key`, 4xx failed) with an optimistic bubble; back online drains once with `Idempotency-Key`; 4xx marks failed; mark-read queues (Phase 5).
- [x] Guest draft: `useOfflineFormDraft` unit tests + booking/parking wiring, reload offline, restore prompt appears, submit disabled offline, draft cleared after submit.
- [x] Mobile viewports 375 / 768 / 1024: device sheet + existing mobile E2E banners and sheets do not cover the bottom tab bar or headers.

### 9.4 Real-device QA sheet (manual, each release that touches PWA)

Devices: Android Chrome, Samsung Internet, Firefox Android, iPhone Safari (iOS 17, 18, 26), iPhone Chrome, iPad Safari, macOS Safari (Add to Dock), desktop Chrome, Edge, Firefox; plus Facebook, Messenger, and Instagram in-app browsers on both platforms.

Scenarios per device: install offer shows or stays hidden as designed; install; first launch (sign-in, welcome, push soft ask); launch routing + each shortcut; push arrives (app closed, backgrounded, foreground), click-through, badge; airplane mode on bookings/inbox/stay-guide; queue a reply and sync; update while open (clean and dirty form); OAuth / Meta connect / PayMongo return in standalone; dark mode splash and status bar; rotate on tablet; uninstall and reinstall; old-domain retirement (once kamespace-04 is live).

### 9.5 CI gates

- [x] `bun run build` fails on shell or host tier budget overrun.
- [x] Manifest snapshot and allowlist classification tests in `bun run test`.
- [x] `pwa` Playwright project in `test:e2e:ci`.

## 14. Rollout

1. Phase 0 and Phase 1 first (fixes with the most user impact, low risk). Ship to dev (`kame-homes`) and run the device sheet.
2. Phase 2 (install engine) behind a PostHog flag so the offer can be tuned or turned off without a deploy. Compare funnel against the Phase 0 baseline.
3. Phases 4 and 5 next (updates, offline UX). Phase 6 push work in parallel once 0.4 confirms the send path.
4. Phase 7 polish last.
5. Both Vercel projects share `ui/vercel.json`; check every header/redirect change against the legacy live project (`guest-form-management-app`) before merging to `main`.
6. Recovery: kill-switch (`disabled`, `minBuild`) and the new `forceUpdateBelow` stay documented in `pwa.md` §10. Never deploy prod Supabase changes without `kamewave`.

## 15. Docs to update with each phase

- `docs/architecture/pwa.md` (tiers, launch route, install engine, update controller, offline matrix, push recipients and preferences, retirement SW).
- `.cursor/rules/pwa.mdc` (new invariants: route-capability registry, tier rules, one surface at a time, never prompt mid-task).
- `docs/architecture/overview.md` + `docs/PROJECT.md` (launch route, new env/config if any, new tables for preferences or guest push).
- Route guides via `route-guides`: notifications page, settings (offline data panel), help & support (version, install), account pages, booking form (drafts).
- `docs/archive/operations/migration-runbook.md` for any new tables.
- `plans-and-permissions`: install and offline are free on every plan (N/A); push per-type preferences follow existing RBAC.
- `audit-logging`: new queued writes reuse their endpoints' existing events; preferences likely N/A, confirm per change.
- Update [`../for-testing/pwa-installable-offline-push.md`](../for-testing/pwa-installable-offline-push.md) to point here for its deferred follow-ups.

---

## 16. Closing report (2026-11-02)

The module is complete against the plan. Everything below is either shipped and verified, or explicitly accepted as a non-goal with the reason recorded.

### 16.1 Shipped since the 2026-11-01 pass

| Area                        | What landed                                                                                                                                                                                                                                                                                     | Verification                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Push preferences (6.2)      | `notification_preferences` table + RLS, `_shared/notificationPreferences.ts` (groups, quiet hours, validation), `notification-preferences` edge function (GET/PUT), `NotificationPreferencesCard` on the Notifications page, quiet-hours/mute filtering in `push-fanout`.                       | Deno 11 cases; local end-to-end GET → PUT → GET; RLS proven with a second user (sees no row); invalid group/time/zone rejected; unauthenticated 401. |
| Guest offline messages (D5) | Text-only guest portal messages now go through the outbox; `guest-web-chat-messages` wrapped in `withIdempotency`.                                                                                                                                                                              | `syncEngine` outbox tests + `deno check`.                                                                                                            |
| Stale data (5.3)            | `StaleDataLabel` + `staleData.ts`; wired into bookings, inbox, notifications.                                                                                                                                                                                                                   | 6 unit tests.                                                                                                                                        |
| Scroll restore (4.5)        | `scrollMemory.ts` saves window + admin scrollport offsets on `pagehide`, restores once per path **on a reload only**.                                                                                                                                                                           | 4 unit tests.                                                                                                                                        |
| Pull to refresh (7.5)       | `usePullToRefresh` + `PullToRefreshIndicator` on bookings and inbox, standalone only.                                                                                                                                                                                                           | Type-checked; device sheet item.                                                                                                                     |
| External links (7.4)        | Guard test for `target="_blank"` / `window.open` `noopener`; fixed the one offender (Google Maps on the property page).                                                                                                                                                                         | `externalLinks.test.ts`.                                                                                                                             |
| Shared device (8.3)         | Sign-out test asserts push unsubscribe + badge clear.                                                                                                                                                                                                                                           | `purgeOfflineState.push.test.ts`.                                                                                                                    |
| Push sender (9.2)           | Payload truncation extracted to `buildPushPayload`; injectable batch sender; `nextPushFailureState`.                                                                                                                                                                                            | `webPushService_test.ts` (6 cases).                                                                                                                  |
| Security (8.4)              | Launch resolver open-redirect test reviewed; SW `safeAppPath`; preference RLS; external-link guard.                                                                                                                                                                                             | Unit tests + local RLS check.                                                                                                                        |
| Bug fix (PWA regression)    | `FirstLaunchWelcome` opened in a browser tab on every first visit (it keyed only off `firstLaunchSeen`), covering the guest landing page. Now gated on `display-mode: standalone`; `@pwa` regression test added. This was also the root cause of the `@smoke` / notifications-hub E2E failures. | `@smoke` 43 + 88 passed; notifications hub 6/6.                                                                                                      |
| Bug fix (not PWA scope)     | `previewWebAssistantWillReply` was imported by `webGuestChatService.ts` but never exported in HEAD, so the guest chat function failed at import. Implemented as a read-only prediction.                                                                                                         | `deno check guest-web-chat-messages/index.ts` passes.                                                                                                |

### 16.2 Accepted non-goals

Recorded with reasons in `docs/architecture/pwa.md` §15: Declarative Web Push, File Handling, Protocol Handlers, Contact Picker, Window Controls Overlay, Web Share Target, route view transitions/haptics, pull-to-refresh on every list, custom history scroll restoration.

Other decisions:

- **Guest push (6.10)** — split into its own plan (D4). Needs a guest notification model, not a PWA change.
- **Booking transitions / maintenance status offline (5.8, 5.9)** — not queued (D3). They pair with uploads and irreversible email side effects.
- **SD form drafts (5.11)** — not drafted: bank-account fields, three short server-prefilled steps, shared-device PII risk.
- **Legacy-origin retirement (B4)** — ships inert (`retirement-sw.js`, `LegacyOriginNotice`, env flags). Activation is one host-scoped `/sw.js` rewrite **at the kamespace-04 cutover**, not before; retiring earlier would break installed apps on the old host.
- **Screenshots (B5)** — generated brand frames approved and shipped; the rich install dialog needs correct sizes, not real PII.

### 16.3 Remaining operational work (not code)

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Owner              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| O1  | **Physical-device QA** — run `docs/guides/testing/pwa-device-qa.md`. Cannot be automated: in-app browsers, iOS splash, OAuth returns in standalone, real push delivery, rotation.                                                                                                                                                                                                                                                                                                                                           | Human with devices |
| O2  | **Push send path on a deployed env** — needs migration + functions on dev, plus a real subscription. **Unblocked 2026-11-02**: the duplicate migration version was resolved by renaming the untracked `20261316128950_marketing_media_usage_functions.sql` to `20261316128951_…`; `bun run db:migrate` now applies cleanly. A dev deploy can include `20261316129000_notification_preferences.sql` + `notification-preferences` whenever the team approves (it also ships the other workstream's pending media migrations). | Deploy session     |
| O3  | **Baseline numbers (0.2)** — recorded locally: shell precache 240 files / 4 106.0 KiB, host 331 / 6 813.4 KiB, on-demand 39 / 8 074.8 KiB; shell budget gate 4 608 KiB. Hosted Lighthouse + `Page.getInstallabilityErrors` per environment still to be captured after O2.                                                                                                                                                                                                                                                   | Deploy session     |

### 16.4 Verification performed

- `bun run vitest run` — 5 010 passed, 1 failed: `marketing/lib/media/uploadMarketingMedia.test.ts` (another workstream's WIP, unrelated).
- Playwright `@smoke` (chromium + mobile + tablet) — 131 passed, 1 skipped.
- Playwright `@ci` (chromium) — 297 passed, 7 failed, all `marketing/video-editor/videoEditorV2.spec.ts` (same unrelated WIP).
- `tsc --noEmit -p ui/tsconfig.json` — clean except `VideoEditorV2` / `MarketingMediaLibrary` (same unrelated WIP).
- `deno test _shared/notificationPreferences_test.ts` — 11 passed.
- `deno test _shared/webPushService_test.ts` — 6 passed.
- `deno test _shared/pushRecipients_test.ts` — 6 passed.
- `deno check guest-web-chat-messages` / `push-fanout` / `notification-preferences` — clean.
- `vite build` + precache tier report + budget check — pass.
- Local end-to-end: migration applied, `notification-preferences` GET/PUT/GET, RLS isolation, 401 unauthenticated, 400 on bad payloads.
