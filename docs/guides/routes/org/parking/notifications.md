---
title: 'Parking notifications — operator guide'
status: active
tags: [guides, routes, org, parking]
updated: 2026-09-02
---

# Parking notifications — operator guide

Route: `/org/:orgSlug/parking/:parkingSlug/notifications`

Deep links:

- `?section=activity` or `#section-activity` — in-app activity feed (bell **View all**)
- `?module=chat` — Chat Telegram section
- `?module=finance` — Finance Telegram section
- `?module=parking` (legacy `?module=marketing` maps to Parking)

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

Hub for **in-app activity** (same org-wide feed as the bell) and **Telegram** alerts for this parking slot.

**Plan gating:** **Telegram Chat enable** and the **AI dashboard assistant** gate on the org's own live subscription (or Free default) — `requireOrgFeature`/`resolveOrgEntitlements` server-side, `useFeatureGate`/`useOrgPlan` client-side — same as any org-only page, no property involved. Closed 2026-09-09; see [`parking-property-parity.md`](../../../workflow/in-progress/parking-property-parity.md).

### This device (PWA)

Above the Activity feed: **Notifications on this device** (OS push opt-in — per device; on iPhone/iPad needs **Add to Home Screen** first) and **Offline changes** (Sync Center — appears only when changes were made offline; lists waiting/failed items with Sync now / Retry / Discard). Same components and behaviour as the property Notifications page — see [`../property/notifications.md`](../property/notifications.md) → "This device (PWA)" and [`docs/architecture/pwa.md`](../../../architecture/pwa.md) §5–§6.

### In-app activity

- **Activity** section lists in-app notifications for the org (booking + inbox events).
- Desktop: the bell floats above the AI assistant button. Phone: tap **Notifications** in the bottom menu. Both open the same sheet; **View all** opens this page at **Activity** when more than five items exist.
- **Activity** card scrolls inside a max height; additional pages load as you scroll (20 per request).
- Rows show guest name with an inline inbox **channel pill** (**Chat** / **Facebook** / **Instagram**) when applicable, and stay dates (inquiry or booked) when available; realtime toasts match the same layout (channel logo + inline pill for inbox).

### Telegram sections

### Shared bot token (recommended default)

One BotFather token at the top pre-fills Chat, Parking, and Finance module fields. Override per module anytime. One bot handles typical volume; use **separate Chat IDs** for chat alerts vs parking ops vs finance reminders when you want different groups.

**Telegram notifications** group heading includes **Get Help**. **Shared bot token** card: **Save and test** validates via `getMe`, then saves; **Saved** replaces the button when complete.

1. **Chat** — inbound guest web chat alerts (`telegram_chat_settings` with `parking_id`)
2. **Parking** — reservation request, check-in reminder, payment received (`telegram_parking_settings`)
3. **Finance** — operating expense due-date reminders (`telegram_finance_settings`)

**Find chat ID** is inline on the Chat ID field — **Scan for chats**, then a group dropdown. Hidden after **Connected** (group name + **Reveal** instead). Bot token shows the raw value by default (**Hide** masks characters; the field stays editable); chat ID shows **group name** by default (**Reveal** for the raw id).

Deep links: `?module=finance` scrolls to the Finance section.

---

## Host-facing knowledge

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

| Concern       | Path                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| Page          | `ui/src/features/dashboard/parking/pages/ParkingNotificationsPage.tsx`                                            |
| In-app list   | `ui/src/features/dashboard/notifications/components/InAppNotificationsPanel.tsx`                                  |
| Bell          | `ui/src/features/dashboard/notifications/components/NotificationBell.tsx` (desktop FAB; mobile Notifications tab) |
| Chat card     | `ui/src/features/dashboard/bookings/components/TelegramChatSettingsCard.tsx`                                      |
| Chat hooks    | `ui/src/features/dashboard/bookings/hooks/useTelegramChatSettings.ts`                                             |
| Parking card  | `ui/src/features/dashboard/parking/components/TelegramParkingSettingsCard.tsx`                                    |
| Finance card  | `ui/src/features/dashboard/bookings/components/TelegramFinanceSettingsCard.tsx`                                   |
| Finance hooks | `ui/src/features/dashboard/bookings/hooks/useTelegramFinanceSettings.ts`                                          |
| Chat edge     | `supabase/functions/telegram-chat-settings/index.ts`                                                              |
| Parking edge  | `supabase/functions/telegram-parking-settings/index.ts`                                                           |
| Finance edge  | `supabase/functions/telegram-finance-settings/index.ts`                                                           |
| Chat notify   | `supabase/functions/_shared/telegramChat.ts` → `notifyTelegramChatInbound`                                        |
| Cron          | `supabase/functions/telegram-finance-cron/index.ts`                                                               |

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
