---
title: 'Guest messages'
status: active
tags: [guides, routes]
updated: 2026-08-30
---

# Guest messages

Route: `/properties/:propertySlug/messages`

> **Status:** Documented

## Progress overview

| Section      | E2E     | Validation | Docs | Notes                                       |
| ------------ | ------- | ---------- | ---- | ------------------------------------------- |
| Contact host | Partial | Yes        | Yes  | Auth on Contact host; dates in chat modal   |
| Chat thread  | Partial | Yes        | Yes  | Phase 1 bubble UX shipped; see § UX roadmap |
| Empty FAQs   | Yes     | Yes        | Yes  | Phase-aware starter questions (5 shown)     |
| Host inbox   | Partial | Yes        | Yes  | **Web** tab on Guest Inbox                  |

## Overview

Pre-booking messaging between an authenticated guest and the property host. Threads use **`social_conversations`** / **`social_messages`** with **`platform = web`** and appear in the org **Guest Inbox** (**Web** tab).

---

## Host-facing knowledge

Guests message you from a property listing before they book. They start in a chat popup, then can optionally move to a full messages page. You reply from Guest Inbox like other channels.

**Common host questions**

- Q: Do guests need to pick dates before messaging me?
  A: The first time they contact you about a listing, yes. Return visits can open the thread without picking dates again.
- Q: Is messaging the same as confirming a booking?
  A: No, chatting doesn't hold dates or create a reservation. Guests still use Reserve for that.
- Q: Where do I see and answer these messages?
  A: In Guest Inbox under the Web tab, alongside your other guest conversations.
- Q: Can guests talk to the AI receptionist from the listing chat popup?
  A: Yes. When the voice receptionist is enabled for the property, **Talk to receptionist** shows up in the chat ⋮ menu on both the Contact host popup and the full messages page.
- Q: What are the suggested questions guests see before they message me?
  A: When a guest opens chat with no messages yet, they see five starter questions tailored to where they are in the conversation: browsing the listing (pre-booking), asking about specific dates (inquiry), or mid-stay follow-ups once messages exist (ongoing). Examples include check-in times, parking, pets, WiFi, pricing for selected dates, WiFi password, or late checkout — depending on phase. Tapping one sends that question like a normal message. There are no action buttons, only questions. The Stays inbox (existing threads) does not show these starters.

---

## Entry (property detail) — primary

1. **Contact host** on **`ListingHostCard`** → **`GuestAuthModal`** if signed out, then **`ContactHostSheet`** chat modal (`ResponsiveModal`: centered on `lg+`, bottom sheet below `lg` — **2026-09-10:** was previously always a raw centered `Dialog` despite the "Sheet" name; the parking equivalent, `ParkingChatSheet`, had the same bug and got the same fix).
2. **First inquiry:** if no prior messages with this host on this property, **`BookingCalendarModal`** is required before the first send.
3. **Return visit:** existing thread loads via **`guest-web-chat-resume`** — dates optional; chat history shows immediately.
4. Guest composes message → **Send** → thread stays in modal. If the thread is empty, five phase-aware FAQ starter cards appear above the composer (same card UI as the host AI assistant, questions only — no Actions switcher). Phase is **pre_booking** before dates, **inquiry** after dates are set, **ongoing** once any message exists. Tapping a card sends that question. On a first inquiry without dates, tapping a starter fills the message and opens the date picker; after dates are saved the question sends automatically.
5. **Voice receptionist** (when enabled): header ⋮ **Talk to receptionist** — same in-modal **`VoiceSessionPanel`** as the full messages page. Available on first inquiry (dates not required) and return visits. Escape / overlay do not close the chat modal mid-call; hang-up returns to the text thread.

**Reserve** remains separate: dates → **`requireGuestAuth`** when anonymous → **`GuestBookingFormModal`** (`GuestForm` embed) — never chat.

## Full-screen route (return visits)

**Route:** `/properties/:propertySlug/messages?checkInDate=YYYY-MM-DD&checkOutDate=YYYY-MM-DD`

| Guard         | Action                                             |
| ------------- | -------------------------------------------------- |
| Invalid dates | Redirect to property with `?pickDates=contactHost` |
| Not signed in | **`GuestAuthModal`**; resume to messages URL       |
| Signed in     | **`guest-web-chat-start`** + thread UI             |

Use for deep links, **Open full chat**, and future guest Messages hub — not first-time Contact host entry.

## Page behavior (full-screen)

**UI:** Host header, compact inquiry stay strip (`GuestStayContextBar` `density="compact"`), scrollable messages, composer. Shared horizontal gutter (`px-3`) across header, stay strip, thread, and composer. Guest messages align right; host replies align left. Conversation shell uses **`bg-card`** (pure white in light theme — not canvas `--background`) with `sm:rounded-3xl` so bottom corners match the MainLayout surface card. Height fills remaining viewport on mobile; on `md+` a balanced cap (`min(44–52rem, calc(100dvh − chrome))`, `max-w-3xl`).

**Composer:** paperclip for attachments; **Insert** (`+`) for share dates, calendar link, and listing link when inquiry dates are set. When the thread has messages, a horizontal **Helpful links** strip (stay guide when the guest has an active booking, calendar, listing, guest form, showcase) sits above the composer (`GuestChatResourceHub`). FAQ starters remain phase-aware for empty threads (see § Empty thread).

**Empty thread:** when there are no messages yet, the thread shows five FAQ starters from `guestChatSuggestions.ts`, filtered by conversation phase via `resolveGuestChatFaqPhase()` + `pickGuestChatFaqs()`:

| Phase         | When                          | Example prompts                                               |
| ------------- | ----------------------------- | ------------------------------------------------------------- |
| `pre_booking` | No inquiry dates, no messages | How do I book?, amenities, cancellation, GCash                |
| `inquiry`     | Dates set, no messages yet    | Availability for dates, total for stay, early check-in        |
| `ongoing`     | Any message in thread         | WiFi password, parking on arrival, unit access, late checkout |

Same interactive cards as the host assistant (`ChatSuggestionList`); no Questions/Actions toggle. Tapping sends the prompt as the first message. Starters hide as soon as any message exists. `/account/stays` does not show them (`faqSuggestions={false}`).

**Realtime:** Supabase channel on **`social_messages`** (guest RLS).

**Voice receptionist:** when enabled (global + property), the header ⋮ menu shows **Talk to
receptionist** on both **`ContactHostSheet`** (property detail) and this full-screen page. That swaps
the conversation column for an inline **`VoiceSessionPanel`** (same shell: host header stays visible —
no black modal). Gemini Live audio, turtle avatar, live captions, countdown, mute, and end controls
use theme tokens (light/dark). On end, timeout, or error the transcript is batch-written into this
thread as `social_messages` (`source_mode='voice'`); the panel closes and the text thread returns
with those turns already loaded. First-inquiry guests can start a voice session from the contact
modal without picking dates; `guest-web-chat-resume` still returns `voiceReceptionistEnabled` when
there is no existing thread.

**AI grounding (text + voice):** when the property's residence matches a platform development, guest AI tools also receive development-level facts (amenities, pool fee/schedule, requirements, guides, document labels, other info) from **`developments.settings`** via `_shared/developmentGuestInfo.ts`. Super admins edit these on **`/admin/developments/:slug`** (Pool + Guest information sections).

**Phase 6 (shipped):** speech VAD; rich map/list/link bubbles; leaner voice prompts; theme-aware
in-thread voice panel (primary ring + mic waveform); batch Flash polish on hang-up (`thinkingBudget: 0`);
panel shows **Saving conversation…** until the thread refetch settles; spoken money uses
**pesos**; circular turtle avatar (full-body 9:16 HeyGen clip; talk loop **only** while `phase === 'speaking'`, idle still otherwise). Mouth motion is a baked loop — not live phoneme sync.
See [[2026-07-30-ai-voice-receptionist|AI Voice Receptionist — Implementation Plan]] § Phase 6.

## API

| Function                   | Method | Auth      | Notes                                                                                                                                                         |
| -------------------------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `guest-web-chat-resume`    | GET    | Guest JWT | `?property_slug=` — existing thread if messages exist; always returns `voiceReceptionistEnabled` (even when `hasMessages` is false)                           |
| `guest-web-chat-start`     | POST   | Guest JWT | `{ propertySlug, checkInDate, checkOutDate }` — first inquiry; also returns `voiceReceptionistEnabled`                                                        |
| `guest-web-chat-messages`  | GET    | Guest JWT | `?conversation_id=`; `before` cursor; returns `replyStatus` on first page load                                                                                |
| `guest-web-chat-messages`  | POST   | Guest JWT | `{ conversationId, text?, attachments?, replyToMessageId? }`, `{ action: 'mark_read', conversationId }`, or `{ action: 'unsend', conversationId, messageId }` |
| `guest-web-chat-messages`  | PATCH  | Guest JWT | `{ conversationId, messageId, text }` — edit own inbound until host read or reply                                                                             |
| `upload-guest-chat-asset`  | POST   | Guest JWT | Multipart file → **`guest-chat-attachments`** bucket; returns `{ kind, url, label? }` for send payload                                                        |
| `voice-receptionist-start` | POST   | Guest JWT | `{ propertySlug }` → `{ ephemeralToken, sessionId, model, voiceId, maxSessionSeconds }` (Gemini Live)                                                         |
| `voice-receptionist-tool`  | POST   | Guest JWT | `{ sessionId, topic }` — property-fact tool call from the live model                                                                                          |
| `voice-receptionist-end`   | POST   | Guest JWT | `{ sessionId, endReason, transcript }` — ends session; **one** batch Flash polish → `social_messages` (`source_mode='voice'`)                                 |

Host replies use **`social-inbox-send`** (web branch). When the guest is offline, host web replies trigger **`guestChatEmail.ts`** → body from **`guest-chat-reply.html`** wrapped in **`renderBrandedEmailShell`** (same card shell as property template emails; deduped via **`social_messages.guest_reply_email_sent_at`**).

**Realtime typing:** Supabase Broadcast channel **`chat-typing:{conversationId}`** (guest ↔ host; not persisted).

**Attachments:** JPEG/PNG/WebP/PDF up to 10 MB via **`upload-guest-chat-asset`**; stored in **`guest-chat-attachments`**; referenced on send as JSON `{ kind, url, label? }`.

**In-thread search:** Compact search control in the **chat header** (guest) or inbox conversation header (host). Opens a **dedicated search row** below the header (same bar as host inbox) with match counter, up/down navigation, and in-bubble highlights. Header identity stays visible while searching.

## Data model

| Column / key           | Value                               |
| ---------------------- | ----------------------------------- |
| `platform`             | `web`                               |
| `external_thread_id`   | `web:{propertyId}:{guestUserId}`    |
| `property_id`          | Listing UUID                        |
| `guest_user_id`        | `auth.users.id`                     |
| `inquiry_check_in/out` | From inquiry dates at thread create |
| Guest inbound message  | `direction = inbound`               |
| Host outbound message  | `direction = outbound`              |

One thread per guest + property pair.

## UX roadmap

Shared components: `ui/src/components/chat/*`, `ui/src/lib/chat/chatMessageFormat.ts`.

| Phase  | Focus                                                                                                   | Status      |
| ------ | ------------------------------------------------------------------------------------------------------- | ----------- |
| **1**  | Timestamps, date separators, shared bubble, guest optimistic send, sent ✓, AI badge                     | **Shipped** |
| **2**  | Read receipts, mark-read, delivery lifecycle, Realtime UPDATE, guest unread                             | **Shipped** |
| **3**  | Edit until read/reply, “Edited” label; Edit/Unsend hidden in ⋮ when unavailable (no error toast)        | **Shipped** |
| **4**  | Reply-to-message with quote                                                                             | **Shipped** |
| **5**  | Typing, guest attachments, search, offline notify                                                       | **Shipped** |
| **6**  | Awaiting-reply badge when `reply_status=pending`; Chat quick-reply group in inbox composer + management | **Shipped** |
| **7**  | Context-aware FAQ starters by conversation phase (pre-booking / inquiry / ongoing)                      | **Shipped** |
| **8**  | Guest Insert (`+`) menu — share dates, calendar, listing link                                           | **Shipped** |
| **9**  | Guest resource hub — self-serve link strip for ongoing threads                                          | **Shipped** |
| **10** | Stay guide deep link in resource hub when guest has active booking                                      | **Shipped** |

Backlog: [GitHub Issue #110 — Epic 10](https://github.com/sprmke/kame-homes/issues/110) (**Guest ↔ host chat**).

## Implementation map

| Area            | Path                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sheet (primary) | `ui/src/features/guest/chat/components/ContactHostSheet.tsx`                                                                                                                                      |
| Full page       | `ui/src/features/guest/chat/pages/PropertyChatPage.tsx`                                                                                                                                           |
| Thread UI       | `ui/src/features/guest/chat/components/GuestChatThread.tsx`, `GuestChatHeaderBar.tsx`, `GuestChatFaqSuggestions.tsx`, `GuestChatInsertMenu.tsx`, `GuestChatResourceHub.tsx`                       |
| Insert / hub    | `ui/src/features/guest/chat/lib/guestChatInsertItems.ts`, `guestChatResourceHubItems.ts`                                                                                                          |
| Shared bubble   | `ui/src/components/chat/ChatMessageBubble.tsx`, `ChatMessageList.tsx`, `ChatDateSeparator.tsx`, `ChatThreadSearch.tsx`, `ChatHighlightedText.tsx`, `ChatSuggestionList.tsx`                       |
| Format helpers  | `ui/src/lib/chat/chatMessageFormat.ts`, `useChatTyping.ts`, `useChatThreadSearch.ts`, `chatThreadSearch.ts`, `chatAttachments.ts`                                                                 |
| Hooks / API     | `ui/src/features/guest/chat/hooks/useGuestChat.ts`, `lib/guestChatApi.ts`, `lib/guestChatSuggestions.ts`                                                                                          |
| Voice UI        | `VoiceSessionPanel` (inline in conversation column; `VoiceSessionOverlay` is a deprecated alias); `ReceptionistAvatar` circular muted turtle video + idle still; `ReceptionistFacePlate` fallback |
| Voice hooks/API | `ui/src/features/guest/chat/hooks/useVoiceSession.ts`, `lib/voiceReceptionistApi.ts`, `lib/voiceAudioCodec.ts`, `public/worklets/voice-pcm-recorder.js`                                           |
| Voice polish    | `_shared/polishVoiceUtterance.ts` (batch on end); `ChatUrlLinkCard` for https in bubbles                                                                                                          |
| Avatar asset    | `receptionist-turtle-talk.mp4` + `receptionist-turtle-idle.png` + `ATTRIBUTION.md`                                                                                                                |
| Voice edge      | `supabase/functions/voice-receptionist-start/`, `voice-receptionist-tool/`, `voice-receptionist-end/`, `_shared/voiceReceptionistService.ts`                                                      |
| CTA hook        | `ui/src/features/guest/marketing/properties/hooks/usePropertyContactHost.ts`                                                                                                                      |
| OAuth resume    | `ui/src/features/guest/auth/lib/guestAuthResume.ts` — `contact_host_sheet` → property `?contactHost=open` + dates; draft `kame_contact_host_draft` in `sessionStorage`                            |
| Host card       | `ui/src/features/guest/marketing/shared/components/ListingHostCard.tsx`                                                                                                                           |
| Edge            | `supabase/functions/guest-web-chat-resume/`, `guest-web-chat-start/`, `guest-web-chat-messages/`, `upload-guest-chat-asset/` — resume/start return `stayGuideUrl` when eligible                   |
| Lifecycle       | `supabase/functions/_shared/chatMessageLifecycle.ts`, `guestChatAttachments.ts`, `guestChatEmail.ts` — read, edit, reply, attachments, offline notify                                             |
| Auto-reply      | `supabase/functions/_shared/webInboxAutoReply.ts` — when inbox Automation → Send automatically → Chat is on                                                                                       |
| Migration       | `20260719153000_web_guest_chat.sql`, `20260927120000_chat_message_lifecycle.sql`, `20260928120000_chat_phase5.sql`                                                                                |
| Host inbox      | `ui/src/features/dashboard/inbox/**` — **Web** tab                                                                                                                                                |

---

## Testing

| Layer | Path / spec                | Manual                          |
| ----- | -------------------------- | ------------------------------- |
| N/A   | Property-scoped guest chat | Manual + stays hub E2E for list |

## Related

- [properties.md](./properties.md) — property detail + Contact host
- [org/inbox.md](./org/inbox.md) — operator Guest Inbox
- `.cursor/rules/social-inbox.mdc`
