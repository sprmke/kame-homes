---
title: 'Telegram delivery control + sent-message history'
stage: in-progress
status: in-progress
tags: [workflow, in-progress, notifications, telegram, history, delivery]
updated: 2026-11-07
kind: plan
---

# Telegram delivery control + sent-message history

Status: in progress (P1–P6 implemented 2026-11-06; migration pending deploy)
Routes: property + parking `…/notifications`

## Goal

1. Show a read-only copy of what each Telegram group actually received, with pagination and a
   short retention window.
2. Move all Telegram management (shared bot token, module switches, templates) into the header
   **Manage** sheet as a second tab, so the page keeps one job per tab.
3. One master switch that stops every Telegram send for the asset, without touching per-module
   switches.

## Decisions

- **Retention: 15 days.** Reads filter `created_at >= now() - 15 days`; a `prune` function deletes
  older rows. Nothing else reads the table, so the window is one SQL predicate, not a cleanup job
  dependency.
- **One row per send attempt.** Volume is send-volume (bookings, inbox messages, daily summaries),
  not page views. One insert per send is cheaper than any derived approach and it is the record.
- **No chat id stored.** `module` identifies the group (one chat per module), so the log never
  holds a credential.
- **Writes never block or break a send.** `logTelegramMessage` swallows every error and is called
  after the response is parsed.
- **Master switch fails open.** No row means enabled. A control-table read failure must not stop
  alerts; it logs and continues.
- **History is scoped to the asset** (property or parking), unlike the org-wide Activity feed.
  Telegram groups are configured per asset, so the copies should be too.

## Data

`telegram_message_log`

| column                       | notes                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `id`                         | uuid pk                                                                      |
| `property_id` / `parking_id` | one of them, cascade on delete                                               |
| `module`                     | chat, marketing, staff, operations, finance, maintenance, parking, broadcast |
| `message_text`               | capped at 4096, same as Telegram                                             |
| `status`                     | `sent` or `failed`                                                           |
| `error_message`              | Telegram description on failure                                              |
| `created_at`                 | `now()`, indexed with the scope columns                                      |

`telegram_delivery_control` — one row per property or parking, `enabled` boolean, `updated_at`,
`updated_by`. Unique partial indexes on each scope column. No row = enabled.

Both tables: RLS enabled, no policies, `service_role` only. Every read and write goes through an
edge function.

## Phases

**P1 — data + plumbing.** Migration, `_shared/telegramDeliveryControl.ts`,
`_shared/telegramMessageLog.ts`.

**P2 — sends.** Log every send attempt and honour the master switch in all six send paths
(`telegramChat`, `telegramFinance`, `telegramMaintenance`, `telegramMarketing`, `telegramStaff`,
`telegramAdmin`, `telegramParking`, `parkingBroadcast`). Test sends and previews bypass the master
switch so a host can still verify a group.

**P3 — API.** `telegram-message-log` (GET, keyset pagination, 15-day window) and
`telegram-delivery-settings` (GET/PATCH master switch) using `resolveTelegramAssetAccess`.

**P4 — Manage sheet tabs.** `NotificationsManage` becomes two tabs: **Activity** (device + push
preferences) and **Telegram** (master switch, shared bot token, module cards). The page's Telegram
tab is freed for the history.

**P5 — History UI.** Page **Telegram** tab: master-switch state, newest-first message cards with
module chip, relative time, text preview with expand, and Newer / Older paging. Empty, error and
"delivery off" states.

**P6 — tests + docs.** Deno tests for the paging window and the master-switch resolution, Vitest
for formatting, Playwright for the Manage tabs, the master switch and the history list, route
guides, skeletons, FAQs.

## Edge cases

| Case                                          | Handling                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| Master switch off, cron fires                 | Send path returns `master_disabled`, no Telegram call, no log row.     |
| Master switch off, host presses Save and test | Test send still goes out so setup can be verified.                     |
| Control row missing / query fails             | Treated as enabled; failure logged, send proceeds.                     |
| Telegram rejects a send                       | Row written with `failed` + description, so the host sees why.         |
| Message longer than 4096                      | Stored truncated at 4096, the same text Telegram received.             |
| Property archived / parking deleted           | Log rows cascade with the asset.                                       |
| Older than 15 days                            | Not returned by the endpoint; pruned by the retention function.        |
| Two modules, one chat id                      | Rows stay distinct by `module`, which is what the host is looking for. |
| Page opened while the master switch is off    | History still readable, with a notice that delivery is paused.         |
| Very first visit (no rows yet)                | Empty state: "Nothing sent yet." with a pointer to the Manage sheet.   |

## Tests

- Deno: `telegramMessageLog_test.ts` (row shaping, truncation, status), `telegramDeliveryControl_test.ts`
  (missing row = enabled, scope key selection).
- Vitest: history formatting (module labels, relative time, preview length).
- Playwright (`notificationsHub.spec.ts`): Manage tabs, master switch toggle + refetch, history list
  renders rows, pagination moves between pages, empty state.
- Route-guide testing tables updated for the new spec coverage.

## Out of scope

- Re-sending or editing a logged message from the history.
- Per-message delivery receipts / read status (Telegram does not expose it for channel sends).
- Searching the history server-side; the 15-day window keeps the list short.

## Shipped 2026-11-06

- P1–P3: migration `20261320000000_telegram_delivery_and_message_log.sql`,
  `_shared/telegramMessageLog.ts`, `_shared/telegramDeliveryControl.ts`, `_shared/telegramScope.ts`,
  `telegram-message-log` and `telegram-delivery-settings` edge functions, send logging + master
  check wired into chat/finance/maintenance/marketing/staff/operations/parking/broadcast.
- P4: `NotificationsManageDialog` with Activity / Telegram tabs; the page Telegram tab is the
  history. Legacy `?module=` links open the sheet on the Telegram tab and scroll to the card.
- P5: `NotificationsTelegramHistory` with module chips, failed-send reasons, expand, and
  Newer / Older paging.
- P6: Deno `telegramMessageLog_test.ts`, Vitest `telegramHistory.test.ts` + pager tests, 10
  Playwright cases, route guides and FAQs.

**Deploy note:** the tables, the master switch and the history need the migration applied
(`kamewave` unlock required for production).
