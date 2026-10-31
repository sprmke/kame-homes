---
title: 'Guest Inbox — share property/booking links & files from chat'
status: active
tags: [workflow, planned, inbox]
updated: 2026-08-22
stage: done
kind: plan
---

# Guest Inbox — share property/booking links & files from chat

> **Shipped 2026-08-22.** All three phases below built as specced, plus one addition beyond this plan's original design: the "Check availability" calendar tap card now opens `BookingCalendarModal` in place (both the guest web chat widget and the host's own bubble in the dashboard Inbox) instead of navigating to a new tab. See `ui/src/components/chat/ChatUrlLinkCard.tsx` (`onActivate`), `ChatRichBody.tsx` (`onCalendarLinkClick`), `ChatMessageBubble.tsx`, `GuestChatThread.tsx`, `InboxConversationView.tsx`.

## Context

`docs/workflow/intake/_to-plan.md` (🔵 → 📋, this plan) asks for a new icon in the Inbox chat composer, beside **Quick reply** and **Suggest**, that lets a host quickly share property/booking resources with the guest they're chatting with — the note's examples are **Files** (Approved GAF, Approved Pet, Parking Endorsement) and **Links** (Stay Guide, Property, Calendar, Messages). The user also asked to look for other useful host→guest resources worth including in the same picker.

This is a **new feature** — no prior plan or partial implementation exists. It is distinct from `docs/workflow/planned/ai-assistant-universal-context-pickers.md`, which generalizes the AI assistant's _own_ context-attachment picker (what the model reads); this plan is about what a **host manually sends a guest** through the existing Guest Inbox chat thread.

Two research passes this session (Explore agent + direct reads) established the real shape of the work:

- **The composer is text-only today.** `InboxConversationView.tsx`'s `onSend(text, opts)` and the `social-inbox-send` edge function only take a `text` body for Meta (Facebook/Instagram) sends — `attachments` is hardcoded to `[]` on every Meta insert. Web conversations technically accept an `attachments` array server-side, but `parseGuestWebChatAttachments` hard-restricts it to URLs already living in the `guest-chat-attachments` bucket, so it can't carry booking documents from other buckets today.
- **Plain URLs already render as rich cards — no attachment plumbing needed for links.** `ui/src/lib/chat/parseChatRichBlocks.ts` auto-detects any `https://` URL in `body_text` and turns it into a tap card (`ChatUrlLinkCard.tsx`) via `urlLinkCardMeta()`, which already special-cases `/calendar` and `/properties/:slug`. This means the simplest, most robust way to "send a link or file" — and the one that works identically across Web, Facebook, and Instagram — is to **insert the URL as plain text into the draft**, not build a new message/attachment type.
- **Most of the guest-facing URLs already have builders.** `ui/src/features/guest/lib/guestPublicPaths.ts` has `guestPropertyPath`, `guestCalendarPath`, `guestMessagesPath` (the guest's own entry point into this same conversation), `guestStayGuidePath`, `guestSdFormPath`, `guestReviewPath`, `guestPayParkingPath`. `useBookingStayGuideLink.ts` is a directly-reusable hook: given a `BookingRow`, it auto-issues the `stay_guide_token` and returns a ready share URL.
- **Conversations don't carry a `booking_id`.** `InboxConversation` only has `property_id`/`guest_user_id`/`participant_name` — no link to a specific `guest_submissions` row. Booking-scoped items (Stay Guide, GAF, Pet, Parking Endorsement) need a booking-picker step, for which `ChatComposerBookingPicker.tsx` (AI assistant feature) is a directly-adaptable reference: `Popover` + search input + month-grouped list over `useBookings`.
- **Approved GAF / Approved Pet PDFs are the one hard case.** They live in **private** Storage buckets (`approved-gafs`, `approved-pet-forms`). The only existing resolver, `get-booking-asset-url`, is admin-JWT-gated and mints a 30-minute signed URL — unusable for a link pasted into a chat message a guest may open hours or days later. `parking_endorsement_url` (public bucket) has no such problem and can be shared as a raw link today.

**Scope decisions locked in with the user before this plan was written:**

1. Build a **durable, guest-safe share link** for the two private documents (GAF, Pet), mirroring the existing `stay_guide_token` pattern — a new opaque `document_share_token` on `guest_submissions`, a new admin issuance endpoint, and a new public resolver that mints a fresh signed URL server-side on each visit. This is the "do it right" option already precedented in this codebase, not a stopgap.
2. **Property Inbox only** in this phase (matches every example in the intake note: GAF/Pet/Stay Guide are property-booking concepts). Parking Inbox — which has its own booking type and only a Parking Endorsement equivalent — is an explicit non-goal for later.

## What already exists to reuse (don't rebuild)

| Need                                                 | Reuse                                                                                                                                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Property/calendar/messages URLs                      | `ui/src/features/guest/lib/guestPublicPaths.ts` — `guestPropertyPath`, `guestCalendarPath`, `guestMessagesPath`, `guestSdFormPath`, `guestReviewPath`, `guestPayParkingPath`                                                         |
| Stay Guide link (token issuance + eligibility)       | `ui/src/features/dashboard/bookings/hooks/useBookingStayGuideLink.ts` — call as-is with a `BookingRow`                                                                                                                               |
| Booking-picker UX pattern                            | `ui/src/features/dashboard/ai-assistant/components/ChatComposerBookingPicker.tsx` — `Popover` + search + month-grouped `useBookings` list; adapt, don't cross-import (keeps inbox/ai-assistant module boundaries clean)              |
| Booking document enumeration (server-side reference) | `supabase/functions/_shared/dashboardAssistantBookingDocuments.ts#collectAssistantBookingDocuments` — same label conventions (`Approved GAF`, `Approved pet form`, `Parking endorsement`) also used in `DocumentsPanel.tsx`          |
| Token-gated durable guest link (pattern to mirror)   | `supabase/functions/_shared/guestStayGuide.ts` (`issueGuestStayGuideAccess`, `loadGuestStayGuideByToken`), `issue-guest-stay-guide-token/index.ts`, `get-guest-stay-guide/index.ts`                                                  |
| Rich link card rendering                             | `ui/src/lib/chat/parseChatRichBlocks.ts#urlLinkCardMeta` + `ChatUrlLinkCard.tsx` — any `https://` URL in a sent message auto-renders as a tap card, for host and guest alike, zero send-path changes                                 |
| Composer toolbar slot                                | `ui/src/features/dashboard/inbox/components/InboxConversationView.tsx:654-714` — existing Quick Reply (`Zap`, `DropdownMenu`) and Suggest (`Sparkles`, `Button`) icons in `<div className="flex min-w-0 flex-1 items-center gap-1">` |

## Design

### 1. New composer icon → `InboxShareResourcesPicker`

New component `ui/src/features/dashboard/inbox/components/InboxShareResourcesPicker.tsx`, wired into `InboxConversationView.tsx` right after the Suggest button (~line 712), same `size-10` ghost icon button + `Tooltip` pattern. Icon: `Share2` (lucide), `aria-label="Share property or booking info"`, tooltip "Share".

Popover content (mirrors `ChatComposerBookingPicker`'s shell: `Popover`/`PopoverContent align="start" side="top"`, `w-[min(calc(100vw-2rem),24rem)]`, `container={overlayContainer}`, wheel/pointer stopPropagation for mobile sheets):

- **Property section** (always shown, no booking needed — built straight from `conversation.property_slug`, already on `InboxConversation`):
  - Property page → `guestPropertyPath(slug)`
  - Calendar → `guestCalendarPath(slug)`
  - Chat with host → `guestMessagesPath(slug)` (the guest's own entry into this same conversation — useful to hand a social-platform guest a link into the website chat)
- **Booking section**: a compact inline booking search (same `useBookings({ scope: 'property' })` + `bookingSearchHaystack`/month-grouping approach as `ChatComposerBookingPicker`, scoped to this conversation's property; default sort recent/soonest, no special auto-match needed for v1 — host searches by guest name/date same as the AI assistant picker already requires). Once a booking is picked (kept in local component state, reset when the conversation changes), show only the rows that apply to that booking:
  - **Stay Guide** — only when `isStayGuideEligibleStatus(booking.status)`; URL from `useBookingStayGuideLink(booking)`
  - **Approved GAF** — only when `booking.approved_gaf_pdf_url` is set; URL from new `useBookingDocumentShareLink(booking, 'gaf')` (§2)
  - **Approved Pet form** — only when `booking.approved_pet_pdf_url` is set; URL from `useBookingDocumentShareLink(booking, 'pet')`
  - **Parking endorsement** — only when `booking.parking_endorsement_url` is set; raw URL, no token needed (public bucket)
  - **Pay parking** — only when `booking.need_parking` and not yet paid; `guestPayParkingPath(slug, booking.id)`
  - **Security deposit refund form** — only when status is `READY_FOR_CHECKOUT`+; `guestSdFormPath(slug, booking.id)`
  - **Leave a review** — only when status is `COMPLETED`; `guestReviewPath(slug, booking.id)`

Selecting a row appends `\n{url}` to the existing `draft` (not a replace, unlike Quick Reply — a host may have already typed a message around the link) and closes the popover. Rows whose URL requires an async mint (Stay Guide, GAF, Pet) show an inline spinner and disable while pending, matching `useBookingStayGuideLink`'s existing `pending` flag.

### 2. Durable share links for private booking documents

New, minimal, mirrors the Stay Guide token mechanism exactly:

- **Migration** `supabase/migrations/<ts>_booking_document_share_token.sql`: `guest_submissions.document_share_token TEXT NULL` + unique index. One token per booking unlocks both GAF and Pet docs for that booking (a `doc` query param picks which); no expiry/eligibility window (unlike Stay Guide's check-in-day gate — GAF/Pet approval proof is useful any time after approval, not stay-dated), just "booking not `CANCELLED`" + "the requested doc's URL column is non-empty."
- **Shared helper** `supabase/functions/_shared/bookingDocumentShareToken.ts` (new, sibling to `guestStayGuide.ts`): `ensureBookingDocumentShareToken(booking)` (issue-if-missing, same shape as `ensureGuestStayGuideToken`), `resolveBookingDocumentByToken(token, doc, propertySlug)` → `{ url, label } | null` (loads booking by token, validates doc column present, mints a fresh Supabase Storage signed URL server-side, short TTL is fine since it's minted per-request not stored).
- **Admin issuance endpoint** `supabase/functions/issue-booking-document-share-token/index.ts` — mirrors `issue-guest-stay-guide-token/index.ts` exactly: `resolveScopedPropertyAccess(req, 'bookings:workflow')` (or `inbox:reply`, whichever the reviewed permission model prefers), `verifyBookingBelongsToProperty`, calls `ensureBookingDocumentShareToken`, returns `{ documentShareToken }`.
- **Public resolver** `supabase/functions/get-guest-booking-document/index.ts` — mirrors `get-guest-stay-guide/index.ts`: `GET ?token=&doc=gaf|pet&property=<slug>`, calls `resolveBookingDocumentByToken`, returns `{ url, label }` JSON or the same "not available" 404 shape on miss.
- **New guest page** `ui/src/features/guest/booking-documents/pages/GuestBookingDocumentPage.tsx` at route `/properties/:propertySlug/document?token=&doc=` — on mount, fetches `get-guest-booking-document`, then `window.location.replace(url)`; shows the same generic "This link is not available" message as Stay Guide on failure (no leak of booking existence). Keeps the link on the app's own domain instead of exposing a raw Supabase functions URL to guests, consistent with every other guest-facing share link in this codebase.
- **New path builder** in `guestPublicPaths.ts`: `guestBookingDocumentPath(propertySlug, token, doc: 'gaf' | 'pet')`.
- **New admin hook** `useBookingDocumentShareLink(booking: BookingRow | null | undefined, doc: 'gaf' | 'pet')` in `ui/src/features/dashboard/bookings/hooks/` — mirrors `useBookingStayGuideLink.ts`: auto-issues the token via a new `useIssueBookingDocumentShareToken` mutation (same call shape as `useIssueGuestStayGuideToken` in `useTransitionBooking.ts`), returns `{ url, pending }`.

### 3. Rich link card titles

Extend `urlLinkCardMeta()` in `ui/src/lib/chat/parseChatRichBlocks.ts` with a few more path matchers so the new link types render with a proper title instead of falling back to `{title: host, subtitle: 'Open link'}`:

- `/stay-guide` → "Stay Guide"
- `/document` with `?doc=gaf` / `?doc=pet` → "Approved GAF" / "Approved Pet Form" (read the query param, same as the function already reads `u.searchParams`)
- `/messages` → "Chat with host"
- `/sd-form` → "Security Deposit Refund"
- `/guest-review` → "Leave a Review"
- `/parking/` (pay-parking path shape) → "Pay Parking"
- Parking endorsement's raw public Storage URL (`/storage/v1/object/public/parking-endorsements/`) → "Parking Endorsement"

Pure additive `if` branches in the existing function — no signature change, no new block type.

## Phase breakdown

### Phase 1 — Durable document share links (backend)

- [x] Migration: `document_share_token` column + unique index on `guest_submissions`
- [x] `_shared/bookingDocumentShareToken.ts` — `ensureBookingDocumentShareToken`, `resolveBookingDocumentByToken`
- [x] `issue-booking-document-share-token` edge function
- [x] `get-guest-booking-document` edge function
- [x] `guestBookingDocumentPath` in `guestPublicPaths.ts`
- [x] `GuestBookingDocumentPage.tsx` + route registration (wherever guest property routes are declared — same place `stay-guide` is registered)
- **Docs (same change)**: `docs/architecture/data-model.md` gets a short paragraph for `document_share_token`, alongside the existing `document_requirement_completions` note

### Phase 2 — Admin hook + rich-link polish

- [x] `useIssueBookingDocumentShareToken` mutation (co-locate with `useIssueGuestStayGuideToken` in `useTransitionBooking.ts`)
- [x] `useBookingDocumentShareLink(booking, doc)` hook, mirroring `useBookingStayGuideLink.ts`
- [x] Extend `urlLinkCardMeta()` with the new path matchers (§3)

### Phase 3 — Composer UI

- [x] `InboxShareResourcesPicker.tsx` — Property section (static, from `conversation.property_slug`) + Booking section (inline booking search adapted from `ChatComposerBookingPicker`, then conditional item rows per §1)
- [x] Wire the new `Share2` icon button into `InboxConversationView.tsx`'s composer toolbar, alongside Quick Reply/Suggest
- [x] Insert-on-select behavior: append `\n{url}` to `draft`, close popover, spinner state for async (Stay Guide/GAF/Pet) rows
- **Docs (same change)**: `docs/guides/routes/org/property/inbox.md` — new **Behavior** bullet for the share icon; new **API reference** rows for `issue-booking-document-share-token` / `get-guest-booking-document`; a **Host-facing knowledge** Q&A entry ("How do I send my guest their approved GAF or a link to the calendar?"); `.agent/skills/social-inbox/SKILL.md` architecture-map table gets the two new edge functions + the new component (mirror into `.cursor/skills/` and `.claude/skills/` per the repo's AI-tooling sync)
- **New guide**: `docs/guides/routes/guest-booking-document.md` (mirrors `docs/guides/routes/stay-guide.md`'s structure) for the new guest-facing route

## Non-goals

- No new message/attachment type, no change to `social-inbox-send`'s payload shape, no extension of `parseGuestWebChatAttachments`'s bucket allowlist — every shared item is a plain URL in `body_text`, rendered client-side.
- No change to Meta (Facebook/Instagram) send capability — links work identically there since they're just text.
- Parking Inbox is out of scope for this phase (per locked decision).
- No admin-curated custom-links list (the Quick Replies `social_reply_templates` pattern) — every item in this picker is either a fixed property URL or computed live from the picked booking's columns, not editable content. Could be revisited later if hosts want to add their own custom shareable links.
- No changes to the Stay Guide's own eligibility window or token mechanism — the new document-share token is a separate, simpler mechanism (no check-in-date gating) living alongside it.

## Verification

1. `bun run type-check && bun run lint && bun run build` after each phase.
2. Manual E2E via `./dev.sh`: open a property's Inbox thread, click the new Share icon, confirm the Property section links insert and render as tap cards on send (both host bubble and, for a `web` conversation, the guest-facing widget). Pick a booking, confirm Stay Guide/GAF/Pet/Parking rows only appear when eligible, confirm GAF/Pet rows show a spinner then insert a `/properties/:slug/document?...` URL.
3. Open the inserted GAF/Pet link in an incognito window (simulating the guest) to confirm `GuestBookingDocumentPage` resolves the token and redirects to a working signed PDF URL, and that it still works after the original 30-minute signed-URL window would have expired (proving the token, not a stale signed URL, was what got shared).
4. Confirm an invalid/tampered token on `/properties/:slug/document` shows the generic "not available" message, not a leak of booking existence (same guard as Stay Guide).
5. Confirm Facebook/Instagram conversations still send correctly (text-only path unaffected) and that a shared link renders as a tap card there too once delivered.

## Phase A follow-up (2026-08-30)

Messaging Phase A extended the original Share picker:

- **`InboxShareResourcesPicker`** → **`InboxInsertMenu`** (`+` icon): unified insert for property links, public pages, map link, payment methods text, and booking-scoped doc links.
- **Auto booking match:** when the open web thread has inquiry dates + guest name, the booking section pre-selects a matching row (`inboxMatchBooking.ts`).
- **Host attachments:** web chat composer paperclip → `upload-inbox-chat-asset` (same bucket/limits as guest upload); Meta UI remains text-only.
- **Guest FAQ chips:** context-aware phases in `guestChatSuggestions.ts` (pre-booking / inquiry / ongoing) — see `docs/guides/routes/properties/chat.md`.

## Phase B follow-up (2026-08-30)

- **Quick reply merge fields:** `{{guest_name}}`, `{{property_name}}`, `{{check_in_date}}`, `{{check_out_date}}`, `{{inquiry_dates}}` — resolved on insert/send via `inboxQuickReplyMerge.ts` + auto-matched booking.
- **Check-in pack:** one-tap bundle in Insert → Packs (check-in/out times, stay guide when eligible, map link, calendar) — `inboxCheckInPack.ts`.
- **Resource card types:** `urlLinkCardMeta()` + `ChatUrlLinkCard` use per-resource icons (stay guide, form, document, showcase, parking, etc.).
- **Guest Insert menu:** `GuestChatInsertMenu` — share dates, calendar, listing link in guest composer.

## Phase C follow-up (2026-08-30)

- **Link merge fields:** quick replies support `{{calendar_link}}`, `{{property_link}}`, `{{form_link}}`, `{{messages_link}}`, `{{showcase_link}}`, `{{map_link}}`, `{{stay_guide_link}}` — resolved with property slug, thread inquiry dates, map URL, and auto-matched booking stay guide (`inboxQuickReplyLinks.ts`).
- **Snippets in Insert menu:** top quick replies appear under **Snippets** in `InboxInsertMenu` (merged on insert; same plan gate as Quick reply).
- **Guest resource hub:** `GuestChatResourceHub` — horizontal self-serve link strip (calendar, listing, guest form, showcase) above the composer when the thread has messages.

## Phase D follow-up (2026-08-30)

- **Guest stay guide deep link:** `guest-web-chat-resume` and `guest-web-chat-start` return `stayGuideUrl` when the signed-in guest has an active stay-guide booking for that property (`resolveGuestStayGuideUrlForProperty` in `guestStayGuide.ts`). The guest resource hub shows **Stay Guide** first when present.
- **Property pinned snippets:** up to 5 saved messages in `properties.settings.inboxPinnedSnippets` — managed under **Manage → Quick replies → Pinned snippets** (property inbox only); inserted from **Pinned** in the host Insert (`+`) menu (`inboxPinnedSnippets.ts`, `InboxPinnedSnippetsPanel.tsx`).
- **Quick reply preview:** the quick-reply form shows a live **Preview** when the body contains merge placeholders or URLs (`InboxQuickReplyFormDialog.tsx`).

## Production hardening (2026-08-31)

- Restored `startGuestWebChat` export after accidental strip; stay-guide resolve issues missing tokens before window check.
- Parking threads no longer pass parking slug as property Insert/resource-hub paths.
- Stricter booking name match (token-based); match window includes COMPLETED + limit 150.
- Empty merge tokens are omitted (not blank); HEIC extensions + client max 4 attachments aligned with server.
- Account **Messages** hub wires `stayGuideUrl` + inquiry dates into `GuestChatThread` (same resource hub / Insert behavior as listing chat).
