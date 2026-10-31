---
stage: done
title: 'In-App Notification Center — Implementation Plan'
status: done
tags: [planning, planned-modules, notifications, realtime, inbox, booking-workflow]
updated: 2026-08-14
---

# In-App Notification Center — Implementation Plan

## Context

Right now the only "live" signal in the admin dashboard is Supabase Realtime for guest chat — and it only works while an admin is physically on the Inbox page (`useInboxRealtime` is invoked exclusively from `InboxPage.tsx`). Everything else (new bookings, ready-for-check-in/out, SD refund due, Gmail auto-approvals of GAF/pet docs) is either invisible until an admin manually refreshes, or surfaces only as a 60s-polled aggregate count on the dashboard "attention" strip — never as a real-time, actionable alert.

There is **no existing "Notifications" feature to extend** — the only pages named "Notifications" in the app are Telegram outbound-bot-alert _settings_ pages (`.../notifications` route), unrelated to an in-app activity feed. This is confirmed net-new: no `notifications` table, no notification type enum, no bell/badge UI, no service worker/push infra anywhere in the repo.

Reusable primitives already exist and should be leveraged, not reinvented:

- **Sonner** toasts, globally mounted (`ThemedToaster` in `ui/src/main.tsx`) — a toast fired from anywhere already renders regardless of route.
- The `postgres_changes` realtime pattern proven in `useInboxRealtime` (`ui/src/features/dashboard/inbox/hooks/useInbox.ts`).
- Mount a single always-on provider once in `AdminLayout.tsx`, running across every admin page for a tenant.
- Org/property/parking scoping via `useOptionalOrgContext()` / `useOptionalParkingContext()`.

**Decisions confirmed with the user during brainstorming:**

1. **v1 event catalog**: new booking submitted (`PENDING_REVIEW`), ready for check-in, ready for check-out, SD refund due, inbound auto-approval of GAF doc, inbound auto-approval of pet doc, and new inbound guest chat/inbox message. Modeled as an extensible `TEXT + CHECK` type union (matching this repo's booking-status convention) so more event types (guest portal submissions, team/org membership changes, maintenance/finance reminders) can be added later without a redesign — explicitly **not built in v1**.
2. **Full persisted Notification Center** (not ephemeral-only toasts): a `notifications` table + bell icon + dropdown panel with read/unread history, so admins can catch up on what they missed.
3. **Delivery scope**: broadcast to everyone scoped to the relevant org/property/parking (matches how inbox realtime already filters by `organization_id` today) — no per-role/per-permission targeting in v1.
4. **OS-level push**: keep the existing browser `Notification` popup behavior inbox-chat-only, unchanged. New event types get in-app toast + bell entry only, not OS popups.

Because delivery is broadcast (org/property/parking-wide) but _read state_ is inherently per-admin-user, the design uses two tables: `notifications` (the event content) + `notification_reads` (per-user read tracking, lazily inserted on read/dismiss — absence of a row = unread). A shared `read_at` column directly on `notifications` was rejected because it would mark an item read for every admin the moment one admin dismissed it.

**Naming collision to avoid throughout implementation**: `propertyTeamPermissions.ts` already defines `notifications:view` / `notifications:edit` permission ids (confirmed at lines 27-28, 62, 71) gating the _existing Telegram settings pages_. Do not reuse, rename, or repurpose these for the new bell/panel feature — gate the new edge functions on `org:dashboard:view` (org scope) / `bookings:view` (property/parking scope) instead.

---

## Phase 1 — Data model + shared backend service

### 1a. New migration: `supabase/migrations/20261005140000_notifications.sql`

(Latest existing migration is `20261005130000_search_indexes.sql` — use a timestamp after that.)

- `notifications` table: `id`, `organization_id` (FK, required), `property_id` (FK, nullable), `parking_id` (FK, nullable), `type TEXT NOT NULL CHECK (type IN (...7 values...))`, `title`, `body`, `booking_id` (FK to `guest_submissions`, nullable), `conversation_id` (FK to `social_conversations`, nullable), `metadata JSONB DEFAULT '{}'`, `dedupe_key TEXT`, `created_at`.
- Partial unique index on `(type, dedupe_key) WHERE dedupe_key IS NOT NULL` — dedupe safeguard so a retried transition/webhook redelivery can't spam duplicate rows (`ON CONFLICT DO NOTHING` on insert).
- Indexes: `(organization_id, created_at DESC)`, partial `(property_id, created_at DESC) WHERE property_id IS NOT NULL`, partial `(parking_id, created_at DESC) WHERE parking_id IS NOT NULL`.
- `notification_reads` table: `id`, `notification_id` (FK, cascade), `user_id` (FK to `auth.users`, cascade), `read_at`, unique `(notification_id, user_id)`. Index on `(user_id, notification_id)`.
- RLS: copy the existing `user_can_access_org_inbox()`-style function from `20260910120000_social_inbox.sql` (same org-owner-or-active-member check) rather than refactoring it — call it `user_can_access_org_notifications`. SELECT policy on `notifications` using that function; `notification_reads` policies scoped to `user_id = auth.uid()` for both SELECT and INSERT.
- `REPLICA IDENTITY FULL` + `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications` — required for filtered realtime (matches `20260914120000_inbox_realtime.sql` precedent).
- Explicit grants in the **same migration** (`GRANT ALL ... TO service_role`, `GRANT SELECT ... TO authenticated`, `GRANT SELECT, INSERT ON notification_reads TO authenticated`) — this repo already hit "permission denied" once on RLS-enabled tables without explicit grants (see `20260913120000_social_inbox_service_role_grants.sql`); don't repeat that as a follow-up fix.
- **Known, accepted limitation**: `user_can_access_org_notifications` checks `organization_members` only, same as its inbox twin — a property/parking-only team member (no `organization_members` row) won't receive realtime rows on this channel. Pre-existing gap in the inbox precedent too; note as fast-follow in `docs/architecture/roadmap.md`, don't fix here.
- Do **not** add a `read_at` column on `notifications` itself (see Context above).

### 1b. `supabase/functions/_shared/notificationService.ts` (new)

- Exports `NotificationType` union (7 values) and `createNotification(input)`.
- Inserts via the service-role client, `ON CONFLICT (type, dedupe_key) DO NOTHING` when `dedupeKey` is set.
- **Non-fatal by design**: wrapped in try/catch, `console.error` + swallow — mirrors the `calendarOk`/`sheetOk` pattern already in `workflowOrchestrator.ts`. A notification failure must never fail a booking transition, email send, or webhook ack.
- Dedupe key convention: `${bookingId}:${type}` for booking events, `${messageId}:inbox_new_message` for chat (mirrors the `external_message_id` dedupe already used in `insertMessageIfNew`).

---

## Phase 2 — Emission points

All emission points call `createNotification(...)` — never an inline raw insert at the callsite.

- **`_shared/workflowOrchestrator.ts#transition()`**: add one new side-effect block near the end (after `calendarOk`/`sheetOk`/`emailsSent` resolve, reusing already-computed booking data), covering exactly the 3 confirmed transitions — `READY_FOR_CHECKIN`, `READY_FOR_CHECKOUT`, `PENDING_SD_REFUND` — gated on the _same conditions_ that already guard the corresponding transactional emails, so notification and email fire together. Resolve `organization_id` via the same property/parking lookup already used elsewhere in the orchestrator (don't add a new query). `dedupeKey`: `${bookingId}:${toStatus}`.
- **`approval-email-webhook/index.ts`**: right after the live-approval `WorkflowOrchestrator.transition(...)` call, add `createNotification` for `booking_gaf_auto_approved` / `booking_pet_auto_approved`. Only from the **live inbound path** — do not notify when an admin marks the same step complete from the rail.
- **New booking submitted**: `submit-form/index.ts`, inside the existing `isNewGuestSubmission` block, alongside the existing Telegram new-booking notify — `type: 'booking_pending_review'`. Also cover the parking-only insert path in `_shared/databaseService.ts#createParkingBooking` (never goes through `submit-form`), resolving org via `parkingId`.
- **New inbound guest message**: `_shared/metaInboxWebhookHandler.ts`, inside the existing `if (!isFromPage)` block (alongside `notifyTelegramChatInbound`) — `type: 'inbox_new_message'`. Also cover the separate web-widget insert path (`guest-web-chat-messages/index.ts` → `webGuestChatService.ts`) for `direction === 'inbound'`. Do **not** notify on outbound/echo/read-receipt events. Verify at implementation time whether Meta comment/IG-comment events (separate handler branches) should also count, or are out of scope (the confirmed catalog says "chat/inbox message," which reads as DMs).

---

## Phase 3 — Read/list/mark-read edge functions

- New `_shared/notificationsAccess.ts` mirroring `_shared/inboxAccess.ts` — resolves org/property/parking access using `org:dashboard:view` / `bookings:view` (per the Phase 0 naming-collision note, not `notifications:*`).
- **`notifications-list/index.ts`** (`serveAuthenticated`, GET): keyset pagination on `created_at` (never `OFFSET`), `limit` default 20/max 50, returns `{ notifications, nextCursor, unreadCount }`. `unreadCount` computed via `LEFT JOIN notification_reads ... WHERE read.id IS NULL`, capped (e.g. count up to 100, display "99+") so it stays cheap on a growing table.
- **`notifications-mark-read/index.ts`** (`serveAuthenticated`, POST): single (`{ notificationId }`) or mark-all (`{ markAll: true, property_id?, parking_id? }`), both `INSERT ... ON CONFLICT (notification_id, user_id) DO NOTHING`, scoped by the same org/property/parking resolution.
- Add both to the edge-function inventory doc (see Phase 6).

---

## Phase 4 — Frontend: provider + bell UI

New feature folder `ui/src/features/dashboard/notifications/` (sibling to `.../inbox/`):

- `hooks/useNotifications.ts` — `useNotificationsList(...)` (TanStack `useInfiniteQuery`, mirrors `useInboxThreads` pagination), `useMarkNotificationRead()`, `useMarkAllNotificationsRead()` with optimistic cache updates.
- `hooks/useNotificationsRealtime.ts` — near-copy of `useInboxRealtime`: one channel `notifications-${orgId}`, `postgres_changes` INSERT on `public.notifications` filtered by `organization_id`. On insert: invalidate the list/unread-count query keys (reuse the existing debounced-invalidate helper from inbox rather than writing a new one), and fire a Sonner toast with a click-to-navigate action resolving `bookingDetailPath`/`orgInboxPath` from cached org/property/parking slugs (no extra network round-trip per toast). **No OS `Notification` call here** — `inboxNotifications.ts` stays untouched and inbox-chat-only.
- `components/NotificationsProvider.tsx` — thin wrapper (no UI) calling `useNotificationsRealtime(orgId)`, `orgId` resolved via `useOptionalOrgContext()` / `useOptionalParkingContext()`. Skipped entirely on `/admin/*` (super-admin out of scope for v1).
- `components/NotificationBell.tsx` — badge = unread count, opens a scrollable dropdown/panel (shadcn `Popover`/`DropdownMenu`) with notification rows, "mark all as read," and "load more" — **not a new page/route**, to avoid any confusion with the existing `.../notifications` Telegram settings route.

Mount in `ui/src/features/dashboard/bookings/components/AdminLayout.tsx`:

- Wrap `<NotificationsProvider>` in `AdminLayout.tsx` — one instance for the whole admin tree.
- Bell in **two places**: the sidebar's tenant-scope header block (next to `SidebarTenantScope`, icon-only when collapsed, consistent with nav item collapse behavior) and `AdminMobileTopBar`'s header row (next to `SidebarTenantScope`, `flex items-center gap-2`) so it's reachable from every admin page on both desktop and mobile — not buried in `AdminMoreSheet`.

---

## Phase 5 — Performance/scale guardrails

- One realtime channel per org, mounted once — never per-page, never per-event-type.
- All list/count queries bounded and keyset-paginated — no unbounded scans.
- Sonner's existing `visibleToasts: 5` cap (already configured) absorbs any burst without further code.
- `(type, dedupe_key)` unique index + `ON CONFLICT DO NOTHING` prevents duplicate-row spam from retries/redeliveries.
- Unread-count capped at ~100 ("99+") to keep the aggregate cheap.
- **Fast-follow, not v1**: a retention/cleanup cron for old notification rows — note in `docs/architecture/roadmap.md`, don't build now.

---

## Phase 6 — Docs to update (per CLAUDE.md "docs are the source of truth")

- `docs/architecture/data-model.md` — new section for `notifications`/`notification_reads` (shape, RLS approach, dedupe constraint), same detail level as existing table sections.
- `docs/architecture/edge-functions.md` — add `notifications-list` / `notifications-mark-read` rows.
- `.cursor/rules/booking-workflow.mdc` — note under the side-effect matrix which `From → To` transitions now also emit a notification, plus a line in the "where do I edit this" map pointing to `notificationService.ts`.
- `docs/architecture/roadmap.md` — fast-follow notes: retention cron, and the deferred event types (guest portal submissions, team/org membership changes, maintenance/finance reminders).
- `docs/PROJECT.md` — bump `updated:` frontmatter date (content lives in the linked architecture docs above).
- Propose (don't build speculatively) a new `.claude/skills/notifications/SKILL.md` + `.cursor/rules/notifications.mdc` once shipped, covering the event catalog, the "always go through `createNotification`" rule, the dedupe-key convention, and the RLS-for-realtime grants gotcha.

---

## Verification

1. `cd ui && bun run lint && bun run type-check && bun run build`.
2. Apply the migration locally (`bun run db:migrate`), confirm tables/RLS/grants exist.
3. Trigger a real booking transition (e.g. via the admin workflow panel) and confirm: a `notifications` row is inserted; a Sonner toast appears **while on a non-inbox admin page**; the bell badge increments without manual refresh (realtime, not polling).
4. Click the toast/bell entry → lands on the correct booking detail page.
5. Mark as read (single, then "mark all") → badge clears; refresh the page → read state persists (proves server-persisted, not local-only).
6. **Cross-tenant isolation**: second browser session as an admin of a _different_ org; trigger a transition in org A; confirm org B receives no toast/badge change (validates RLS, not just client-side filtering).
7. Run the Gmail listener locally against a test approval email; confirm a GAF/pet auto-approved notification appears with **no** accompanying OS-level popup.
8. Send a test guest chat message (Meta DM or web widget); confirm `inbox_new_message` fires, and separately confirm the existing OS-level popup behavior for backgrounded tabs still works unchanged (regression check).
9. Use Playwright MCP for the browser-driven steps where feasible.

### Critical files

- `supabase/functions/_shared/workflowOrchestrator.ts`
- `supabase/functions/_shared/notificationService.ts` (new)
- `supabase/migrations/20261005140000_notifications.sql` (new)
- `ui/src/features/dashboard/inbox/hooks/useInbox.ts` (pattern source)
- `ui/src/features/dashboard/bookings/components/AdminLayout.tsx`
