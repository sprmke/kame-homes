---
title: 'Parking Guest Inbox'
status: active
tags: [guides, routes, org, parking]
updated: 2026-08-23
---

# Parking Guest Inbox

Route: `/org/:orgSlug/parking/:parkingSlug/inbox`

> **Status:** Documented

## Progress overview

| Section       | E2E | Validation | Docs | Notes                                                 |
| ------------- | --- | ---------- | ---- | ----------------------------------------------------- |
| Messages      | Yes | Yes        | Yes  | Web chat live; Meta not offered for parking           |
| Quick replies | Yes | Yes        | Yes  | Parking-scoped, seeded with parking-specific defaults |
| Automation    | Yes | Yes        | Yes  | Parking-scoped AI auto-reply settings                 |

## Overview

Parking operators open Guest Inbox for this slot. **Meta (Facebook/Instagram) is not supported for parking** — there is no Channels tab and no Connect Meta prompt. **Web** is scoped by `parking_id` — guest parking web chat threads appear here when guests use **Contact Host** on the public parking listing or resume from **Stays**.

Quick replies and Automation are managed directly on the **parking** Guest Inbox, scoped to this parking listing (not shared with property or other parkings in the org).

---

## Host-facing knowledge

Parking **Guest Inbox** is for website chat with parking guests; Facebook and Instagram messaging is not available here. Guests can start a thread from **Contact Host** on your public parking page; messages show in this inbox and can trigger **Chat** Telegram alerts when configured. You can set up **Quick replies** and **Automation** from Manage — they apply to this parking listing only.

**Common host questions**

- Q: Can I connect Facebook or Instagram to this parking inbox?
  A: No — Meta messaging is only available for property inboxes. Parking Guest Inbox is web-chat only.
- Q: Why is the message list empty?
  A: No guest has started a web chat for this slot yet. Share your public parking link and ensure **Contact Host** is visible on the listing.
- Q: Where do I edit canned replies or turn on auto-reply for parking?
  A: Open this parking's Guest Inbox → **Manage** → Quick replies or Automation. These settings are specific to this parking listing.
- Q: Are the quick replies the same as my property's?
  A: No — parking quick replies are a separate list pre-seeded with parking-relevant answers (rates, vehicle details, entry/exit, payment, etc.), independent of any property's quick replies.

---

## Permissions

| Permission     | UI                                |
| -------------- | --------------------------------- |
| `inbox:view`   | Open inbox, read threads          |
| `inbox:reply`  | Send replies, AI suggest          |
| `inbox:manage` | Manage Quick replies / Automation |

## Behavior

- No Channels tab, no Meta connect/disconnect. Platform filter is Chat (web) only — Facebook/Instagram and the aggregating **All** tab are hidden (no switcher when a single channel is available).
- **Quick replies:** stored in `social_reply_templates` with `parking_id` set to this parking's id. First load auto-seeds `_shared/inboxDefaultQuickReplies.ts#INBOX_DEFAULT_PARKING_QUICK_REPLIES` (availability, rates, vehicle details, entry/exit, location, payment, extend booking, lost ticket/access code, cancellation, follow-up) if the list is empty.
- **Automation:** stored in `social_inbox_settings` with `parking_id` set to this parking's id — a separate row from the org/property default (`parking_id IS NULL`). AI auto-reply runs on inbound parking web chat when enabled.
- Failed thread loads show a retryable load error instead of the generic empty state.
- List / thread layout follows the inbox card width, same as [Property Inbox](../property/inbox.md) (one pane below 42rem, side-by-side above).
- Query/body: `parking_id`; auth via `verifyParkingTeamAccess` + `inbox:*`.

**Unsaved changes.** Closing with unsaved edits (X, Esc, outside click, Cancel, or leaving the page) asks to **Save & close**, **Discard**, or **Keep editing**. Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Implementation map

| Area                    | Path                                                                   |
| ----------------------- | ---------------------------------------------------------------------- |
| Page                    | `ui/src/features/dashboard/inbox/pages/ParkingInboxPage.tsx`           |
| Shell                   | `ui/src/features/dashboard/inbox/pages/InboxPage.tsx`                  |
| Manage menu/modals      | `ui/src/features/dashboard/inbox/components/InboxManageModals.tsx`     |
| Scope                   | `supabase/functions/_shared/metaInboxScope.ts`, `inboxAccess.ts`       |
| Default quick replies   | `supabase/functions/_shared/inboxDefaultQuickReplies.ts`               |
| Templates/settings CRUD | `supabase/functions/social-inbox-templates/`, `social-inbox-settings/` |

---

## Testing

| Layer | Path / spec                                                                  | Manual        |
| ----- | ---------------------------------------------------------------------------- | ------------- |
| Unit  | `parkingStatusMachine_test.ts`                                               | —             |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs | PayMongo live |
| N/A   | Parking host dashboard shell load                                            | —             |

## Related

- [Org Inbox](../inbox.md)
- [Property Inbox](../property/inbox.md)
