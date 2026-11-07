---
title: 'Notifications — operator guide'
status: active
tags: [guides, routes, org, property]
updated: 2026-11-05
---

# Notifications — operator guide

Route: `/org/:orgSlug/property/:propertySlug/notifications`

Deep links:

- `?view=activity|telegram` — opens that hub tab (bell **View all** uses `?view=activity`)
- `?section=activity` or `#section-activity` — legacy aliases for the Activity tab, still accepted
- `?module=chat|marketing|staff|operations|finance|maintenance` — opens the header **Manage** sheet on its Telegram tab and scrolls to that module card

> **Status:** Documented

## Progress overview

| Section     | E2E save | Validation | Docs       | Notes                                                        |
| ----------- | -------- | ---------- | ---------- | ------------------------------------------------------------ |
| This device | ✅       | ✅         | Documented | PWA OS-push opt-in, push preferences + offline-changes queue |
| Activity    | ✅       | ✅         | Documented | In-app bell feed (org-wide, paginated)                       |
| Chat        | ✅       | ✅         | Documented | Inbound guest web chat → Telegram template                   |
| Marketing   | ✅       | ✅         | Documented | Gated setup + manage cards                                   |
| Staff       | ✅       | ✅         | Documented | Gated setup + manage cards                                   |
| Operations  | ✅       | ✅         | Documented | Gated setup + manage cards                                   |
| Finance     | ✅       | ✅         | Documented | Gated setup + template modal                                 |
| Maintenance | ✅       | ✅         | Documented | Gated setup + template modal                                 |

---

## Overview

Single hub for **in-app activity** (booking workflow + inbox events in the bell) and **Telegram notification bots** on a property, split into two tabs.

Page subtitle: "Manage in-app notifications and Telegram alerts for this property."

**Hub layout.** Four KPI cards sit above the tabs: **Unread**, **Messages** (unread inbox threads), **Telegram on** (modules enabled / total) and **Connected** (modules with a bot token and chat ID / total). Each card jumps to the tab it describes. Below them, the **Activity** and **Telegram** tabs, and the activity list is the first thing on the tab.

**Manage sheet.** Header **Manage** (gear icon in the phone hero) opens one sheet with two tabs:

- **Activity** — **Push notifications**, **Push preferences** (one switch per group), and **Quiet hours** (its own section with a From/To window).
- **Telegram** — the **Telegram delivery** master switch, **Setup Guide**, the shared bot token card and the six module cards (enable, credentials, schedules, templates).

Saving is instant, no Save button. Closing the sheet or leaving the Telegram tab with unsaved card edits prompts Save / Discard / Keep editing. Keeping all of this behind Manage is what lets the page tabs stay read-only.

**Off states.** Both tabs lead with a master switch. While its state is being read the row shows a skeleton instead of "not available"; a browser that cannot receive push says so in red with the switch disabled. When a channel is off, its controls are hidden and replaced with a short panel explaining what turning it back on gives you; both master switches are independent.

**How it works** lives beside the page title (the `?` next to "Notifications"), not inside the sheet. The Telegram bot walkthrough is the **Setup Guide** action in the Telegram group heading.

**Scope.** The Activity feed is **org-wide** for the property and every other property in the organization, exactly like the bell. The page is property-scoped, but the feed is not filtered to it.

**How it works** is the **?** beside the **Notifications** page title, in the same spot in the phone hero and the desktop header. It opens the explainer that names the three channels — in-app, phone push and Telegram — and the rule that ties them together: muting a group for phone push still keeps every event in Activity. Quiet hours use Philippine time; calendar sync failures still come through.

Telegram module settings (and optional credentials) are bulk-copyable via org **Properties → Copy settings**.

### Sent messages (Telegram tab)

The page **Telegram** tab is a read-only copy of what each Telegram group received: one row per send with the module, relative time, the message text (clamped, **Show more** expands), and a **Failed** badge with Telegram's reason when a send was rejected.

- **15-day window.** Reads only cover the last 15 days; a daily job prunes older rows, so storage stays bounded.
- **Paginated.** 20 per page with **Newer** / **Older**; only the page on screen is loaded.
- **Scoped to this asset.** Unlike the org-wide Activity feed, history shows the sends for this property.
- **No Telegram calls.** The list reads our own table, so browsing history costs no bot API quota.
- **Delivery off.** When the master switch is off, a notice explains that messages are not being sent.
- **Same width as Activity.** The history uses the page's content width, like the feed, so the tabs and the panel below them start on the same edge.

### This device (PWA)

In the header **Manage** sheet, **Activity** tab:

- **Push notifications** — a single toggle to receive OS push notifications (booking, message, and workflow alerts) on this device even when the app is closed. Per **device**, not per account. Turning it on asks the browser for permission; turning it off unsubscribes. A toast confirms the switch is on or off (or says permission was not granted, so it stayed off). Delivered for **every** Notification Center event to the org owner + active org team members who opted in.
  - **Desktop Chrome/Edge/Firefox and Android**: works in a normal browser tab too.
  - **iPhone/iPad**: only after you **Add to Home Screen** — the toggle shows "Add this app to your Home Screen, then turn on notifications from the installed app" until then.
  - If notifications were blocked in browser settings, the card says so and the toggle is disabled until you re-allow them.
- **Push preferences** — below the device toggle in the same sheet. One switch per group (**Bookings**, **Messages**, **Reviews**, **Pricing**, **Finance**, **Maintenance**, **Analytics**, **System**). Changes save instantly; there is no Save button. Each switch shows a short toast once the save lands. Preferences are **per account, on every device** (the device toggle above is the per-device switch). Muting a group only stops the phone buzz — the row still appears in **Activity**.
- **Quiet hours** — a separate section below Push preferences. It is a schedule, not another notification group, so it does not sit inside that switch list. One switch turns it on, then **From** / **To** time fields set the window; the helper line states the active window and the stored timezone (**Asia/Manila**). Changes save instantly. If From and To match, an inline error says so and the window is treated as off. Calendar-sync failures still come through during quiet hours.
- **Offline changes** (Sync Center) — on the Activity tab above the feed, and appears only when you made changes while offline (currently: inbox text replies). Lists what is **waiting to sync** and anything that **failed**, with **Sync now**, **Retry**, and **Discard**. Queued changes replay automatically when you reconnect; a failed item shows the server's reason and the affected view refreshes to the real state. A bottom strip shows the same queue, or that you are offline. It stays hidden when nothing is waiting, including after you clear offline data. Tapping it opens this list.

### In-app activity

- **Activity** section lists org-wide in-app notifications (same data as the bell).
- Desktop: the bell floats above the AI assistant button and opens a **slide-over panel**. Phone: tap **Notifications** in the bottom menu for the same sheet. **View all** opens this page at **Activity** when more than five items exist.
- Rows open the related booking or inbox thread; **Mark all as read** on the full list.
- With unread items, the desktop bell uses a soft periodic ring nudge and the count badge a gentle pulse (paused while the panel is open; respects `prefers-reduced-motion`). The mobile **Notifications** tab badge uses the same pulse.
- Inbox rows show the guest **participant name** as the title with an inline **channel pill** (**Chat**, **Facebook**, or **Instagram**), matching the Inbox thread list — **one row per conversation**, not per message.
- The bell **unread badge** uses the same collapse rule as the list: one unread per inbox conversation (plus each unread booking event). Legacy per-message `inbox_new_message` rows for one thread count as **1**, not N. `notifications-list` computes `unreadCount` from the recent capped window with `type` + `conversation_id` selected so collapse can run.
- When available, a **stay date range** appears under the name (e.g. `Aug 14 - 15, 2026` for inquiry or booked dates).
- The realtime **toast** uses the same guest name as the title with an inline **channel pill** (**Chat**, **Facebook**, or **Instagram**) for inbox rows, a **channel glyph** for inbox or a **category glyph** for booking events, the message preview in the body, and the stay range beneath it. Its **View** action uses the brand primary colour, and repeat messages in one conversation replace the open toast instead of stacking.
- The feed is capped in height inside the **Activity** card and pages on scroll (20 per request) — not a full-page dump. Phone rows are dense (13px title, single-line body preview, tighter padding); card chrome uses shared `text-card-title` / `text-card-description` tokens so Telegram headings and in-app descriptions stay the same size.

### Telegram notifications

#### Shared bot token (recommended default)

Save **one** BotFather token at the top. It pre-fills each module’s bot token field when you enable that module. You can still type a **different token on any module** — credentials are stored per module in the database.

If the shared token field is empty but a module already has a saved token (e.g. you connected Chat first), the card shows a **"Use the token from `<module>` notifications"** link below the field. Clicking it fills the field with that module's token so **Save and test** can run without retyping it.

**Product guidance:** One bot token handles all module traffic at typical property volume. Use **separate Chat IDs** per module so ops, staff, marketing, and inbox alerts land in the right groups. Use a different bot token per module only when you want separate bot identities or isolated credential rotation.

### Per-module flow (all six bots)

**Telegram notifications** group heading includes **Setup Guide** (BotFather + chat ID setup). **Shared bot token** card: **Save and test** validates via Telegram `getMe`, then saves; when saved, the card shows **Saved** instead of the button. When you enable a module, the bot token field pre-fills from this value (still editable per module).

1. **Enable notifications** — master toggle (**off by default**; opt-in per module). When off, only this toggle is shown.

**Plan gating:** Editing templates, credentials, and previews stay free. Turning **Enable notifications** on requires plan feature **`telegramNotifications`** per module — client pre-flight on the toggle; all `telegram-*-settings` PATCH handlers call **`gateTelegramEnabledPatch`** (429 + `upgradeHook`). The **Telegram notifications** group heading shows a solid `TierBadge` when not entitled (not repeated on each module card).

**Feature availability (super-admin):** Keys `notifications.telegram` (whole Telegram block), `notifications.telegram.settings` (PATCH/POST on all `telegram-*-settings`, including shared bot token save/test/discover), and `notifications.telegram.delivery` (live `sendMessage` + Telegram crons; settings stay readable). When the parent is off, the Telegram group shows a panel and hides the tier badge. Delivery paused shows an amber notice; settings paused locks fields and wraps **Connect** / **Save and test** in availability buttons. GET settings stay open so hosts can read config.

2. **Telegram connection** — bot token row, chat ID row (inline **?** help on each label), and **Connect** beside chat ID. The row lays out by the card's own width (container query, so it also fits the AI mode canvas): stacked under 32rem, token + chat ID side by side with **Connect** right-aligned below from 32rem, all three in one row from 42rem. The shared bot token card follows the same 32rem step. While setup is incomplete, Chat ID shows **Scan for chats** in the field; after scan, a **group dropdown** replaces the empty state. After **Connected**, chat ID shows the group name with **Reveal** for the raw id. Editing bot token or chat ID resets to **Connect**. Failed verify shows **Connection failed** beside the section title and an outline-destructive **Connect** to retry. Bot token shows the raw value by default (**Hide** masks characters; the field stays editable); chat ID shows **group name** by default.

3. **Manage cards** — after connect, shown inside a bordered group (Chat: **New message**; Marketing/Staff: **Notification controls**; Operations: **Workflow alerts**; Finance/Maintenance: **Reminder message**), same card pattern as **Telegram connection**:

- **Chat:** New message template for every inbound guest message (placeholders include `{{chat_source}}`, `{{chat_content}}`, attachment helpers, and `{{conversation_link}}` → `/org/:orgSlug/property/:propertySlug/inbox?conversationId=…&platform=web|facebook|instagram`)
- **Marketing:** Schedule alerts (daily times + calendar rules) · Message templates
- **Staff:** Schedule alerts · Message templates
- **Operations:** Message templates (6 scenarios)
- **Finance / Maintenance:** Reminder message (single template; module enable toggle only — no per-template switch)

### Saving behavior

| Action                                 | When it persists                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Enable notifications** toggle        | Immediately on change                                                                      |
| **Connect** (successful verify)        | Bot token and chat ID auto-saved to the server                                             |
| **Save** in schedule / template modals | Templates, schedule fields, and per-template toggles                                       |
| **Reset** in schedule modals           | Restores schedule/control fields to factory defaults (draft only until **Save**)           |
| **Reset** in template editor toolbar   | Restores the current template tab to its factory default (draft only until modal **Save**) |

There is no module-level **Save** or **Reset** footer — credentials must not require a separate save after Connect.

### Modals

| Manage target     | UI                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schedule alerts   | Daily times + **Calendar content** (urgency threshold, new-booking date limit with descriptions). Staff: daily summary time only. **Reset** beside **Save** restores defaults                                                                                                                                                                                                                                                    |
| Message templates | Per-template **toggle switches** (Marketing, Staff, Operations — **on by default**); sidebar nav shows on/off dot when >2 tabs. Finance / Maintenance / Chat: template editor only (module `enabled` gates sends). **Reset** in editor toolbar (between **Placeholders** and **Send preview**) restores that tab's default template. Module `enabled` + per-template toggle (where present) must both be on for cron/event sends |
| Placeholders      | **Placeholders** button in template dialog header → stacked modal above (search + tap-to-copy). Each token shows a short label and **e.g.** sample value                                                                                                                                                                                                                                                                         |

Legacy URLs redirect here — see [previous guide version](./notifications.md) redirect table (`…/marketing`, `…/finance?tab=settings`, etc.).

**Property Settings → Integrations → Telegram** **Configure** links deep-link via `?module=…`.

### Section nav

**Tabs:** **Activity** (unread count badge) then **Telegram**. Switching tabs replaces the URL `?view=` value and prompts first if a Telegram card has unsaved edits (Save / Discard / Keep editing).

**Activity tab:** the **Activity** card with the bounded feed. Delivery settings live in the header **Manage** sheet, not on the tab.

**Telegram tab:** the **Telegram delivery** master switch (white card, on/off for every module at once) followed by the sent-message history described above.

**Activity tab device card:** a fixed **Push notifications** row sits above the feed. It skeletons while the browser state is read, then shows the live switch. The row only ever talks about push; every unavailable state also says **In-app notifications still arrive in Activity**, so nobody mistakes a push problem for a dead notification center.

**Unavailable push.** When this device cannot subscribe (browser support missing, or a build without the VAPID key) the switch is **disabled** and the reason is shown in red. While a fresh service worker is still starting the row says **"Preparing notifications on this device…"** in muted text; if it does not come up, that becomes **"Notifications are not available on this device right now."** with no reload instruction. The row never invites a click that would fail, and it re-checks by itself once the worker becomes active. The same row and rules apply in the Manage sheet.

**Manage → Telegram:** **Telegram delivery** master switch, then **Telegram notifications** with **Get Help**, the shared bot token card, and one card per module. Cards stack on every screen width; the old desktop-only sidebar is gone.

---

## Host-facing knowledge

Notifications is the one place to review in-app alerts and set up Telegram for this property: booking workflow events, inbox messages, schedules, staff summaries, and finance or maintenance reminders. Each Telegram module has its own on/off switch, connection, and templates.

**Common host questions**

- Q: How do I get alerts on my phone when the app is closed?
  A: Turn on **Push notifications** at the top of this page. On iPhone/iPad you first need to **Add to Home Screen** (Share → Add to Home Screen), then open the installed app and turn it on there.
- Q: I turned it on but get nothing.
  A: Check the phone's notification settings for the app/site, make sure you didn't block notifications, and confirm you opened the **installed** app (not a browser tab) on iPhone. Each device opts in separately.
- Q: I replied to a guest with no signal - did it send?
  A: It's queued. The **Offline changes** card shows it "waiting to sync" and it sends automatically when you're back online. If it fails, the card shows why and you can retry or discard.
- Q: Where do I see everything the bell showed me?
  A: Open **Notifications** from the sidebar or **More** on a phone. The page opens on **Activity**. Or tap **View all** in the bell when you have more than five items.
- Q: Where did the phone-push settings go?
  A: Tap **Manage** in the Notifications header. The sheet holds **Push notifications**, **Push preferences** and the way into Telegram settings.
- Q: What do the four cards at the top mean?
  A: **Unread** and **Messages** count what is waiting for you. **Telegram on** and **Connected** show how many Telegram modules are switched on and how many have a bot token plus chat ID. Tap a card to jump to that tab.
- Q: Does the activity list only show this property?
  A: No. It shows your whole organization, same as the bell. The property name in the header only says where you are.
- Q: Can I see what was actually sent to Telegram?
  A: Yes. Open **Telegram** on the Notifications page. It lists the last 15 days of sends with the module, the message, and the time. Failed sends show the reason.
- Q: How do I stop every Telegram alert at once?
  A: **Manage**, **Telegram**, then turn off **Telegram delivery**. Each module keeps its own switch, so turning delivery back on restores your setup.
- Q: Where did the bell go on my phone?
  A: It is in the bottom menu as **Notifications**. On a computer it floats above the AI assistant button.
- Q: Why does a toast say "Guest" or "New guest message"?
  A: Older notifications may lack stored guest context. New inbox and booking alerts include the guest name and stay dates when the thread or booking has them.
- Q: Do I have to save again after connecting Telegram?
  A: No. Once you enter your bot token and chat ID and tap **Connect** successfully, the credentials save automatically. Template and schedule changes save when you confirm them in each modal.
- Q: Can I turn off just one type of alert?
  A: Yes. **Push preferences** has one switch per group (Bookings, Messages, Reviews, Pricing, Finance, Maintenance, Analytics, System). Muting a group stops the phone buzz; the item still appears in **Activity**. **Quiet hours** is a separate section below it: turn it on, then set **From** and **To**. It uses Asia/Manila time and still lets calendar-sync failures through. The toggles save instantly.
- Q: Do these preferences follow me to another device?
  A: Yes. Push preferences belong to your account; the **Push notifications** switch at the top is per device, so turning off one phone does not silence the others.
- Q: Do I need a different bot for every module?
  A: No, one shared bot token is enough. Save it once at the top and each module can reuse it, or override with its own token if you'd rather. Use different **Chat IDs** so each module posts to the right group.
- Q: How do I pick a Telegram group?
  A: Leave Chat ID empty, tap **Scan for chats** in that field, then choose your group from the dropdown. Add the bot to the group and send a message first if nothing appears.
- Q: Where did the Find chat ID scanner go?
  A: It moved into the Chat ID field. Tap **Scan for chats** to get a group dropdown, and once you're **Connected**, the field shows the group name. Use **Reveal** if you need the numeric id.
- Q: I used to have separate Staff or Operations pages. Where did they go?
  A: They all moved here. Old links to Staff, Operations, Finance, or Maintenance settings redirect to the matching section on this Notifications page.

---

## Save paths

Each module uses its existing edge function (property-scoped via `property_id`):

| Module      | Edge function                   | UI component                      |
| ----------- | ------------------------------- | --------------------------------- |
| Chat        | `telegram-chat-settings`        | `TelegramChatSettingsCard`        |
| Marketing   | `telegram-marketing-settings`   | `TelegramMarketingSettingsCard`   |
| Staff       | `telegram-staff-settings`       | `TelegramStaffSettingsCard`       |
| Operations  | `telegram-admin-settings`       | `TelegramAdminSettingsCard`       |
| Finance     | `telegram-finance-settings`     | `TelegramFinanceSettingsCard`     |
| Maintenance | `telegram-maintenance-settings` | `TelegramMaintenanceSettingsCard` |

Credentials unlock logic: `telegramCredentialsReady()` — saved token **and** chat ID on server, or both fields filled in the current draft.

**Chat send path:** after each inbound guest message insert (`webGuestChatService.sendGuestWebMessage`, Meta DM webhook), `notifyTelegramChatInbound` loads `telegram_chat_settings` for the conversation property (or first org property with Chat enabled for org-level Meta threads) and sends when `enabled`. `{{chat_source}}` resolves to **Web chat**, **Facebook Messenger**, or **Instagram** from `social_conversations.platform`. Attachment-only messages fill `{{chat_content}}` as `(attachment)` and set `{{attachment_line}}` / `{{attachment_summary}}`.

---

## Permissions

- Page route: `notifications:view`.
- Per Telegram module edit: `notifications.{chat,marketing,staff,operations,finance,maintenance}:edit`.
- Shared bot-token card: editable with **any one** of the six module edit grants (Q3).
- Plan: all six module edits also require `telegramNotifications`.
- Server: `verifyPropertyAccess` / `resolveTelegramAssetAccess` on every settings edge function.

---

## Implementation map

| Concern                                            | Path                                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page                                               | `ui/src/features/dashboard/bookings/pages/NotificationsPage.tsx`                                                                                                                           |
| Hub shell (KPI cards + tabs)                       | `…/notifications/components/NotificationsHubShell.tsx`, `NotificationsHubSummaryCards.tsx`, `NotificationsHubTabs.tsx`, `hooks/useNotificationsHubView.ts`, `hooks/useTelegramHubStats.ts` |
| Manage sheet (2 tabs, master switch)               | `…/notifications/components/NotificationsManage.tsx` (reuses `PushNotificationsCard`, `NotificationPreferencesCard`, `QuietHoursCard`, `NotificationMasterSwitchRow`)                      |
| Sent-message history                               | `…/notifications/components/NotificationsTelegramHistory.tsx`, hooks `useTelegramHistory` / `useTelegramDeliveryControl`, `lib/telegramHistory.ts`                                         |
| Edge: history + master switch                      | `supabase/functions/telegram-message-log`, `supabase/functions/telegram-delivery-settings`                                                                                                 |
| Edge: send logging + master check                  | `supabase/functions/_shared/telegramMessageLog.ts`, `telegramDeliveryControl.ts`, checked in every `telegram*`/`parkingBroadcast` send path                                                |
| Activity tab                                       | `…/notifications/components/NotificationsActivityView.tsx`                                                                                                                                 |
| Loading skeleton                                   | `NotificationsPageBodySkeleton` (`NotificationsSkeleton.tsx`) — four KPI cards, tab bar, activity rows                                                                                     |
| In-app list (bell + page)                          | `ui/src/features/dashboard/notifications/components/InAppNotificationsPanel.tsx`                                                                                                           |
| Help copy                                          | `…/notifications/lib/notificationsHelpCopy.ts` (`NOTIFICATIONS_HOW_IT_WORKS`, hub hints)                                                                                                   |
| How it works (page title `?`)                      | `ui/src/components/help/HowItWorksButton.tsx` in `AdminMobilePage.titleHint` (`ui/src/components/mobile/MobileBrandHero.tsx`, `.../AdminPageHeader.tsx`)                                   |
| OS push opt-in card                                | `ui/src/features/dashboard/notifications/components/PushNotificationsCard.tsx` + `hooks/usePushNotifications.ts` + `ui/src/lib/pwa/push.ts` · pipeline: `docs/architecture/pwa.md` §5      |
| Push preferences + quiet hours                     | `…/notifications/components/NotificationPreferencesCard.tsx`, `QuietHoursCard.tsx`, `NotificationMasterSwitchRow.tsx`; store: `lib/notificationPreferences.ts`                             |
| Offline changes (Sync Center)                      | `ui/src/features/dashboard/offline/components/SyncCenterCard.tsx` + `store/offlineSyncStore.ts` · engine: `ui/src/lib/pwa/syncEngine.ts` · `docs/architecture/pwa.md` §6                   |
| Bell (5-item preview + View all)                   | `ui/src/features/dashboard/notifications/components/NotificationBell.tsx` (desktop FAB in `AdminLayout`; mobile Notifications tab)                                                         |
| Shared bot token card                              | `…/telegram-notifications/TelegramGlobalBotTokenCard.tsx`                                                                                                                                  |
| Help dialogs                                       | `…/telegram-notifications/TelegramHelpDialog.tsx`, `…/lib/telegramHelpContent.ts`                                                                                                          |
| Global bot hook + context                          | `…/hooks/useTelegramGlobalBotToken.ts`, `…/TelegramNotificationsGlobalBotContext.tsx`                                                                                                      |
| Module-token prefill suggestion                    | `…/hooks/useFirstConnectedTelegramModuleToken.ts`                                                                                                                                          |
| Edge: shared token                                 | `supabase/functions/telegram-global-settings/index.ts`                                                                                                                                     |
| Chat settings card                                 | `ui/src/features/dashboard/bookings/components/TelegramChatSettingsCard.tsx`                                                                                                               |
| Chat notify (inbound)                              | `supabase/functions/_shared/telegramChat.ts` → `notifyTelegramChatInbound`                                                                                                                 |
| Module shell (enable → credentials → manage cards) | `ui/src/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationModuleLayout.tsx`                                                                                |
| Module loading skeleton                            | `…/TelegramNotificationModuleSkeleton.tsx`                                                                                                                                                 |
| Manage summary card                                | `…/TelegramSettingsManageCard.tsx`                                                                                                                                                         |
| Manage / template dialogs                          | `…/TelegramManageDialog.tsx`, `…/TelegramTemplatesManageDialog.tsx`                                                                                                                        |
| Credential auto-save on Connect                    | `ui/src/features/dashboard/bookings/hooks/useTelegramCredentialAutoSave.ts`                                                                                                                |
| Stacked placeholders modal                         | `…/TelegramPlaceholdersNestedDialog.tsx`                                                                                                                                                   |
| Credentials helpers                                | `…/telegramCredentials.ts`                                                                                                                                                                 |
| Chat ID scan + picker (setup)                      | `…/telegram-notifications/TelegramChatIdField.tsx` — inline scan; dropdown after scan; masked label when **Connected**                                                                     |
| Friendly credential mask + reveal                  | `…/telegram-notifications/TelegramSecretInput.tsx`, `…/lib/telegramConnectionLabels.ts`                                                                                                    |
| Section nav                                        | `ui/src/features/dashboard/bookings/components/AdminSectionNavLayout.tsx`                                                                                                                  |
| Dialog stacking (`overlayClassName`)               | `ui/src/components/ui/dialog.tsx`                                                                                                                                                          |

---

## Testing

| Layer | Path / spec                                                                                                                                                                                                         | Manual                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Unit  | Telegram template validators; `notificationPreferences.test.ts` (group parity, normalize)                                                                                                                           | —                               |
| E2E   | `ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts` notifications shell (`@ci`); `notificationsHub.spec.ts` (KPI cards, history + paging, deep links, feed paging, Manage tabs, master switch, unsaved token) | Live Telegram send, PWA OS push |
| Deno  | `_shared/telegramMessageLog_test.ts` (row shaping, truncation, status)                                                                                                                                              | —                               |
| N/A   | —                                                                                                                                                                                                                   | —                               |

---

## Related docs

- [Route index](../../README.md)
- [`docs/PROJECT.md`](../../../PROJECT.md)
- [`docs/archive/reference/telegram-marketing-reminders.md`](../../../archive/reference/telegram-marketing-reminders.md)
