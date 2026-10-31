---
stage: done
title: 'Feature availability controls (super-admin on/off with reason)'
status: done
tags:
  [
    planning,
    super-admin,
    feature-gating,
    maintenance,
    inbox,
    pricing,
    marketing,
    analytics,
    notifications,
  ]
updated: 2026-10-29
supersedes: module-status-management.md
---

# Feature availability controls

## Goal

Super admins can turn a dashboard page, a section of a page, a modal, a button, or a background capability **off for every host** from `/admin`, pick a reason (Maintenance, Service issue, Coming soon, and so on), and hosts see that reason on the exact surface that is off instead of a broken screen, a silent failure, or an upgrade prompt. The server enforces the same switch, so an off feature can't be reached from a stale tab, the AI assistant, the offline outbox, a cron, or a webhook side effect.

v1 covers five modules only:

| Module        | Capability                  | Where hosts see it                                                                                               |
| ------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Inbox         | Facebook and Instagram chat | `/org/:o/property/:p/inbox` platform tabs, threads, composer, Channels modal, Automation                         |
| Pricing       | Channel sync                | `/org/:o/property/:p/pricing` header button + `ChannelSyncDialog`                                                |
| Marketing     | AI studio                   | `/org/:o/property/:p/marketing?tab=generate`                                                                     |
| Analytics     | AI review                   | `/org/:o/property/:p/analytics` → "AI review" section                                                            |
| Notifications | Telegram                    | `/org/:o/property/:p/notifications` + `/org/:o/parking/:k/notifications` Telegram view, plus every Telegram send |

The mechanism is generic, so adding a module later means adding a catalog entry and wrapping its surfaces. No schema change is needed.

## Relationship to existing work

- **Supersedes [`module-status-management.md`](./module-status-management.md)**. That plan proposed `module_status_registry` (live / coming_soon / maintenance) for Meta connection, Marketing Studio and Public Pages. This plan covers the same need with finer granularity (page / section / modal / button / background), a reason picker, server enforcement and expiry. Its modules become catalog entries in a follow-up (see Follow-ups). Do not build both registries.
- **`platform_settings.maintenance_mode`** stays as the whole-platform switch (`PlatformMaintenanceBanner`, `maintenanceModeResponse`). It's unrelated to this per-feature control and isn't changed.
- **Existing AI kill switches** (`AiPlatformKillSwitchCard`, `AiDashboardAssistantKillSwitchCard`, voice receptionist global settings) stay as they are. AI studio and AI review already respect the AI platform switch. Feature availability is an extra, independent check: if either one is off, the feature is off. When both are off, availability copy wins on screen because it carries a human reason.
- **Plan gates** (`useFeatureGate`, `TierBadge`, `requirePropertyFeature`) and **Team RBAC** (`hasPropertyPermission`) are unchanged. Precedence is defined below.
- **`super-admin-service-cost-monitoring.md` `serviceGuard`** (planned) is automatic cost-based degrade. This plan is the manual, human-reason switch. When `serviceGuard` ships it may _set_ an availability override as one of its hard actions, but it must not replace this table.

## Scope

**In**

- One override table + code-side catalog + resolver (server and client mirror with a parity test).
- Super-admin page `/admin/feature-availability` to turn entries on/off with reason, optional custom message, optional expected-back time, optional auto restore, optional dashboard banner, and super-admin bypass.
- Host-facing presentation per surface type: section panel, modal state, disabled button with reason, background notice, optional dashboard-wide banner.
- Server enforcement in every edge function, shared helper, cron and webhook side effect behind the 5 modules.
- AI dashboard assistant tools that reach these modules.
- Offline outbox and stale-tab behavior (503 contract).
- Super-admin audit logging, docs, route guides, tests.

**Out (v1)**

- Per-org or per-property targeting (global only). The table has room for it later; see Follow-ups.
- Scheduled _start_ times (turning off at a future time). v1 turns off immediately; expected-back + auto restore covers the end.
- "Notice only" mode (feature stays on, banner warns of degraded service).
- Guest-facing surfaces. None of the 5 modules render on guest pages. Guest web chat is not in scope.
- Turning off `ical-export` (the outbound calendar feed). See Channel sync invariants.
- Stopping Meta webhook ingestion. See Inbox invariants.
- Marketing caption AI, design-template AI and Meta publishing (`generate-marketing-caption`, `generate-marketing-template`, `publish-to-meta`). They are Marketing features but not "AI studio". Separate keys later.
- Booking AI review (receipt validation, `booking-ai-review`). It shares the words "AI review" with Analytics but is a different feature. The key is named `analytics.ai_review` on purpose.

## Approach

### 1. Catalog (code) + overrides (DB)

The **catalog** is code: the list of things that _can_ be turned off, their parent, surface type, labels and the provider name used in copy. Admins can't invent keys, so a typo can't create a dead toggle, and every key in the DB maps to a surface that actually checks it.

The **override table** stores only what super admins changed. No row means available (fail-open). This matches how plan gates and kill switches behave today and makes "delete the row" a safe reset.

Catalog v1 (key → parent → surface type → what turns off):

| Key                               | Parent                   | Surface             | When off                                                                                                                                                    |
| --------------------------------- | ------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inbox.meta`                      | none                     | section             | Everything below. FB/IG threads stay readable.                                                                                                              |
| `inbox.meta.connect`              | `inbox.meta`             | button + modal      | Connect / Reconnect / Resubscribe / page picker / Disconnect in the Channels modal; `meta-inbox-oauth-*`, `meta-inbox-resubscribe`, `meta-inbox-disconnect` |
| `inbox.meta.reply`                | `inbox.meta`             | section (composer)  | Composer on FB/IG threads, edit/unsend, AI suggest on FB/IG threads, assistant `propose_send_inbox_reply` / `draft_inbox_reply` on FB/IG                    |
| `inbox.meta.auto_reply`           | `inbox.meta`             | background          | AI auto-reply to inbound FB/IG DMs; Automation tab Meta toggles show the notice                                                                             |
| `inbox.meta.sync`                 | `inbox.meta`             | background + button | `meta-inbox-backfill`, "Load older from Meta", initial sync after connect                                                                                   |
| `pricing.channel_sync`            | none                     | modal               | Everything below. Header button stays, dialog opens to the reason.                                                                                          |
| `pricing.channel_sync.import`     | `pricing.channel_sync`   | background + button | `calendar-sync-cron` global sweep, "Sync now", add/edit/remove feed, assistant `propose_run_channel_sync`                                                   |
| `marketing.ai_studio`             | none                     | section (tab)       | AI studio tab content, all AI studio generation and session writes                                                                                          |
| `marketing.ai_studio.generate`    | `marketing.ai_studio`    | button              | New creation, refine, references upload. Past sessions and outputs stay viewable.                                                                           |
| `analytics.ai_review`             | none                     | section (tab)       | "AI review" section content and the weekly cron                                                                                                             |
| `analytics.ai_review.regenerate`  | `analytics.ai_review`    | button + background | Regenerate button + `analytics-ai-review-cron`. Last review stays visible.                                                                                  |
| `notifications.telegram`          | none                     | section (tab)       | Everything below, property and parking                                                                                                                      |
| `notifications.telegram.settings` | `notifications.telegram` | section             | Telegram setting cards read-only (save, test, discover chats, bot token)                                                                                    |
| `notifications.telegram.delivery` | `notifications.telegram` | background          | Every Telegram `sendMessage` from the app, all channels and crons. Settings stay editable.                                                                  |

**Cascade rule:** a key is off when it or any ancestor is off. The resolved state reports `source: 'self' | 'parent'` and the reason of the nearest off ancestor. A child can't be turned on while its parent is off (UI disables the switch, API rejects with 409).

**Surface type** only drives the super-admin label chip and the default presentation. Each call site still picks the component that fits its UI.

### 2. Reasons and copy

Reason is a `TEXT + CHECK` enum (repo convention, like booking status):

| `reason`         | Host label          | Default message (human-copy pass required, no em dashes)                |
| ---------------- | ------------------- | ----------------------------------------------------------------------- |
| `maintenance`    | Under maintenance   | We're working on this right now. It'll be back soon.                    |
| `provider_issue` | Service issue       | {provider} is having problems. We'll turn this back on when it's fixed. |
| `coming_soon`    | Coming soon         | This isn't ready yet.                                                   |
| `under_review`   | Waiting on approval | We're waiting on approval from {provider}.                              |
| `paused`         | Paused              | We've paused this for now.                                              |
| `other`          | Unavailable         | (custom message required)                                               |

- `{provider}` comes from the catalog entry (`Meta`, `Airbnb`, `Google`, `Telegram`). Entries without a provider hide `provider_issue` and `under_review` in the picker.
- Optional `message` (max 280 chars, plain text, rendered as text, never HTML) replaces the default message. Required when `reason = 'other'`.
- Optional `expected_back_at` renders as "Back by 3:00 PM" (same day) or "Back by Oct 27, 3:00 PM" in **Asia/Manila**. If the time passes and auto restore is off, the line changes to "Taking longer than expected" instead of showing a past time.
- Each presentation shows: icon per reason (Wrench, CloudOff, Sparkles, Clock, Pause, Info), label, message, expected-back line. No upgrade CTA. Tone is amber for maintenance/provider_issue/paused, neutral for coming_soon/under_review/other, so it never looks like a plan paywall (plan gates use primary).

### 3. Precedence on a surface

1. **Permission** — if the user can't see the surface (RBAC), keep hiding it. Availability never reveals a hidden surface.
2. **Availability** — if off, show the reason. Do not show plan badges, upgrade modals or "upgrade" CTAs for that surface. A Free host must not be asked to pay for something that's down.
3. **Plan gate** — unchanged when available.
4. **AI platform kill switch / AI quota** — unchanged when available.

Server order in each handler: method → auth → **availability** → scope/RBAC → plan → quota. Availability runs before quota reservation so a blocked call never consumes AI credits.

### 4. Server enforcement

`supabase/functions/_shared/featureAvailability.ts`:

- `getFeatureAvailabilitySnapshot()` — reads all overrides with a 60s isolate cache (same pattern and TTL as `platformSettingsCache.ts`). On read error: fail-open (available) and log once. Uses `resolveFeatureAvailability(catalog, rows, now)` (pure, shared logic, Deno-tested).
- `isFeatureAvailable(key, { user? })` — boolean; super-admin bypass applies only when `user` is passed, the row has `super_admin_bypass = true` and the email is on `SUPER_ADMIN_EMAILS`. Background jobs never bypass.
- `featureUnavailableResponse(req, key, { user? })` — returns a ready `503` or `null`. Body: `{ success: false, error: <message>, code: 'FEATURE_UNAVAILABLE', feature, reason, expectedBackAt }`, header `Retry-After` (seconds) when `expected_back_at` is in the future. 503 is chosen on purpose: the PWA sync engine retries 5xx with backoff, then marks failed, which is right for "temporarily off" (`ui/src/lib/pwa/syncEngine.ts:122`).
- `resetFeatureAvailabilityCacheForTests()`.
- The super-admin write function clears the cache in its own isolate. Other isolates pick it up within 60s. Documented as "takes up to a minute to reach everyone".

### 5. Client

`ui/src/lib/featureAvailability/`:

- `featureAvailabilityCatalog.ts` — hand mirror of the server catalog (parity test).
- `resolveFeatureAvailability.ts` — pure resolver mirror (cascade, auto restore, overdue).
- `featureAvailabilityApi.ts` — `GET get-feature-availability` (authenticated). Returns resolved entries only for keys that are off or bypassed, plus `serverNow` to avoid client clock skew on expected-back copy.
- `useFeatureAvailability.ts` — one shared TanStack query (`staleTime 30s`, `refetchInterval 60s`, `refetchOnWindowFocus: true`). Errors keep the previous data; with no data at all, fail-open. `useFeatureAvailability(key)` → `{ available, bypassed, reason, label, message, expectedBackLabel, source, isLoading }`. While loading the first time, `available = true` so pages don't flash a block screen.
- `featureUnavailableError.ts` — `parseFeatureUnavailable(json)` + `toastFeatureUnavailable()` + `invalidateFeatureAvailability(queryClient)`. Every mutation in the 5 modules calls it in `onError`, so a stale tab shows the reason toast and re-renders blocked within one round trip.

Components in `ui/src/components/feature-availability/` (shared, used across features):

- `FeatureUnavailablePanel.tsx` — replaces a section's or modal's content. Centered icon, label, message, expected-back line. Fits inside cards, tabs and dialogs; on phones inside bottom sheets.
- `FeatureUnavailableNotice.tsx` — compact inline strip (amber/neutral) for background capabilities and composer replacement: "Telegram messages are paused. Under maintenance. Back by 3:00 PM."
- `FeatureAvailabilityButton.tsx` — wraps a button: renders disabled-looking but still focusable/tappable; tap opens a small popover (desktop) or bottom sheet (phone) with the reason. Never a hover-only tooltip (touch has no hover).
- `FeatureStatusDot.tsx` — small dot for tab triggers / nav items so hosts see something is off before they click.
- `FeatureAvailabilityBanner.tsx` — dashboard-wide banner in `AdminLayout` for entries with `show_banner = true`. Stacks into one line with "+N more" on phones. Dismiss per `featureKey + updatedAt` in `localStorage` (try/catch, per-viewer convenience only).
- `SuperAdminBypassPill.tsx` — "Off for hosts" pill shown on the surface when the viewer is bypassing, so a super admin testing a fix knows hosts still see it off.

### 6. Super-admin UI

`/admin/feature-availability`, nav item "Feature availability" in the **Platform** group of `SUPER_ADMIN_NAV_GROUPS`.

- List grouped by module (Inbox, Pricing, Marketing, Analytics, Notifications). Each row: label, surface chip, short description of what turns off, status switch, reason pill, expected-back, "Changed by X, 12 min ago". Children indented under parents; when the parent is off, children show "Off with parent" and a disabled switch.
- Top summary: "2 features off" chip and filter (All / Off only).
- Turning **off** opens `FeatureAvailabilityDialog` (bottom sheet on phones): reason (required), message (optional, required for `other`, counter to 280), expected back (date + time, Manila, must be in the future), "Turn back on automatically at that time" (enabled only with a time), "Show a banner across the dashboard", "Let super admins keep using it" (default on), and a **live preview** using the real `FeatureUnavailablePanel`. Guard with `useGuardedClose`.
- Turning **on** confirms in an `AlertDialog` ("Turn on Channel sync for all hosts?").
- Editing an off row (change reason / time / message) uses the same dialog.
- Step-up: add `feature_availability: 'turn platform features on or off'` to `GATED_SUPER_ADMIN_ACTIONS`; the write function calls `requireSuperAdminStepUp`. The existing sudo window keeps repeated toggles during an incident to one OTP.
- Overview: add an "Features off" tile/count on `SuperAdminOverviewPage` linking to the page, so nobody forgets a switch that's still off.

### 7. Module invariants (must hold)

**Inbox (FB & IG)**

- Inbound Meta webhook ingestion **never stops**. Guest messages are stored even when `inbox.meta` is off; hosts see them when it's back. Echo messages from Meta Business Suite also keep ingesting, so threads stay consistent if hosts reply natively.
- Read receipts and unread counts keep working.
- Auto-reply is skipped (not queued) when off. A skipped auto-reply is not retried later; stale AI replies hours later would be worse.
- Web chat (`platform = 'web'`) is never affected. Parking inbox is web-only and unaffected.
- Mock inbox mode (`VITE_INBOX_MOCK_DATA`) still applies the gate so it can be tested locally.

**Channel sync**

- `ical-export` keeps serving even when `pricing.channel_sync` is off. If the export disappeared, Airbnb could open dates that are booked here and cause double bookings. Documented in the super-admin row description.
- A paused import must not touch feed state: no claim, no `last_attempted_at`, no `consecutive_failures`, no `empty_pull_streak`, no error event. Skip before `loadDueCalendarFeeds` claims rows.
- On re-enable, all feeds are due at once. The existing batch (100) + 55s time budget + oldest-attempted-first ordering already handles it; verify no burst error.

**AI studio**

- In-flight video jobs keep finishing: `get-marketing-generation-job` polling and `marketing-generation-sweeper` are **not** gated, so credits settle and no job is stuck at `processing`.
- Saving rendered post versions (`marketing-ai-sessions` `action: 'post-versions'`) stays allowed so a host doesn't lose a result that finished right before the switch. Rename, delete, restore stay allowed. Only _starting_ generation and uploading references are blocked.
- `marketing-generations` gallery reads stay open (assets are used in the Design editor too).
- Default tab is `generate` (`normalizeMarketingStudioTab` fallback). When `marketing.ai_studio` is off, the tab stays visible with a dot and the panel. Do **not** silently change the default tab; a visible reason is clearer than a missing tab. Deep links `?tab=generate` land on the panel.

**AI review**

- `analytics.ai_review` off: section shows the panel, cron skips everything.
- `analytics.ai_review.regenerate` off: last review stays visible, Regenerate disabled with reason, cron skips. Score-change notifications stop because the cron doesn't run.
- Old notifications that deep link to `?section=ai-review` land on the panel, not a 404.

**Telegram**

- Delivery off means messages are **skipped, not queued**. On re-enable there's no backlog flood. Every Telegram cron must exit early before computing/claiming anything, and per-event sends (booking workflow, finance, maintenance, staff, marketing, admin, parking broadcast) return `{ ok: false, error: 'feature_unavailable' }` without writing "sent" dedupe rows.
- Each cron's dedupe must be checked so a reminder whose window passed during the pause doesn't fire on re-enable (task 5.6).
- Parking broadcast: the Telegram leg is skipped, other channels still send.
- Platform health probes (`systemHealth/probes.ts` `getMe`) and any future super-admin alert path are **not** host features and are never gated.

## Data model

New migration `supabase/migrations/20261316128800_feature_availability_overrides.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.feature_availability_overrides (
  feature_key TEXT PRIMARY KEY CHECK (feature_key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT CHECK (reason IN ('maintenance','provider_issue','coming_soon','under_review','paused','other')),
  message TEXT CHECK (message IS NULL OR char_length(message) <= 280),
  expected_back_at TIMESTAMPTZ,
  auto_restore BOOLEAN NOT NULL DEFAULT FALSE,
  show_banner BOOLEAN NOT NULL DEFAULT FALSE,
  super_admin_bypass BOOLEAN NOT NULL DEFAULT TRUE,
  disabled_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feature_availability_reason_when_off CHECK (is_enabled OR reason IS NOT NULL),
  CONSTRAINT feature_availability_other_needs_message CHECK (reason IS DISTINCT FROM 'other' OR message IS NOT NULL),
  CONSTRAINT feature_availability_auto_restore_needs_time CHECK (NOT auto_restore OR expected_back_at IS NOT NULL)
);
-- updated_at trigger (update_updated_at_column), GRANT ALL TO service_role,
-- ENABLE RLS with NO policies: access is edge-function only, like platform_settings.
```

- Keep the row on re-enable (`is_enabled = true`, reason etc. cleared) so the list can show "last changed". History lives in the super-admin audit log.
- **Effective off** = `is_enabled = false AND NOT (auto_restore AND expected_back_at <= now())`. Auto restore is evaluated at read time; no cron needed. The super-admin list shows "Turned back on automatically at 3:00 PM" for such rows, and the next manual edit normalizes the row.
- Unknown keys in the table (catalog entry removed) are ignored by the resolver and listed as "Unused" in super admin with a delete action.
- `select-star` check: list columns explicitly (`scripts/dev/check-select-star.sh`).

## Edge functions

| Function                   | Wrapper              | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feature-availability`     | `serveSuperAdmin`    | `GET` catalog + rows + resolved state. `PUT { featureKey, isEnabled, reason?, message?, expectedBackAt?, autoRestore?, showBanner?, superAdminBypass? }`. `DELETE { featureKey }` for unused keys. Step-up gated. Validates key against catalog, parent rule (409 when turning a child on under an off parent), future `expectedBackAt`, field rules mirroring the CHECKs. `logSuperAdminAction({ action: 'feature_availability.update', targetType: 'feature', targetId: key, summary, metadata: { before, after } })`. Busts local cache. |
| `get-feature-availability` | `serveAuthenticated` | `GET` → `{ serverNow, entries: [{ key, available, bypassed, reason, message, expectedBackAt, source, showBanner, updatedAt }] }` for off/bypassed keys only. `Cache-Control: private, no-store` (same reasoning as `get-public-platform-status`). Rate limited like other authenticated GETs.                                                                                                                                                                                                                                               |

`config.toml`: both `verify_jwt = false` with in-function auth (repo convention). No `static_files`.

## Implementation tasks

Ordered. Each phase leaves the app working; nothing is gated until a call site is wired.

### Phase 1 — Foundation (server)

- [x] 1.1 Migration `20261316128800_feature_availability_overrides.sql` (table, trigger, grant, RLS on, no policies). Apply locally with `bun run db:migrate`; run `mcp__supabase__get_advisors` on dev afterwards. _(Local apply verified; dev `get_advisors` pending deploy/unlock.)_
- [x] 1.2 `supabase/functions/_shared/featureAvailabilityCatalog.ts` — `FEATURE_AVAILABILITY_CATALOG` (key, parent, module, surface, label, description, provider?) + `FeatureAvailabilityKey` union + `FEATURE_AVAILABILITY_REASONS` + reason copy table.
- [x] 1.3 `supabase/functions/_shared/featureAvailabilityResolve.ts` — pure `resolveFeatureAvailability(catalog, rows, now)` (cascade, auto restore, overdue flag, ignore unknown keys).
- [x] 1.4 `supabase/functions/_shared/featureAvailability.ts` — cached snapshot, `isFeatureAvailable`, `featureUnavailableResponse`, `assertFeatureAvailable` (throws `FeatureUnavailableError` for helpers), `catchFeatureUnavailableError(req, err)`, test reset.
- [x] 1.5 `jsonFeatureUnavailable` in `_shared/httpResponse.ts` (503 + `Retry-After`).
- [x] 1.6 Deno tests `_shared/featureAvailabilityResolve_test.ts` + `_shared/featureAvailability_test.ts`: no row → on; self off; parent off cascades; child off with parent on; auto restore past/future; overdue without auto restore; unknown key ignored; super-admin bypass only with user + flag + allowlisted email; background never bypasses; read error fails open; cache TTL.
- [x] 1.7 `supabase/functions/feature-availability/index.ts` (super-admin GET/PUT/DELETE) + `GATED_SUPER_ADMIN_ACTIONS.feature_availability` + handler test in `functions/tests/`.
- [x] 1.8 `supabase/functions/get-feature-availability/index.ts` + handler test.
- [x] 1.9 `supabase/config.toml` entries for both functions.

### Phase 2 — Client foundation

- [x] 2.1 `ui/src/lib/featureAvailability/featureAvailabilityCatalog.ts` + `resolveFeatureAvailability.ts` (mirrors) + `featureAvailabilityParity.test.ts` (imports the server files by relative path, same as `planFeaturesParity.test.ts`).
- [x] 2.2 `featureAvailabilityApi.ts`, `useFeatureAvailability.ts` (shared query + per-key selector), `featureAvailabilityCopy.ts` (reason label/message/icon/tone, expected-back formatting in Asia/Manila via `ui/src/utils/dates.ts`, uses `serverNow` offset), `featureUnavailableError.ts`.
- [x] 2.3 Vitest: copy formatting (same day / other day / overdue / no time), error parsing, selector fail-open while loading and on error.
- [x] 2.4 Components in `ui/src/components/feature-availability/`: `FeatureUnavailablePanel`, `FeatureUnavailableNotice`, `FeatureAvailabilityButton`, `FeatureStatusDot`, `FeatureAvailabilityBanner`, `SuperAdminBypassPill`. Mobile pass (375/768/1024), a11y (`role="status"`, focusable disabled buttons with `aria-disabled` + `aria-describedby`).
- [x] 2.5 Mount `FeatureAvailabilityBanner` in `AdminLayout.tsx` (property + parking shells), below `PlatformMaintenanceBanner`, above page content; respects bottom tab bar offset on phones.
- [x] 2.6 Ensure the PWA service worker does not cache `get-feature-availability` (check `ui/vite.config.ts` runtime caching rules; NetworkOnly for `/functions/v1/get-feature-availability`). See `docs/architecture/pwa.md`.

### Phase 3 — Super-admin page

- [x] 3.1 `superAdminPaths.featureAvailability = '/admin/feature-availability'` + test update (`superAdminPaths.test.ts`).
- [x] 3.2 Nav item in Platform group (`superAdminPlatformNav.ts`, icon `ToggleRight`) + `superAdminPlatformNav.test.ts`.
- [x] 3.3 Route in `super-admin/routes/index.tsx`.
- [x] 3.4 Hooks `super-admin/hooks/useFeatureAvailabilityAdmin.ts` (list + update mutation with step-up handling like `usePlatformSettings`).
- [x] 3.5 `super-admin/pages/SuperAdminFeatureAvailabilityPage.tsx` (grouped tree list, summary chip, Off-only filter, unused-keys section).
- [x] 3.6 `super-admin/components/super-admin-feature-availability/FeatureAvailabilityDialog.tsx` (reason, message, expected back, auto restore, banner, bypass, live preview; `useGuardedClose`) + `FeatureAvailabilityRow.tsx` + turn-on confirm.
- [x] 3.7 Overview tile "Features off" on `SuperAdminOverviewPage` (count from the same list query).
- [x] 3.8 Command palette entry (`SuperAdminCommandPalette.tsx`) if destinations are listed there. _(N/A: palette is entity search only, not platform destinations.)_

### Phase 4 — Inbox: Facebook and Instagram

Server:

- [x] 4.1 `meta-inbox-oauth-start`, `meta-inbox-oauth-pages`, `meta-inbox-oauth-complete`, `meta-inbox-resubscribe`, `meta-inbox-disconnect` → `featureUnavailableResponse(req, 'inbox.meta.connect', { user })`. `meta-inbox-oauth-callback` (browser redirect) → redirect back with `meta_inbox_error=feature_unavailable` instead of JSON.
- [x] 4.2 `social-inbox-send`: for `conv.platform` facebook/instagram (after loading the conversation, before any Graph call), check `inbox.meta.reply`. Web unaffected. Same for edit/unsend paths if they live in other functions (`social-inbox-messages`).
- [x] 4.3 `_shared/inboxSendReplyAction.ts` (assistant send) → same check; tool returns a readable "not available: {reason}" result instead of throwing.
- [x] 4.4 `_shared/metaInboxGraph.ts#sendMetaMessage` → defense in depth: return a typed `feature_unavailable` failure when `inbox.meta.reply` is off (catches any caller missed above). Auto-reply uses its own key, so pass the key from the caller or check `inbox.meta.auto_reply` in `metaInboxAutoReply.ts` before calling.
- [x] 4.5 `_shared/metaInboxAutoReply.ts#maybeAutoReplyToInboundDm` → skip when `inbox.meta.auto_reply` off (log `skipped: feature_unavailable`). Webhook ingestion unchanged.
- [x] 4.6 `social-inbox-ai-suggest` → for FB/IG conversations check `inbox.meta.reply` (no AI quota spent).
- [x] 4.7 `meta-inbox-backfill` and the "load older from Meta" path in `social-inbox-threads` / `social-inbox-messages` → check `inbox.meta.sync`; return cached rows only with `metaSyncPaused: true`.
- [x] 4.8 `meta-inbox-status` / connections payload: add nothing; the client already has availability.

UI (`ui/src/features/dashboard/inbox/`):

- [x] 4.9 `InboxPlatformTabs.tsx`: `FeatureStatusDot` on Facebook and Instagram triggers when `inbox.meta` off.
- [x] 4.10 `InboxPage.tsx`: when `inbox.meta` off and the filter is FB/IG/all, show `FeatureUnavailableNotice` above the thread list; `threadEmptyVariant` gets a `feature-unavailable` variant (instead of "not connected" / "syncing" / "sync error") in `InboxThreadListEmpty.tsx`. Skip `useMetaInboxSync` polling while `inbox.meta.sync` is off.
- [x] 4.11 `handleConnectMeta`: check availability before the plan gate so a Free host sees the reason, not the upgrade modal.
- [x] 4.12 `InboxChannelsTab.tsx` (Channels modal): Connect / Reconnect / Resubscribe / Disconnect wrapped in `FeatureAvailabilityButton` (`inbox.meta.connect`); replace `TierBadgeAnchor` while unavailable. `MetaPagePickerDialog.tsx` opened from an OAuth return while off → shows the panel.
- [x] 4.13 `InboxConversationView.tsx`: for FB/IG threads with `inbox.meta.reply` off, replace composer with `FeatureUnavailableNotice` ("Replies to Facebook and Instagram are paused. You can still reply in Meta Business Suite."). Hide edit/unsend menu items and AI suggest for those threads. `InboxInsertMenu.tsx` templates/snippets disabled for those threads.
- [x] 4.14 `InboxAutomationTab.tsx`: Meta auto-reply toggles stay editable (settings), with a notice when `inbox.meta.auto_reply` is off ("Auto-replies on Facebook and Instagram are paused").
- [x] 4.15 `useInbox.ts` mutations (`connectMeta`, `disconnectMeta`, `resubscribeMeta`, `sendReply`, `editMessage`, `unsendMessage`, `aiSuggest`, load older): `onError` → `featureUnavailableError` handling. Offline outbox replay of a queued reply: 503 → retried then failed in Sync Center with the reason message (`syncEngine.ts` reads `error` from the body; verify).
- [x] 4.16 Dashboard assistant: `draft_inbox_reply`, `propose_send_inbox_reply` return the reason for FB/IG threads; `moduleSuggestions.ts` / context picker don't suggest "Reply on Instagram" while off (only if they hard-code it; otherwise the tool result is enough).

### Phase 5 — Pricing: Channel sync

Server:

- [x] 5.1 `calendar-sync-settings`: PATCH actions (`addFeed`, `updateFeed`, `removeFeed`, `syncNow`) → `pricing.channel_sync.import`; `setExportEnabled` → `pricing.channel_sync` (export toggle is part of the modal, the feed itself keeps serving). GET stays open (status is useful, and the dialog needs it to render the panel cleanly).
- [x] 5.2 `calendar-sync-cron`: global sweep exits early with `{ success: true, skipped: 'feature_unavailable' }` **before** `loadDueCalendarFeeds`; scoped "Sync now" returns 503.
- [x] 5.3 `_shared/dashboardAssistantOpsTools.ts`: `toolProposeRunChannelSync` and `executeRunChannelSync` check `pricing.channel_sync.import` (a proposal approved after the switch flips must still be blocked at execute). `toolGetChannelSyncStatus` adds `availability` to its result so the assistant can explain.
- [x] 5.4 `ical-export`: **no gate**. Add a code comment pointing to this plan's invariant.

UI (`ui/src/features/dashboard/pricing/`):

- [x] 5.5 `PropertyPricingPage.tsx`: header button (desktop + `MobileHeroActionButton`) gets `FeatureStatusDot`; hide `TierBadge` for `calendarSync` while unavailable. Button still opens the dialog.
- [x] 5.6 `ChannelSyncDialog.tsx`: `pricing.channel_sync` off → body is `FeatureUnavailablePanel` (export URL still shown read-only below it so hosts can confirm Airbnb keeps getting updates). `.import` off → feed list visible, Add/Sync now/Edit/Remove use `FeatureAvailabilityButton`, notice "Imports from Airbnb are paused".
- [x] 5.7 `ChannelSyncCard.tsx` — removed (dead; no imports).
- [x] 5.8 Mutation hooks for calendar sync → `featureUnavailableError` handling.

### Phase 6 — Marketing: AI studio

Server:

- [x] 6.1 `generate-marketing-media` (POST) → `marketing.ai_studio.generate` before quota reservation.
- [x] 6.2 `upload-marketing-generation-reference` POST → `marketing.ai_studio.generate`; GET/DELETE open.
- [x] 6.3 `marketing-ai-sessions`: no gate on GET/PATCH/DELETE/restore/post-versions (see invariant). If a "refine" action triggers generation server-side, gate that action only.
- [x] 6.4 `get-marketing-generation-job`, `marketing-generation-sweeper`, `marketing-generations`: **no gate** (comment the reason).

UI (`ui/src/features/dashboard/marketing/`):

- [x] 6.5 `MarketingStudioModeTabs.tsx`: `FeatureStatusDot` on the AI studio trigger when `marketing.ai_studio` off.
- [x] 6.6 `MarketingStudioPage.tsx` `tab === 'generate'`: `marketing.ai_studio` off → `FeatureUnavailablePanel` instead of `AiStudioHome` / `AiStudioConversation`. If a conversation is open when the switch flips (next refetch), keep it mounted read-only rather than unmounting mid-view: the composer handles it (6.7).
- [x] 6.7 `.generate` off (or parent off while a conversation is open): `AiStudioComposer.tsx`, `AiStudioRefineBox.tsx`, `AiStudioCreate.tsx`, photo/reference pickers → `FeatureUnavailableNotice` + disabled submit via `FeatureAvailabilityButton`. Sessions list, results grid, open-in-design, publish of already generated output stay enabled.
- [x] 6.8 `useMarketingGenerationApi.ts` (and generation hooks) → `featureUnavailableError` handling next to the existing `upgradeHook` handling.
- [x] 6.9 Assistant parity map already hands off `generate-marketing-media` to the canvas; no tool change. Verify `moduleSuggestions.ts` doesn't push "Create with AI" while off.

### Phase 7 — Analytics: AI review

Server:

- [x] 7.1 `analytics-ai-review` GET → `analytics.ai_review` (returns 503 so the client shows the panel; client already has availability, so this is defense in depth). POST → `analytics.ai_review.regenerate` before rate limit and quota.
- [x] 7.2 `analytics-ai-review-cron` → exit early when `analytics.ai_review.regenerate` (or parent) is off, before iterating properties. No notifications.

UI (`ui/src/features/dashboard/analytics/`):

- [x] 7.3 `AnalyticsSectionTabs.tsx`: `FeatureStatusDot` on "AI review" when `analytics.ai_review` off.
- [x] 7.4 `PropertyAnalyticsPage.tsx`: section `ai-review` with parent off → `FeatureUnavailablePanel`; don't run `useAnalyticsAiReview` query while off.
- [x] 7.5 `AiPerformanceReviewCard.tsx` / `AiPerformanceReviewGeneratingStage.tsx`: `.regenerate` off → Regenerate is `FeatureAvailabilityButton`, notice "Weekly reviews are paused" under the header; empty state (no review yet) shows the panel instead of "Generate your first review".
- [x] 7.6 `useAnalyticsAiReview.ts` mutation → `featureUnavailableError` handling.

### Phase 8 — Notifications: Telegram

Server (delivery):

- [x] 8.1 Add `telegramDeliveryUnavailable()` helper in `_shared/featureAvailability.ts` (checks `notifications.telegram.delivery`).
- [x] 8.2 Guard every `sendMessage` site, returning `{ ok: false, error: 'feature_unavailable' }` and not writing dedupe/sent rows: `_shared/propertyTelegramCredentials.ts#sendPropertyTelegramMessage`, `_shared/telegramAdmin.ts:514`, `_shared/telegramStaff.ts:484`, `_shared/telegramMarketing.ts:293`, `_shared/telegramParking.ts:108`, `_shared/parkingBroadcast.ts:440` (Telegram leg only). Add a Deno test that greps `_shared/` for `api.telegram.org/bot` + `/sendMessage` and fails if a new send site lacks the guard (keeps future senders honest).
- [x] 8.3 Crons exit early before work: `telegram-admin-cron`, `telegram-finance-cron`, `telegram-maintenance-cron`, `telegram-marketing-cron`, `telegram-staff-cron`.
- [x] 8.4 Callers that treat a failed send as an error (workflow orchestrator side effects, finance/maintenance flows) must treat `feature_unavailable` as a skip, not a failure: no error toast, no retry, no PostHog exception. Audit each caller of the 6 helpers.
- [x] 8.5 Re-enable safety: for each cron, confirm whether a reminder whose window passed during the pause would send on re-enable. Where it would, add a "too old, skip" bound (e.g. only send if the due time is within the cron's normal lookback). Record the per-cron result in this plan before shipping.

Server (settings):

- [x] 8.6 `telegram-*-settings` functions (admin, chat, finance, global, maintenance, marketing, parking, staff): writes, test-send, chat discovery and bot-token validation → `notifications.telegram.settings`. GET stays open.

UI:

- [x] 8.7 `NotificationsHubTabs.tsx`: `FeatureStatusDot` on Telegram when `notifications.telegram` off.
- [x] 8.8 `NotificationsPage.tsx` + `ParkingNotificationsPage.tsx` Telegram view: parent off → `FeatureUnavailablePanel` instead of the cards; hide `TierBadge` for `telegramNotifications` while unavailable. `.delivery` off → `FeatureUnavailableNotice` at the top ("Telegram messages are paused. Nothing is being sent right now."). `.settings` off → cards render read-only with Save/Test/Discover as `FeatureAvailabilityButton`. Unsaved-changes guard stays wired.
- [x] 8.9 `useTelegramHubStats.ts` and Telegram setting clients (`telegramSettingsClient.ts`) → `featureUnavailableError` handling.
- [x] 8.10 Assistant: `get_telegram_notification_settings` / `guide_telegram_settings` include availability so the assistant doesn't tell a host to "send a test message" while off.

#### 8.5 Re-enable safety (recorded)

| Surface                    | On re-enable                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `telegram-*-cron` (5 jobs) | Each run only evaluates its normal lookback window; no Telegram backlog is stored while delivery is off. Dedupe / sent markers prevent double-send for the same reminder. |
| `calendar-sync-cron`       | Resumes on the next due feed sweep only; feed rows and failure streaks are untouched during pause.                                                                        |
| `analytics-ai-review-cron` | Does not backfill missed weeks; hosts can still POST regenerate when the tab is available.                                                                                |

### Phase 9 — Docs, rules, QA

- [x] 9.1 New `docs/architecture/feature-availability.md`: model, catalog, cascade, precedence, 503 contract, invariants per module, how to add a key (checklist).
- [x] 9.2 `docs/architecture/overview.md`, `docs/PROJECT.md` (functions, table, route), `docs/architecture/data-model.md`, `docs/architecture/edge-functions.md`.
- [x] 9.3 Route guides (`route-guides` skill): new `docs/guides/routes/admin/feature-availability.md` + index row in `docs/guides/routes/README.md`; update `org/property/inbox.md`, `org/property/pricing.md`, `org/property/marketing.md`, `org/property/analytics.md`, `org/property/notifications.md`, `org/parking/notifications.md`, `admin/overview.md`.
- [x] 9.4 `docs/archive/operations/scheduled-jobs-and-testing.md`: crons that skip while a feature is off (calendar sync, AI review, Telegram x5) and that the marketing sweeper never skips.
- [x] 9.5 `.cursor/rules/plans-and-permissions.mdc` + `plans-and-permissions` skill: add one line "Feature availability: add a catalog key or mark N/A" to the checklist; run `bun run setup:ai-tooling` sync check.
- [x] 9.6 `module-status-management.md` superseded; live copy in [`../wont-do/module-status-management.md`](../wont-do/module-status-management.md).
- [x] 9.7 `human-copy` pass on every new string; `mobile-responsive` pass on every new component and touched surface.

## Edge cases and scenarios

| #   | Scenario                                                        | Expected                                                                                                                           |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No row for a key                                                | Available everywhere                                                                                                               |
| 2   | Override table read fails (server)                              | Fail-open, log once per isolate per minute                                                                                         |
| 3   | `get-feature-availability` fails (client)                       | Keep last data; with none, available. Server still enforces.                                                                       |
| 4   | Host has the page open when the switch flips                    | Next refetch (≤60s) or window focus re-renders with the panel; any mutation in between gets 503 → reason toast → immediate refetch |
| 5   | Parent off, child row says on                                   | Child resolved off, `source: parent`, parent's reason shown                                                                        |
| 6   | Super admin tries to turn a child on under an off parent        | UI switch disabled; API 409                                                                                                        |
| 7   | Expected-back time passes, auto restore on                      | Available at read time on every isolate without a cron; super-admin row shows "Turned back on automatically"                       |
| 8   | Expected-back time passes, auto restore off                     | Still off; copy "Taking longer than expected"; super-admin row flagged overdue                                                     |
| 9   | Expected-back time in the past on save                          | API 400                                                                                                                            |
| 10  | Host clock wrong                                                | Copy uses `serverNow` offset                                                                                                       |
| 11  | Super admin with bypass opens the surface                       | Works, shows "Off for hosts" pill; background jobs still off                                                                       |
| 12  | Super admin is also an org owner without bypass                 | Sees the host experience                                                                                                           |
| 13  | Free-plan host on an off feature                                | Sees the reason, no upgrade modal, no tier badge                                                                                   |
| 14  | Team member without permission                                  | Surface stays hidden; no dot, no banner leak beyond `show_banner` entries (banner is global by design and names only the feature)  |
| 15  | Offline reply queued, replayed while `inbox.meta.reply` off     | 503 retried with backoff, then failed in Sync Center with the reason; host can retry after it's back                               |
| 16  | AI assistant proposal approved after switch flips               | Execute step re-checks and returns the reason                                                                                      |
| 17  | Inbound FB/IG message while `inbox.meta` off                    | Stored, unread count updates, no auto-reply                                                                                        |
| 18  | OAuth redirect returns after `.connect` was turned off mid-flow | Callback redirects with `feature_unavailable`; inbox shows the reason toast; no connection row written                             |
| 19  | Calendar import paused for days                                 | Feed state untouched; on re-enable feeds sync in batches, no failure streaks or auto-disables                                      |
| 20  | Airbnb pulls our export while channel sync is off               | Feed keeps serving current data                                                                                                    |
| 21  | AI video job in progress when AI studio is turned off           | Job finishes via polling/sweeper; host can view and save it                                                                        |
| 22  | AI generation blocked                                           | No AI credits or quota consumed (gate before reservation)                                                                          |
| 23  | Deep link `?tab=generate` / `?section=ai-review` while off      | Lands on the panel                                                                                                                 |
| 24  | AI review notification clicked while off                        | Lands on the panel                                                                                                                 |
| 25  | Telegram delivery paused, booking moves status                  | Workflow transition succeeds; Telegram leg skipped silently; email still sends                                                     |
| 26  | Telegram re-enabled after a long pause                          | No backlog flood; stale reminders not sent (8.5)                                                                                   |
| 27  | Parking broadcast with Telegram paused                          | Other channels send; Telegram leg reported as skipped                                                                              |
| 28  | Platform health probe uses Telegram `getMe`                     | Not gated                                                                                                                          |
| 29  | Catalog key removed in code but row remains                     | Ignored; listed as Unused with delete                                                                                              |
| 30  | Two super admins edit the same row                              | Last write wins; both audit entries kept; list refetches after save (no optimistic merge)                                          |
| 31  | Step-up OTP expired during an incident                          | Normal step-up prompt; sudo window keeps follow-up toggles to one OTP                                                              |
| 32  | Banner dismissed, then reason or time edited                    | Banner shows again (dismiss key includes `updatedAt`)                                                                              |
| 33  | Storage blocked (private mode)                                  | Banner dismiss falls back to session-only; nothing breaks                                                                          |
| 34  | Service worker cached an old availability response              | Prevented by NetworkOnly rule (2.6)                                                                                                |
| 35  | Global `maintenance_mode` on at the same time                   | Both banners can show; per-feature panels still show their own reason                                                              |
| 36  | AI platform kill switch off and AI studio availability on       | Existing AI-off behavior, unchanged                                                                                                |
| 37  | Mock inbox mode                                                 | Gate still applies (testable locally)                                                                                              |
| 38  | Phone widths 375/768                                            | Panels fit sheets and tabs; reason opens in a bottom sheet, not a hover tooltip                                                    |

## Verification

1. [x] `bun run ci:quality` (lint, type-check, Vitest, Deno, smoke E2E, build) + `bun run check:filenames`. _(Green in repo.)_
2. [x] Deno: resolver + snapshot tests (1.6), handler tests for both new functions, Telegram send-site guard test (8.2).
3. [x] Vitest: parity test, copy formatting, error parsing, selector behavior, `superAdminPaths` / nav tests.
4. [x] Playwright mocked E2E (`ui/e2e/features/feature-availability/`): `moduleGates.spec.ts` (marketing, pricing channel sync dialog, analytics AI review tab, notifications Telegram, inbox Meta) + `superAdminToggle.spec.ts` (PUT mock through turn-off dialog). _(Shipped; run via `bun run test:e2e:ci -- ui/e2e/features/feature-availability/`.)_
5. **Manual** (handoff: [`../for-testing/feature-availability-controls.md`](../for-testing/feature-availability-controls.md)). Local full stack (`./dev.sh`), for each module: turn the parent off → check every surface in its Phase list and one server call via curl returns 503 with `FEATURE_UNAVAILABLE`; turn only each child off → check the narrower effect; turn back on → normal behavior within a minute. Run the related cron manually (`scheduled-jobs-and-testing.md`) while off and confirm the skip result and untouched rows (`execute_sql` on `calendar_feeds`, Telegram dedupe tables, `analytics` review rows).
6. Auto restore: set expected back 2 minutes out with auto restore, wait, confirm surfaces return without any write.
7. Super-admin bypass on/off as a super admin and as a normal owner.
8. Audit: `/admin/audit` shows each toggle with before/after.
9. Mobile pass at 375/768/1024 on every touched surface and the super-admin page.
10. `get_advisors` on dev after the migration.

## Docs to update

Listed in Phase 9. Plans and permissions: **N/A** for plan entitlements and team permissions (super-admin only control; hosts can't toggle it). Activity log: super-admin writes use `logSuperAdminAction`; `activity-log: N/A` for org `activity_log` because the change is platform-wide, not one org's state. Background skips are reported in cron responses and logs, not activity rows.

## Rollout

1. Ship Phases 1–3 together: table empty, page live, nothing gated yet. Zero behavior change.
2. Ship one module per PR (Phases 4–8), each with its docs. Order by risk: AI review → AI studio → Channel sync → Telegram → Inbox.
3. After each module ships, toggle it off/on once on dev with the checklist above.
4. Prod: deploy follows the normal unlock rule (`no-prod-deploy.mdc`). No data seeding needed: everything starts available.

## Follow-ups (not v1)

- Per-org / per-property targeting (`scope` column + allowlist), for staged rollouts and "beta orgs".
- Scheduled start (`starts_at`) with an advance banner ("Maintenance tonight 10 PM").
- "Notice only" mode: feature on, banner warns of slowness.
- Port `module-status-management.md` modules as keys: `inbox.meta.connect` with `under_review` already covers Meta App Review; add `marketing.studio`, `public_pages.editor`.
- More keys: marketing captions/templates AI, Meta publishing, booking AI review, voice receptionist, smart pricing.
- `serviceGuard` hard action writing an availability override with `reason = 'provider_issue'`.
- Email or in-app notification to affected org owners when a feature with `show_banner` goes off for more than N hours.

## Open questions

None blocking. Defaults chosen above (global only, threads stay readable, export never gated, Telegram skips instead of queueing, super-admin bypass on by default). Change any of them before Phase 4 if the product call differs.
