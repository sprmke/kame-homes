---
title: 'Guest trip page (one booking) — operator guide'
status: active
tags: [guides, routes, guest, booking]
updated: 2026-10-04
---

# Guest trip page — operator guide

Route: `/properties/:propertySlug/trip?bookingId=<uuid>` (email links add `&access=<token>`)

> **Status:** Documented. Plan: [`guest-trip-hub.md`](../../workflow/in-progress/guest-trip-hub.md)

## Progress overview

| Section             | E2E save | Validation | Docs       | Notes                                            |
| ------------------- | -------- | ---------- | ---------- | ------------------------------------------------ |
| Access gate         | —        | —          | Documented | Token or signed-in owner; never bare booking id  |
| Hero + progress     | —        | —          | Documented | Status, timing, 5-step progress, next action     |
| Stay / docs / pay   | —        | —          | Documented | Read-only                                        |
| Host / cancellation | —        | —          | Documented | Contact + listing cancellation policy            |
| Entry points        | —        | —          | Documented | Success page, Trips tab, emails, SD form, review |

---

## Overview

One page per **property** booking that pulls together everything a guest needs after they book:
status and progress, the next thing to do, stay details, check-in documents, parking, payment and
deposit refund, the host's contact details, the stay guide, the cancellation policy, review and
voucher, and help. It replaces hunting through separate emails for each link.

It renders inside the property operational shell (`MainLayout`, Property / Calendar / Messages
bottom tabs on phone) like `/success`, `/sd-form` and `/guest-review`.

---

## Host-facing knowledge

After booking, your guest gets one page for their trip. It shows where the booking is (requested,
confirmed, ready, checked out, done), the next step for them, their stay details, approved
documents, what they've paid and still owe, your contact details and the cancellation policy from
your listing. When the booking is ready for check-in, the stay guide button appears there too.

**Common host questions**

- Q: How does the guest get to it?
  A: The "View your booking" button on the confirmation screen and in the booking
  acknowledgement email, the **Trips** tab in their account, and back links on the deposit refund
  and review pages. You can also add `{{trip_url}}` to the acknowledgement, ready-for-check-in or
  deposit refund email templates.
- Q: Can anyone with the link see the booking?
  A: No. Email links carry a private access key. Without it, the guest has to sign in with the
  email they booked with.
- Q: Can a guest cancel from this page?
  A: No. It shows your cancellation policy and sends cancel or date-change requests to your inbox
  as a chat message. You still cancel from the booking in your dashboard.
- Q: Why doesn't my guest see the stay guide button?
  A: It only shows from ready-for-check-in during the stay window, and only on Pro or above (same
  rule as the stay guide link itself).

---

## Access

| Caller                                        | Result                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `?access=` HMAC token for this booking        | Allowed (no session needed)                                             |
| Signed-in guest, `guest_user_id` matches      | Allowed; response includes a fresh `accessToken` for SD / review / edit |
| Signed-in guest, booking unlinked, same email | Allowed; booking is linked to the guest (`guest_user_id`)               |
| Signed-in guest, someone else's booking       | 404 (same body as missing)                                              |
| No token, no session                          | 401 `sign_in_required` → page shows **Sign in** (resumes back here)     |
| Parking-only booking / no property            | 404                                                                     |

Unlike legacy readers (`get-form`, `get-sd-form`), a bare booking id is **never** enough here,
even while `GUEST_BOOKING_ACCESS_ENFORCE` is off.

`?access=` is moved into `sessionStorage` (`guest-booking-access:<bookingId>`, shared with the
form / SD form / review pages) and removed from the URL on load.

---

## Page behavior

One scroll, ordered by what the guest needs today (2026-10-05 redesign after an Impeccable
critique). Phone: everything stacks. Desktop (`lg+`, route widens the shell to `max-w-5xl`):
left column is sticky (header, Now card, shortcuts), right column holds the sections. No tabs:
money or documents due must never sit behind one. The bottom tab bar highlights nothing on
this route (it isn't one of the tabs).

All state comes from one model in `guestTripPhase.ts`, so the pill, progress bar, headline,
checklist and main button never disagree.

### Phase

`guestTripPhase(status, Manila timing)`: `requested` (pending review) · `confirmed` (documents
stage) · `arriving` · `arrival_day` (check-in day, including night 1) · `staying` ·
`checkout_day` · `checked_out` · `refund_pending` · `completed` · `cancelled`.

### Header

Thumbnail, property name (`h1`, not a link), date range and nights, city.

### Now card (the one filled block)

| Part        | Content                                                                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pill        | Phase word with a colored dot (label stays in the foreground color so light host brand colors keep contrast)                                                                                                                                                  |
| Headline    | Phase sentence: "Your host is reviewing your booking", "Check-in in 6 days", "Check in from 2:00 PM", "Night 2 of 3", "Check out by 11:00 AM", "Get your deposit back", "Thanks for staying", "Cancelled on Sep 10"                                           |
| Progress    | 5 segments (Requested · Confirmed · Check-in · Stay · Check-out) + "Step N of 5" caption; fills once on load, static under reduced motion; hidden when cancelled                                                                                              |
| Checklist   | Active phases only, max 3: payment (left to pay / paid in full), check-in documents (hidden once in the unit), parking; each row jumps to its section                                                                                                         |
| Main button | Blockers first: refund form → **Pay ₱X** (scrolls to Payment) → review → Book again (completed); arrival day → stay guide or directions; in stay → stay guide; before arrival → find parking; else **Message host** (always for pending review and cancelled) |
| Voucher     | After the stay: next-stay voucher with copy                                                                                                                                                                                                                   |

### Shortcuts (max 4, phase-picked, never repeat the main button)

Pending: Edit booking, Call host, View listing. Confirmed / arriving: Add to calendar (`.ics`),
Directions, Message host, Call host. Arrival day / staying / check-out day: Stay guide,
Directions, Message host, Call host. After the stay and cancelled: none (host row and main
button cover it).

### Sections (flat, hairline separated; no nested cards)

| Section                                     | Shown when                               | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Payment (`#trip-payment`)                   | rates confirmed and any amount or refund | Before / during the stay: big "₱X left to pay" or "Paid in full". Ledger: Stay (or "Paid through Airbnb"), pet fee, extra fees, security deposit with status (Refundable after check-out / Send your refund details / Refund in progress / Refunded ₱X / Settled), Paid so far. **How to pay** (methods, copy number, QR) + "send your receipt to your host", or "Ask your host how to pay" with no methods. Cancelled: only what was paid |
| Getting there / Your stay (`#trip-arrival`) | pending review and active phases         | Address + Directions; check-in / check-out tiles; stay guide row; documents ("Guest access form (GAF)", "Pet approval", "Parking endorsement"; hidden while pending review; after check-out only approved); parking row; house rules (from the listing, check-in/out time rules removed, first 4 + All rules; hidden while pending review)                                                                                                 |
| Your host                                   | always                                   | Avatar, name, icon buttons: message, call, email                                                                                                                                                                                                                                                                                                                                                                                           |
| Booking details                             | always, collapsed                        | Reference with copy (label includes the reference), guests, names, pet, email, phone, requests, Edit booking (pending review), cancellation policy + "message your host" (pending / confirmed / arriving), View listing                                                                                                                                                                                                                    |
| Footer                                      | always                                   | All trips, Get help                                                                                                                                                                                                                                                                                                                                                                                                                        |

### States

- Missing `bookingId` → "Booking not found" + Your trips.
- 401 → "Sign in to see your trip" → `requireGuestAuth` with resume to this URL.
- 404 → "Booking not found".
- Other errors → "Something went wrong" + Try again.

---

## Entry points

| From                          | How                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `/properties/:slug/success`   | **View your booking** button (token stored at submit)                                    |
| `/account/trips`              | Each row                                                                                 |
| Booking acknowledgement email | **View your booking** button inside `{{booking_acknowledgement_flow_section}}`           |
| Any guest email template      | `{{trip_url}}` (tokenized) on acknowledgement, ready-for-check-in, SD refund             |
| `/sd-form`, `/guest-review`   | **Your trip** back link; SD form done screen **View your booking**                       |
| Guest chat (property + Stays) | **Your trip** card first in the Helpful links strip (`tripPath` from chat start/resume)  |
| Host booking detail `⋯` menu  | **Open guest trip page** / **Copy guest trip link** (`issue-guest-trip-link`, tokenized) |
| Pasted trip link in any chat  | Renders as a **Your trip** link card (`urlLinkCardMeta` kind `trip`)                     |

---

## API reference

| Action          | Endpoint                                                              |
| --------------- | --------------------------------------------------------------------- |
| Trip payload    | `GET get-guest-trip?bookingId=&access=&property=` (anon or guest JWT) |
| Host share link | `POST issue-guest-trip-link { bookingId }` (`bookings:view`)          |
| Payment methods | `GET get-guest-payment-info?property=<slug>`                          |
| Listing details | `GET get-public-property?property=<slug>`                             |

`get-guest-trip` is rate limited (30/min) and never cached by the service worker. The page sets
`noindex`; robots.txt disallows `/*/trip?`. activity-log: N/A, read-only (only writes are the
idempotent document share token / stay guide token self-heal and owner linking).

---

## Implementation map

| Concern      | Path                                                                                                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page         | `ui/src/features/guest/trip/pages/GuestTripPage.tsx`                                                                                                                                                             |
| Components   | `ui/src/features/guest/trip/components/*` (`GuestTripStayHeader`, `GuestTripNowCard`, `GuestTripShortcuts`, `GuestTripPaymentSection`, `GuestTripArrivalSection`, `GuestTripHostRow`, `GuestTripDetailsSection`) |
| Status logic | `ui/src/features/guest/trip/lib/guestTripPhase.ts` (+ `.test.ts`)                                                                                                                                                |
| API client   | `ui/src/features/guest/trip/lib/guestTripApi.ts`                                                                                                                                                                 |
| Route        | `ui/src/features/guest/property/routes/index.tsx`                                                                                                                                                                |
| Path helper  | `guestTripPath` in `ui/src/features/guest/lib/guestPublicPaths.ts`                                                                                                                                               |
| Edge         | `supabase/functions/get-guest-trip/index.ts`                                                                                                                                                                     |
| Payload      | `supabase/functions/_shared/guestTrip.ts`                                                                                                                                                                        |
| Access rules | `supabase/functions/_shared/guestTripAccess.ts` (+ `_test.ts`)                                                                                                                                                   |
| Email link   | `guestTripPath` in `_shared/publicGuestPaths.ts`, `guestBookingEmailLinks.ts`, `buildGuestTripCtaHtml`                                                                                                           |

---

## Testing

| Layer | Path / spec                                                                                                                                                                                                                   | Manual                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Unit  | `guestTripPhase.test.ts` (phase, progress, headline, next action, checklist), `guestTripCalendar.test.ts`, `guestTripLinks.test.ts`, `guestTripAccess_test.ts`, `bookingDetailActions.test.ts`, `parseChatRichBlocks.test.ts` | —                                        |
| E2E   | N/A yet                                                                                                                                                                                                                       | Open from success page, email, Trips tab |

---

## Related docs

- [Route index](./README.md)
- [Booking success](./success.md)
- [Guest Trips tab](./account/trips.md)
- [SD form / guest review](./sd-form.md)
- [Stay guide](./stay-guide.md)
- [Guest booking document](./guest-booking-document.md)

---

## Pending / follow-ups

- [x] Host booking detail: Open / Copy guest trip link.
- [x] Chat resource hub: Your trip card.
- [ ] Host Inbox share menu (Insert → booking links): add the trip link.
- [ ] Guest balance receipt upload on the trip page (today: send it in chat).
- [ ] Playwright mocked E2E for the access states.
