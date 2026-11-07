---
title: 'Parking notifications — operator guide'
status: active
tags: [guides, routes, org, parking]
updated: 2026-11-05
---

# Parking notifications — operator guide

Route: `/org/:orgSlug/parking/:parkingSlug/notifications`

Deep links:

- `?view=activity|telegram` — opens that hub tab (bell **View all** uses `?view=activity`)
- `?section=activity` or `#section-activity` — legacy aliases for the Activity tab, still accepted
- `?module=chat|parking|finance` — opens the header **Manage** sheet on its Telegram tab at that module
- `?module=marketing` still maps to Parking

> **Status:** Documented

## Progress overview

| Section     | E2E save | Docs       | Notes                                       |
| ----------- | -------- | ---------- | ------------------------------------------- |
| This device | ⏳       | Documented | PWA OS-push opt-in + offline-changes queue  |
| Activity    | ✓        | Documented | In-app bell feed (org-wide, paginated)      |
| Chat        | ✓        | Documented | Inbound guest web chat Telegram alerts      |
| Parking     | ✓        | Documented | Ops alerts (reservation, check-in, payment) |
| Finance     | ✓        | Documented | Due-date reminders for parking transactions |

---

## Overview

Hub for **in-app activity** (same org-wide feed as the bell) and **Telegram** alerts for this parking slot, split into two tabs.

Page subtitle: "Manage in-app notifications and Telegram alerts for this parking slot."

**Hub layout.** Four KPI cards above the tabs: **Unread**, **Messages**, **Telegram on** (modules enabled / total) and **Connected** (modules with a bot token and chat ID / total). Each card jumps to the tab it describes. **Activity** and **Telegram** follow, and the activity list is the first thing on the tab. The Activity feed is **org-wide**, not limited to this slot.

**Manage sheet.** Header **Manage** (gear icon in the phone hero) has two tabs. **Activity** holds **Push notifications**, **Push preferences** and **Quiet hours**. **Telegram** holds the **Telegram delivery** master switch, Setup Guide, the shared bot token card and the three module cards.

**Off states.** Each tab leads with a master switch. While it loads the row skeletons instead of claiming the channel is unavailable. With a channel off, its controls are hidden and replaced by a short panel describing what turning it back on restores.

**Telegram tab.** The page **Telegram** tab keeps the **Telegram delivery** master switch on a white card, followed by a read-only history of what each group received: module, time, text (expandable), **Failed** badge with the reason. 20 per page with Newer / Older, 15-day window, scoped to this parking slot, and no Telegram API calls.

**How it works** is the **?** beside the **Notifications** page title (phone hero and desktop header), with the same copy as the property page: in-app, phone push and Telegram, plus the per-channel mute rule and Manila quiet hours.

**Plan gating:** **Telegram Chat enable** and the **AI dashboard assistant** gate on the org's own live subscription (or Free default) — `requireOrgFeature`/`resolveOrgEntitlements` server-side, `useFeatureGate`/`useOrgPlan` client-side — same as any org-only page, no property involved. Closed 2026-09-09; see [`parking-property-parity.md`](../../../../workflow/for-testing/parking-property-parity.md).

**Feature availability (super-admin):** Same Telegram keys as property notifications (`notifications.telegram`, `.settings`, `.delivery`). Shared bot token and module cards use `TelegramNotificationsTelegramSection`; PATCH/POST on `telegram-*-settings` return 503 when settings are off.

### This device (PWA)

In the header **Manage** sheet: **Push notifications** (OS push opt-in — per device; on iPhone/iPad needs **Add to Home Screen** first). **Offline changes** (Sync Center) stays on the Activity tab above the feed and appears only when changes were made offline. Same components and behaviour as the property Notifications page — see [`../property/notifications.md`](../property/notifications.md) → "This device (PWA)" and [`docs/architecture/pwa.md`](../../../architecture/pwa.md) §5–§6.

### In-app activity

- **Activity** tab lists in-app notifications for the org (booking + inbox events). The **Activity** heading carries a hint saying so.
- Desktop: the bell floats above the AI assistant button. Phone: tap **Notifications** in the bottom menu. Both open the same sheet; **View all** opens this page at **Activity** when more than five items exist.
- **Activity** card scrolls inside a max height; additional pages load as you scroll (20 per request). Switching tabs with a dirty Telegram card prompts Save / Discard / Keep editing.
- Rows show guest name with an inline inbox **channel pill** (**Chat** / **Facebook** / **Instagram**) when applicable, and stay dates (inquiry or booked) when available; realtime toasts match the same layout (channel logo + inline pill for inbox).

### Telegram sections

### Shared bot token (recommended default)

One BotFather token at the top pre-fills Chat, Parking, and Finance module fields. Override per module anytime. One bot handles typical volume; use **separate Chat IDs** for chat alerts vs parking ops vs finance reminders when you want different groups.

**Telegram notifications** group heading includes **Setup Guide**. **Shared bot token** card: **Save and test** validates via `getMe`, then saves; **Saved** replaces the button when complete.

1. **Chat** — inbound guest web chat alerts (`telegram_chat_settings` with `parking_id`)
2. **Parking** — reservation request, check-in reminder, payment received (`telegram_parking_settings`)
3. **Finance** — operating expense due-date reminders (`telegram_finance_settings`)

**Find chat ID** is inline on the Chat ID field — **Scan for chats**, then a group dropdown. Hidden after **Connected** (group name + **Reveal** instead). Bot token shows the raw value by default (**Hide** masks characters; the field stays editable); chat ID shows **group name** by default (**Reveal** for the raw id).

Deep links: `?module=finance` scrolls to the Finance section.

---

## Host-facing knowledge

Parking **Notifications** has two tabs: **Activity** for what already happened, and **Telegram** for where alerts are delivered. Four cards at the top show unread counts and how many Telegram modules are on and connected; tapping one opens its tab. The **Activity** feed covers your whole organization, same as the bell.

Parking **Notifications** configures Telegram alerts for this slot. The **Chat** section sends a Telegram alert on every inbound guest web chat message. The **Parking** section covers reservation-style alerts (new request, check-in reminder, payment received) once those flows are fully live. The **Finance** section sends due-date reminders for expense lines you track on parking finance. Each section needs a Telegram bot token and chat ID, plus a test send to confirm delivery.

**Common host questions**

- Q: Where is the notification bell on my phone?
  A: Tap **Notifications** in the bottom menu. On a computer it floats above the AI assistant button.
- Q: Do I need a separate Telegram bot for chat, parking, and finance alerts?
  A: No, one shared token is enough for all three. Use separate **Chat IDs** if you want chat alerts, parking ops alerts, and finance reminders posted to different groups, or override the bot token per module if you ever need to split them further.
- Q: Why aren’t I getting parking reservation alerts yet?
  A: Reservation Telegram templates are wired for this slot, but some reservation events depend on the parking booking flow shipping. Finance due-date reminders work today when finance Telegram is enabled and transactions have due dates.
- Q: How do I jump straight to finance reminders?
  A: Open notifications with the finance module selected in the URL, or scroll to the **Finance** card on this page.
- Q: Can I test a notification section before turning it on?
  A: Yes. Each section has a **Save and test** action that confirms the bot token and chat ID before alerts start.
- Q: Where are the phone-push settings?
  A: Tap **Manage** in the Notifications header. The sheet holds **Push notifications**, **Push preferences**, **Quiet hours** and the way into Telegram settings.
- Q: What do the four cards at the top mean?
  A: **Unread** and **Messages** count what is waiting for you. **Telegram on** and **Connected** show how many Telegram modules are switched on and how many are fully connected.
- Q: Can I see what was sent to the parking Telegram group?
  A: Yes. Open **Telegram** on the Notifications page to see the last 15 days of sends, with the module, the message and the time.
- Q: How do I pause all parking Telegram alerts?
  A: **Manage**, **Telegram**, then turn off **Telegram delivery**. Module settings are kept for when you turn it back on.

---

## Chat section

Reuses property `TelegramChatSettingsCard` — scoped automatically to the parking slot via `useAdminAssetScope()`.

`GET/PATCH/POST telegram-chat-settings?parking_id=`

- Enable toggle, bot token, chat ID, new-message template
- POST: `verify_chat_telegram_env`, `send_draft_preview`, `render_draft_preview`

DB: `telegram_chat_settings.parking_id` (one row per parking slot). Seeded on first GET.

**Send path:** after each inbound parking web chat message (`webGuestChatService`), `notifyTelegramChatInbound` loads this parking's chat settings and sends when `enabled`. `{{property_name}}` resolves to the parking slot name; `{{conversation_link}}` opens this slot's inbox.

---

## Parking section

`TelegramParkingSettingsCard` → `GET/PATCH telegram-parking-settings?parking_id=`

POST actions: `verify_parking_telegram_env`, `send_draft_preview`, `render_draft_preview`

DB: `telegram_parking_settings` (one row per parking slot). Seeded on first GET.

---

## Finance section

Reuses property `TelegramFinanceSettingsCard` — scoped automatically to the parking slot via `useAdminAssetScope()`.

`GET/PATCH/POST telegram-finance-settings?parking_id=`

- Enable toggle, bot token, chat ID, default reminder template
- POST: `verify_finance_telegram_env`, `send_test_due_reminders`, `send_draft_preview`, `render_draft_preview`

DB: `telegram_finance_settings.parking_id` (one row per parking slot). Seeded on first finance GET.

Cron: global `telegram-finance-cron` (hourly) processes unpaid `finance_line_items` with `parking_id` when finance Telegram is enabled for that slot.

---

## Implementation map

| Concern       | Path                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Page          | `ui/src/features/dashboard/parking/pages/ParkingNotificationsPage.tsx`                                               |
| Hub shell     | Shared `NotificationsHubShell` + `NotificationsHubSummaryCards` (`…/notifications/components/`)                      |
| Manage sheet  | Shared `NotificationsManageDialog` (`…/notifications/components/NotificationsManage.tsx`) — Activity / Telegram tabs |
| History tab   | Shared `NotificationsTelegramHistory` + `telegram-message-log` edge function                                         |
| Loading       | `NotificationsPageBodySkeleton` (`NotificationsSkeleton.tsx`) — four KPI cards, tab bar, activity rows               |
| In-app list   | `ui/src/features/dashboard/notifications/components/InAppNotificationsPanel.tsx`                                     |
| Bell          | `ui/src/features/dashboard/notifications/components/NotificationBell.tsx` (desktop FAB; mobile Notifications tab)    |
| Chat card     | `ui/src/features/dashboard/bookings/components/TelegramChatSettingsCard.tsx`                                         |
| Chat hooks    | `ui/src/features/dashboard/bookings/hooks/useTelegramChatSettings.ts`                                                |
| Parking card  | `ui/src/features/dashboard/parking/components/TelegramParkingSettingsCard.tsx`                                       |
| Finance card  | `ui/src/features/dashboard/bookings/components/TelegramFinanceSettingsCard.tsx`                                      |
| Finance hooks | `ui/src/features/dashboard/bookings/hooks/useTelegramFinanceSettings.ts`                                             |
| Chat edge     | `supabase/functions/telegram-chat-settings/index.ts`                                                                 |
| Parking edge  | `supabase/functions/telegram-parking-settings/index.ts`                                                              |
| Finance edge  | `supabase/functions/telegram-finance-settings/index.ts`                                                              |
| Chat notify   | `supabase/functions/_shared/telegramChat.ts` → `notifyTelegramChatInbound`                                           |
| Cron          | `supabase/functions/telegram-finance-cron/index.ts`                                                                  |

---

## Testing

| Layer | Path / spec                                                                  | Manual        |
| ----- | ---------------------------------------------------------------------------- | ------------- |
| Unit  | `parkingStatusMachine_test.ts`                                               | —             |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs | PayMongo live |
| N/A   | Parking host dashboard shell load                                            | —             |

---

## Related

- Parking finance transactions: [finance.md](./finance.md)
- Property notifications: [../property/notifications.md](../property/notifications.md)
