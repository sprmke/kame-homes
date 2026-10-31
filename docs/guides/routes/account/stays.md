---
title: 'Guest Stays — operator guide'
status: active
tags: [guides, routes, account, inbox]
updated: 2026-08-17
---

# Guest Stays — operator guide

Route: `/account/stays` (legacy `/account/messages` redirects here)

> **Status:** Documented.

## Progress overview

| Section      | E2E save | Validation | Docs       | Notes                                  |
| ------------ | -------- | ---------- | ---------- | -------------------------------------- |
| Thread list  | ✅       | —          | Documented | `social_conversations`, `platform=web` |
| Compose/edit | ✅       | —          | Documented | `guest-web-chat-messages`              |
| Realtime     | ✅       | —          | Documented | Supabase Realtime on `social_messages` |

---

## Overview

Master-detail inbox hub for all of a guest's **web chat** threads with hosts across every property **and parking slot** they've messaged — one hub, not per-listing. Nav label is **Stays** (stay-related host conversations). This is a different surface from the property-scoped chat at `/properties/:propertySlug/messages` ([properties/chat.md](../properties/chat.md)): that page is a single-thread full-screen chat for one property; this page is the guest's cross-property inbox listing every thread they have.

Bookings themselves are listed under **Trips** ([trips.md](./trips.md)), which opens each booking's [trip page](../trip.md).

Desktop: thread list (left) + selected conversation (right), first thread auto-selected on wide screens. Mobile: thread list, then conversation with a back button — no side-by-side split.

---

## Host-facing knowledge

Guests have one **Stays** inbox that lists every conversation they've had with any of your properties (or other hosts), similar to a normal messaging app. Sending, editing, or unsending a message here works the same as the single-property chat. It's the same conversation, just viewed from the guest's side in one place instead of per property.

**Common host questions**

- Q: Is this a different conversation from the one I see in my Guest Inbox?
  A: No, it's the exact same thread. The guest just sees all their conversations (across every property) in one list, while you see conversations for your property in your inbox.
- Q: Can a guest have more than one thread with the same property?
  A: No, there's one thread per guest-and-property pair.
- Q: Can a guest have more than one thread with the same parking slot?
  A: No, there's one thread per guest-and-parking-slot pair (`web:parking:{parkingId}:{guestUserId}`).

---

## Stays hub

### Fields (per thread row)

| Field                 | Storage                                                             | Notes                |
| --------------------- | ------------------------------------------------------------------- | -------------------- |
| Property name / image | Property listing fields when `property_id` set                      |                      |
| Parking name / image  | Parking listing fields when `parking_id` set                        |                      |
| Host name / avatar    | Host / org profile fields                                           |                      |
| Inquiry dates         | `social_conversations.inquiry_check_in/out`                         | Shown when set       |
| Last message preview  | `social_conversations.subject_preview` / last `social_messages` row |                      |
| Unread count          | Guest-side unread counter                                           | Shown as a dot badge |
| Reply status          | `social_conversations.reply_status`                                 | e.g. pending badge   |

### Load path

1. Page mount → **`guest-messages`** (GET, guest JWT) — lists **`social_conversations`** rows where `platform = 'web'`, the guest owns the thread (`guest_user_id` or linked participant), and at least one message exists (`subject_preview` set).
2. Selecting a thread loads its message history via the same web-chat hooks/API used by the property-scoped chat page (`useGuestChatMessages`). For property threads, `guest-web-chat-resume` also supplies `stayGuideUrl` when the guest has an active stay guide, and inquiry dates are passed into the composer Insert / resource hub.
3. Empty state ("No messages yet.") links to **Browse properties** (`/properties`).

### Compose / edit / unsend path

1. Type message → Send → **`guest-web-chat-messages`** POST `{ conversationId, text?, attachments?, replyToMessageId? }`.
2. Edit own inbound message → PATCH `{ conversationId, messageId, text }` — allowed until the host has read it or replied.
3. Unsend → POST `{ action: 'unsend', conversationId, messageId }` — allowed under the same until-read condition.
4. Opening a thread marks it read (mark-read call), clearing its unread badge.

### Behavior / edge cases

- Realtime: subscribes to `INSERT` and `UPDATE` on **`social_messages`** so new host replies and read/edit/unsend state appear live without refresh.
- On mobile, only one pane (list or conversation) is visible at a time; desktop shows both side by side and auto-selects the first thread.
- In-thread search is available in the conversation header (same pattern as host inbox / property chat).
- Host reply notification emails deep-link to `/account/stays`.

---

## API reference

| Action                     | Endpoint                        |
| -------------------------- | ------------------------------- |
| List guest message threads | `GET guest-messages`            |
| Get thread messages        | `GET guest-web-chat-messages`   |
| Send / mark read / unsend  | `POST guest-web-chat-messages`  |
| Edit own message           | `PATCH guest-web-chat-messages` |

---

## Implementation map

| Concern         | Path                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Page            | `ui/src/features/guest/account/pages/GuestMessagesPage.tsx`                                                                 |
| Hub UI          | `ui/src/features/guest/account/components/GuestMessagesHub.tsx`                                                             |
| Thread row      | `ui/src/features/guest/account/components/GuestMessageThreadRow.tsx`                                                        |
| Hook            | `ui/src/features/guest/account/hooks/useGuestMessages.ts`                                                                   |
| API client      | `ui/src/features/guest/account/lib/guestAccountApi.ts`                                                                      |
| Shared chat UI  | `ui/src/features/guest/chat/components/GuestChatThread.tsx`, `ui/src/features/guest/chat/components/GuestChatHeaderBar.tsx` |
| Chat hooks      | `ui/src/features/guest/chat/hooks/useGuestChat.ts`                                                                          |
| Edge (list)     | `supabase/functions/guest-messages/index.ts`                                                                                |
| Edge (messages) | `supabase/functions/guest-web-chat-messages/index.ts`                                                                       |
| Shared services | `supabase/functions/_shared/guestProfileService.ts`, `supabase/functions/_shared/chatMessageLifecycle.ts`                   |

---

## Testing

| Layer | Path / spec                                                           | Manual              |
| ----- | --------------------------------------------------------------------- | ------------------- |
| E2E   | `ui/e2e/features/account/accountSmoke.spec.ts` empty hub load (`@ci`) | Live thread replies |
| N/A   | Meta / web chat delivery                                              | Manual inbox        |

---

## Related docs

- [Route index](../README.md)
- [Profile](./profile.md)
- [Favorites](./favorites.md)
- [Property chat](../properties/chat.md) — property-scoped single-thread chat (distinct surface, same underlying threads)
- [`docs/PROJECT.md`](../../PROJECT.md)
- `.cursor/rules/social-inbox.mdc`
