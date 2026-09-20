---
title: 'Property Guest Inbox'
status: active
tags: [guides, routes, org, property]
updated: 2026-09-21
---

# Property Guest Inbox

Route: `/org/:orgSlug/property/:propertySlug/inbox`

> **Status:** Documented

## Progress overview

| Section       | E2E | Validation | Docs | Notes                                                                                      |
| ------------- | --- | ---------- | ---- | ------------------------------------------------------------------------------------------ |
| Messages      | Yes | Yes        | Yes  | Web scoped to property; Meta = effective connection                                        |
| Channels      | Yes | Yes        | Yes  | First connect becomes org-default Meta; later connects override                            |
| Quick replies | Yes | Yes        | Yes  | Org-scoped templates; managed here with `inbox.quickReplies:*` / `inbox.automation:edit`   |
| Automation    | Yes | Yes        | Yes  | Org-scoped AI settings; managed here with `inbox.quickReplies:*` / `inbox.automation:edit` |

## Overview

Property operators open Guest Inbox scoped to this property. **Web** threads are only those with `property_id` matching this property. **Facebook/Instagram** show threads for the **effective** Meta Page: a property override if connected, otherwise the **org default** Page (full org Page inbox — decision 1A) with a **Using org Meta** badge.

**Org Meta badge + cross-property switcher (shipped):** when a thread falls back to the org connection (Facebook/Instagram only), the open conversation header shows a small **Org Meta** pill with a tooltip explaining the shared-Page fallback (`InboxConversationView`, not just the Channels tab). If that thread also best-effort matches a booking on a **different** property in the org (same match logic as Insert → Booking: unique inquiry-date or guest-name match), a **"Looks like `<property>`"** link appears next to it — clicking deep-links to that property's own Inbox with the same `conversationId` open (Meta conversations are keyed by connection, not property, so the same thread resolves there too). No match found → no link; avoids guessing wrong.

**Plans/RBAC decision (cross-property switcher):** No new `PlanFeatureKey` and no new permission leaf — the link only surfaces data the host's own org membership already grants (their org's bookings across properties they can already see in org-scoped booking lists) and navigates through the normal `propertyRoute()` guard on the destination, so the target property's own RBAC still applies unchanged. N/A for `audit-logging` — read-only navigation, no mutation.

**Manage** (Channels / Quick replies / Automation) lives on the property inbox. There is no org-level Inbox route anymore (`/org/:orgSlug/inbox` redirects to Properties). Quick replies and automation data remain **organization-scoped** (shared across properties); Channels connect/disconnect is scoped as described below.

## Host-facing knowledge

This is where you read and reply to guest messages for this property: website chat plus Facebook and Instagram when connected. Use **Manage** to connect Meta, save quick replies, and turn on AI automation. Web chat threads belong to this property only; social messages use your connected Facebook Page (this property’s own connection, or the shared organization Page).

**Common host questions**

- Q: Why do I see a badge saying I'm using the organization's Meta account?
  A: Your property hasn't connected its own Facebook Page yet, so you're seeing messages from the shared Page inbox — the same one every other property without its own Page also sees. You can connect a property-specific Page under Channels if you want this listing to use its own account.
- Q: A message doesn't seem to be about this property — what do I do?
  A: If it's a shared org Meta thread, open it and check for a **"Looks like `<property>`"** link next to the Org Meta badge. We match the guest's name or stated dates against bookings across your other properties; if it finds a unique match, tap it to jump straight to that property's Inbox with the same conversation open. No link means we couldn't tell — check the guest's message for details or ask which listing they mean.
- Q: Where do I set quick replies and automation?
  A: On this property Inbox under **Manage** → Quick replies / Automation. Those settings apply across your organization.
- Q: Why can't I reply to some Facebook or Instagram messages?
  A: Meta only allows replies within 24 hours of the guest's last message. After that window closes, you'll need the guest to message you again before you can respond from here.
- Q: What is the support follow-up toggle?
  A: If a guest messaged within the last 7 days but the normal 24-hour reply window has already closed, the composer can show a support follow-up toggle. Turn it on only for non-promotional follow-ups; it sends with Meta's `HUMAN_AGENT` tag.
- Q: Why does an Instagram chat say Guest?
  A: We load the sender’s Instagram username from Meta. Open the thread once (or wait for their next message) if an older conversation still shows Guest.
- Q: What does Disconnect do?
  A: Disconnect removes the Meta connection and deletes synced Facebook/Instagram conversations from this inbox. You can reconnect again to view and load conversations.
- Q: What should I put in **Tone & rules** under Manage AI response?
  A: Only extra tone or rules. Property details, rates, availability, booking info, and Quick replies are already used automatically — tap the **?** next to the label for that reminder.
- Q: How do I send my guest their approved GAF, a calendar link, or a link to check their security deposit refund?
  A: Tap the **Insert** icon (`+` next to Quick reply and Suggest) in the composer. Pick a property link, public page, map link, payment methods, **Check-in pack**, or search for the guest's booking to insert Stay Guide, Approved GAF, Approved Pet Form, Parking Endorsement, **Use your parking** / **Find parking**, Security Deposit Refund, or Leave a Review — whichever apply to that booking's status. When the thread matches a booking by guest name and inquiry dates, that booking is pre-selected.
- Q: Can quick replies use the guest's name or dates automatically?
  A: Yes. In Manage → Quick replies, use placeholders like `{{guest_name}}`, `{{property_name}}`, `{{check_in_date}}`, `{{check_out_date}}`, `{{inquiry_dates}}`, or link tokens such as `{{calendar_link}}`, `{{form_link}}`, `{{map_link}}`, `{{stay_guide_link}}`. They fill in when you insert a quick reply, pick a **Snippets** row in Insert (`+`), or send — using the open thread and any auto-matched booking. The form shows a live preview when placeholders or URLs are present.
- Q: What are pinned snippets?
  A: On property Inbox, **Manage → Quick replies** includes **Pinned snippets** — up to five property-specific saved messages (separate from org quick replies). They appear under **Pinned** in the Insert (`+`) menu for one-tap insert.
- Q: Can I attach photos or PDFs to a website chat reply?
  A: Yes — use the paperclip on **website chat** threads (JPEG, PNG, WebP, PDF). Meta Facebook/Instagram replies from this UI remain text-only.

**Plan gating:** Manual replies and **Manage AI response** stay free. Enabling **Send automatically** requires **`aiChatAutoReply`** (Automation tab pre-flight + **`social-inbox-settings`** PATCH) — the **Send automatically** card title shows a solid `TierBadge` when not entitled. Runtime auto-reply skips when the property plan lacks the feature; org-level contexts without a property id use **`requireOrgPropertyFeature`** / **`orgHasPropertyWithFeature`** on the server. **Connecting Meta** (Facebook/Instagram) requires **`metaChatChannel`** (Business tier and up) — client pre-flight on Connect/Reconnect in Channels **and** the empty-state **Connect** button on Facebook/Instagram tabs (`InboxPage` + Channels tab), server check on **`meta-inbox-oauth-start`**; solid corner `TierBadge` sits on those Connect/Reconnect buttons (not the Meta row title). **Quick replies** require **`quickReplies`** (Starter+) to save or insert into a draft — the Quick replies panel itself stays browsable on Free (preview-open policy), only save (client + server **`social-inbox-templates`** POST/PATCH) and insert-into-draft are blocked; list/delete stay ungated on every tier.

## Permissions

| Permissions                                    | UI                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `inbox:view`                                   | Open inbox, read threads                                            |
| `inbox.messages:edit`                          | Send replies, AI suggest                                            |
| `inbox.channels:add` / `:delete`               | Connect / disconnect Meta (+ full backfill); Channels manage button |
| `inbox.quickReplies:add` / `:edit` / `:delete` | Quick reply CRUD; Quick replies manage button                       |
| `inbox.automation:edit`                        | Automation settings; Automation manage button                       |

Manage chrome is **leaf-split**: Channels / Quick replies / Automation buttons and modal tabs only appear when the matching leaves above are granted (not a single umbrella manage flag).

## Behavior

- **Manage actions:** Desktop (`lg+`) shows separate header buttons — **Channels**, **Quick replies**, **Automation** — each opening its modal. Mobile (`max-lg`) groups them in the hero **Inbox actions** menu (bottom sheet).
- **Channel order:** Inbox tabs, quick-reply filters/groups, and automation platform toggles use **All** (when present), then **Chat**, **Facebook**, **Instagram**.
- **Manage AI response:** textarea label is **Tone & rules**; a **?** tooltip explains that property facts and Quick replies are already injected. **Reset to default** restores the shipped starter copy.
- **Thread list:** stay dates + channel pill when relevant; no property-name badge (inbox is already property- or parking-scoped).
- **First Meta connect** from a property (when no org-default Page exists) writes the **org-default** connection so Marketing Studio and other properties can inherit it.
- **Webhook health:** connected Meta rows record `webhook_last_verified_at` and retry attempts. After repeated failed checks, Channels shows **Fix connection**, which re-verifies and re-subscribes the messaging webhook fields in place — without disconnecting or wiping history.
- **Proactive Meta warnings:** Channels can also surface invalid tokens or soon-expiring tokens before a host hits a send failure. **Reconnect** refreshes the full OAuth grant; **Fix connection** remains the lighter webhook-only repair.
- Later Connect from a property that already has an org-default writes a **property override** (`property_id` set); does **not** wipe the org default.
- **Disconnect:** removes the Meta connection and deletes synced Facebook/Instagram conversations from this inbox.
- **Meta connect / sync / disconnect progress:** while the first conversation backfill runs after connect, or while disconnect is processing, a **non-dismissible** modal covers the inbox with title, “may take a few minutes” copy, animated progress, and (during sync) a loaded-conversation count. Outside click, Escape, and close are blocked until the operation finishes. **Channels**, page picker, and other manage modals **close automatically** so only this progress modal is visible (OAuth return shows a toast, not Channels).
- **Channels list:** Meta only (Facebook Messenger + Instagram DMs). TikTok / Airbnb messaging are not offered (API partnership / approval barriers).
- **Reply windows:** Meta DMs are fully open for 24 hours after the guest's last inbound message. After that, but before 7 days have passed, the composer can still send only when the operator explicitly enables the non-promotional **support follow-up** toggle (`HUMAN_AGENT`). Past 7 days, Meta DMs stay fully read-only until the guest messages again.
- **Older history loading:** thread list scrolling paginates only the conversations already stored in Kame. Once the local list is exhausted, older Meta history requires an explicit **Load older from Meta** action instead of silently running a live backfill from scroll position.
- **Error states:** a failed thread fetch now renders a retryable load error instead of falling back to the generic empty state. A failed message fetch keeps the current conversation visible and shows an inline **Retry** banner inside the thread pane.
- Query/body: `property_id` on inbox edge functions; auth via `verifyPropertyAccess` + `inbox:*`.
- **Instagram sender names:** DM threads store the guest’s Instagram username (or name when Meta sends one). Opening a thread that still says **Guest** (legacy webhook rows) refetches the profile from Meta and updates the list.
- **Message body rendering:** plain `body_text` is parsed client-side into rich blocks via shared `ChatRichBody` / `ChatMessageBubble`.
- **Share resources:** the composer's **Insert** menu (`InboxInsertMenu`, `+` icon) inserts plain URLs or payment-method text into the draft — no new message type. Sections: Property (page, calendar, guest form, chat link), Pages (showcase, stay guide, listing preview paths), Location (map link from property settings when set), Payment (formatted payment methods from property settings), **Packs** (Check-in pack — times + stay guide + map + calendar when available), and Booking (search or auto-matched booking → status-gated doc links). Auto-match uses inquiry dates + guest name against this property's recent bookings (`inboxMatchBooking.ts`). Every inserted https link renders as a typed tap card via `urlLinkCardMeta()` / `ChatUrlLinkCard` (calendar, stay guide, form, document, etc.).
- **Quick reply merge fields:** templates may include `{{guest_name}}`, `{{property_name}}`, `{{check_in_date}}`, `{{check_out_date}}`, `{{inquiry_dates}}`, plus link tokens (`{{calendar_link}}`, `{{property_link}}`, `{{form_link}}`, `{{messages_link}}`, `{{showcase_link}}`, `{{map_link}}`, `{{stay_guide_link}}`). Resolved on insert/send from the open thread + auto-matched booking (`inboxQuickReplyMerge.ts`, `inboxQuickReplyLinks.ts`). The same templates also appear under **Snippets** in the Insert (`+`) menu. The quick-reply form shows a live preview when placeholders or URLs are present.
- **Pinned snippets:** property-scoped saved messages in `properties.settings.inboxPinnedSnippets` (max 5) — managed in **Manage → Quick replies → Pinned snippets**; inserted from **Pinned** in Insert (`+`). Requires `inbox.quickReplies:edit`.
- **Host attachments (web chat):** paperclip in the composer uploads JPEG/PNG/WebP/PDF via `upload-inbox-chat-asset`; outbound send includes `attachments` on `social-inbox-send` (web platform only).
- **Calendar tap-to-modal:** a "Check availability" calendar link card, when tapped in either the host bubble here or the guest's own web chat widget, opens the property's availability calendar in an in-place modal (`BookingCalendarModal`) instead of navigating to a new tab.
- **Approved GAF / Pet share links:** these two PDFs live in private Storage buckets, so their share links use a durable per-booking `document_share_token` (mirrors the Stay Guide token) — a fresh signed Storage URL is minted server-side on every visit, so the link keeps working long after any individual signed URL would expire. Auto-issued the first time a host opens the Share picker on a booking with an approved document. Parking Endorsement is a public bucket URL and needs no token.

## API reference

| Function                             | Notes                                                                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta-inbox-*`                       | OAuth / status / disconnect / backfill — require `property_id`; channel connect uses `inbox.channels:add` (`meta-inbox-oauth-start` / `meta-inbox-oauth-pages` / complete) + `metaChatChannel` on start |
| `meta-inbox-resubscribe`             | Re-verify + repair Page webhook in place (`inbox.channels:add`)                                                                                                                                         |
| `social-inbox-threads`               | Scoped list                                                                                                                                                                                             |
| `social-inbox-messages`              | Messages / mark read / edit / unsend                                                                                                                                                                    |
| `social-inbox-send`                  | Replies; optional `useHumanAgentTag` for 24h–7d Meta DMs                                                                                                                                                |
| `social-inbox-templates`             | Quick reply CRUD (`inbox.quickReplies:*` + `property_id`); POST/PATCH also require `quickReplies` — GET/DELETE stay ungated                                                                             |
| `social-inbox-settings`              | Automation GET/PATCH (`inbox.automation:edit` + `property_id`)                                                                                                                                          |
| `social-inbox-ai-suggest`            | AI draft (`inbox.messages:edit` + `property_id`)                                                                                                                                                        |
| `issue-booking-document-share-token` | Issue/reuse the GAF/Pet share token for a booking (`bookings.detail.workflow:edit` + `property_id`)                                                                                                     |
| `upload-inbox-chat-asset`            | Host web-chat attachment upload (`inbox.messages:edit` + scope)                                                                                                                                         |
| `get-guest-booking-document`         | Public GET — resolves `?token=&doc=gaf\|pet` to a fresh signed URL                                                                                                                                      |

## Implementation map

| Area                         | Path                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                         | `ui/src/features/dashboard/inbox/pages/PropertyInboxPage.tsx`                                                                                                                                                                                                                                                                                       |
| Shell                        | `ui/src/features/dashboard/inbox/pages/InboxPage.tsx`                                                                                                                                                                                                                                                                                               |
| Scope                        | `supabase/functions/_shared/metaInboxScope.ts`, `inboxAccess.ts`                                                                                                                                                                                                                                                                                    |
| Auth                         | `resolveInboxAccess` — property or parking only                                                                                                                                                                                                                                                                                                     |
| Share picker                 | `ui/src/features/dashboard/inbox/components/InboxInsertMenu.tsx`, `InboxPinnedSnippetsPanel.tsx`, `lib/inboxPinnedSnippets.ts`, `lib/inboxBookingShareRows.ts`, `lib/inboxMatchBooking.ts`, `lib/inboxInsertContent.ts`, `lib/inboxCheckInPack.ts`, `lib/inboxQuickReplyMerge.ts`, `lib/inboxQuickReplyLinks.ts`, `hooks/useInboxMatchedBooking.ts` |
| Cross-property switcher      | `ui/src/features/dashboard/inbox/hooks/useInboxCrossPropertyMatch.ts` (org-wide `useBookings` + `inboxMatchBooking.ts`), rendered in `InboxConversationView.tsx` header                                                                                                                                                                             |
| Host chat upload             | `upload-inbox-chat-asset/`, `lib/inboxChatAttachment.ts`                                                                                                                                                                                                                                                                                            |
| Calendar tap-to-modal        | `ui/src/components/chat/ChatUrlLinkCard.tsx` (`onActivate`), `ChatRichBody.tsx` (`onCalendarLinkClick`), `ChatMessageBubble.tsx`                                                                                                                                                                                                                    |
| Rich link card titles        | `ui/src/lib/chat/parseChatRichBlocks.ts#urlLinkCardMeta`                                                                                                                                                                                                                                                                                            |
| GAF/Pet document share token | `supabase/functions/_shared/bookingDocumentShareToken.ts`, `issue-booking-document-share-token/`, `get-guest-booking-document/`                                                                                                                                                                                                                     |
| Admin document share hook    | `ui/src/features/dashboard/bookings/hooks/useBookingDocumentShareLink.ts`                                                                                                                                                                                                                                                                           |
| Guest resolver page          | `ui/src/features/guest/booking-documents/pages/GuestBookingDocumentPage.tsx` — see [[guest-booking-document\|Guest booking document]]                                                                                                                                                                                                               |
| Migration                    | `supabase/migrations/20261102130000_booking_document_share_token.sql`                                                                                                                                                                                                                                                                               |

## Testing

| Layer | Path / spec                                                                                                                                                                   | Manual                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Unit  | `supabase/functions/_shared/inboxAiSafetyGuard_test.ts`                                                                                                                       | —                     |
| E2E   | `ui/e2e/features/inbox/inboxThreadListSmoke.spec.ts` (`@ci`) — "open Facebook thread shows org Meta badge", "cross-property match suggests switching to the matched property" | Meta OAuth, live send |
| N/A   | —                                                                                                                                                                             | Meta connect manual   |

## Related

- [Parking Inbox](../parking/inbox.md)
- Legacy org inbox URL redirects to Properties
