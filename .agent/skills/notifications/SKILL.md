---
name: notifications
description: In-app Notification Center — bell + realtime toasts for booking status changes, GAF/pet auto-approvals, new bookings, and inbox messages. Use when adding a new notification event type, touching notificationService.ts, or extending ui/src/features/dashboard/notifications.
---

# In-App Notification Center skill

## Architecture map

| Layer                     | Path                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| Migration                 | `supabase/migrations/20261015120000_notifications.sql`                                                 |
| Event insert              | `supabase/functions/_shared/notificationService.ts`                                                    |
| Access resolve            | `supabase/functions/_shared/notificationsAccess.ts`                                                    |
| List / mark-read          | `supabase/functions/notifications-list`, `supabase/functions/notifications-mark-read`                  |
| UI hooks                  | `ui/src/features/dashboard/notifications/hooks/useNotifications.ts`, `useNotificationsRealtime.ts`     |
| UI provider + bell        | `ui/src/features/dashboard/notifications/components/NotificationsProvider.tsx`, `NotificationBell.tsx` |
| In-app list (bell + feed) | `InAppNotificationsPanel.tsx` (`variant="sheet"` bell, `variant="feed"` page)                          |
| Hub page frame            | `NotificationsHubShell.tsx`, `NotificationsHubTabs.tsx`, `NotificationsActivityView.tsx`               |
| Hub `?view=` state        | `hooks/useNotificationsHubView.ts`, `lib/notificationsPaths.ts#resolveNotificationsHubView`            |
| Path resolution           | `ui/src/features/dashboard/notifications/lib/notificationsPaths.ts`, `notificationsScope.ts`           |
| Display / toast           | `ui/src/features/dashboard/notifications/lib/notificationsDisplay.ts`, `notificationToast.tsx`         |

## Event catalog (v1 — 7 types)

| Type                         | Emitted from                                                                                              | dedupeKey                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `booking_pending_review`     | `submit-form`, `databaseService.ts#createParkingBooking`                                                  | `${bookingId}:booking_pending_review`                                               |
| `booking_ready_for_checkin`  | `workflowOrchestrator.ts#transition()`                                                                    | `${bookingId}:READY_FOR_CHECKIN`                                                    |
| `booking_ready_for_checkout` | `workflowOrchestrator.ts#transition()`                                                                    | `${bookingId}:READY_FOR_CHECKOUT`                                                   |
| `booking_sd_refund_due`      | `workflowOrchestrator.ts#transition()` — guest `/sd-form` submit only, not admin skip                     | `${bookingId}:PENDING_SD_REFUND`                                                    |
| `booking_gaf_auto_approved`  | `approval-email-webhook` — live inbound path only, never the admin manual-complete rail                   | `${bookingId}:booking_gaf_auto_approved`                                            |
| `booking_pet_auto_approved`  | `approval-email-webhook` — live inbound path only                                                         | `${bookingId}:booking_pet_auto_approved`                                            |
| `inbox_new_message`          | `metaInboxWebhookHandler.ts` (Meta DM inbound), `webGuestChatService.ts#sendGuestWebMessage` (web widget) | `${conversationId}:inbox_new_message` (coalesced — one row per thread, latest body) |

Adding a new type: extend `notifications_type_check` in a **new** migration (never edit the shipped one) and the `NotificationType` union in both `_shared/notificationService.ts` and the UI's `notificationsApi.ts`. OS push needs no extra wiring — the `push-fanout` trigger fires for any new row.

## Rules

- **Inbox coalescing:** use `createOrCoalesceNotification` for `inbox_new_message` (`dedupeKey` = `${conversationId}:inbox_new_message`) — one row per thread, latest body, re-unread on new message. Booking types use plain `createNotification` (one row per transition).
- **Always go through `createNotification` / `createOrCoalesceNotification`** — never a raw insert into `notifications` at the call site.
- **Non-fatal by design.** `createNotification` try/catches internally and never throws. A notification failure must never fail a booking transition, email send, or webhook ack — same principle as the `emailsSent` try/catch blocks in `workflowOrchestrator.ts`.
- **The dedupe unique index is partial** (`(type, dedupe_key) WHERE dedupe_key IS NOT NULL`). `createNotification` does a **plain insert + swallows `23505`**, not `.upsert(..., { onConflict })` — PostgREST can't target a partial index's predicate, so `ON CONFLICT` fails with `"no unique or exclusion constraint matching"`. Verified against the local DB while building this; keep it a plain insert if you touch this function.
- **RLS-for-realtime gotcha:** `notifications` has RLS (`user_can_access_org_notifications` — org owner or active `organization_members` row) **and** needs explicit `GRANT`s for `service_role` / `authenticated` in the same migration, or edge functions hit `"permission denied"` (see `20260913120000_social_inbox_service_role_grants.sql` — don't repeat that as a follow-up fix). `REPLICA IDENTITY FULL` + `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications` are required for the filtered realtime channel.
- **RLS is stricter than the edge-function gate.** `user_can_access_org_notifications` only checks `organization_members`, so a property/parking-only team member (no org-level row) gets **no realtime push**, even though they can still list/mark-read via the edge function (service role behind `org:dashboard:view` / `bookings:view`, not RLS). Known v1 gap — `docs/architecture/roadmap.md`.
- **Read state is per-user, not a column on `notifications`.** Absence of a `notification_reads` row = unread. Never add a shared `read_at` on `notifications` — it would mark an item read for every admin the moment one admin dismisses it.
- **One realtime channel per org** (`notifications-${orgId}`), mounted once via `NotificationsProvider` in `AdminLayout.tsx` — never per-page, never per-event-type.
- **OS push is a channel for every event type** (PWA). An `AFTER INSERT` trigger on `notifications` → `pg_net` → `supabase/functions/push-fanout` → Web Push, gated on a per-device opt-in (`PushNotificationsCard`). A new `notifications` row fans out automatically — nothing to wire per type. Recipients = org owner + active `organization_members` (mirrors realtime). See `docs/architecture/pwa.md` §5 + `.cursor/rules/pwa.mdc`. The old "no OS `Notification` / inbox-chat-only" restriction is retired.
- **A new event type needs a row in `NOTIFICATION_ICONS`** (`notificationsDisplay.ts`) — the `Record<NotificationType, LucideIcon>` is exhaustive, so `type-check` fails until you add one. Both the bell/Activity rows and the realtime toast read from it, so they can't drift.
- **Toast chrome lives in CSS, not props.** Sonner's default action chip is a near-black inverted button; `[data-sonner-toast] [data-button]` in `index.css` overrides it to `--primary` for every toast in the app. The 32px category badge needs `[data-sonner-toast]:has([data-notification-toast-icon]) [data-icon]` to override Sonner's fixed 16×16 `[data-icon]` box — drop the `data-notification-toast-icon` attribute and the badge overflows.
- **Toasts are keyed by `row.id`.** Coalesced inbox rows fire an `UPDATE` per message, so a stable id replaces the visible toast instead of stacking one per message.
- **Bell placement:** do **not** put the bell in the hero or top bar. Desktop (`lg+`): floating bell above the AI assistant FAB, same slide-over panel. Mobile (`max-lg`): **Notifications** bottom tab opens the same sheet. The full Notifications page stays in **More**.

## Permissions

Gated on **`org:dashboard:view`** (org scope) / **`bookings:view`** (property/parking scope) via `notificationsAccess.ts` — **not** `notifications:view` / `notifications:edit`, which gate the unrelated Telegram outbound-alert settings pages (`propertyTeamPermissions.ts`).

## Related rules

- `.cursor/rules/notifications.mdc`
- `.cursor/rules/pwa.mdc` + `docs/architecture/pwa.md` §5 — OS push pipeline
- Plan: `docs/workflow/done/in-app-notifications.md`
- `docs/architecture/data-model.md` — `notifications` / `notification_reads` / `push_subscriptions` sections
- `.cursor/rules/booking-workflow.mdc` §3 — which booking transitions also emit a notification
