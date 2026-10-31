---
title: 'Guest trip hub (one page per booking)'
status: active
tags: [workflow, guest, booking]
updated: 2026-10-09
stage: in-progress
kind: plan
---

# Guest trip hub

One page per property booking where the guest can see and do everything for that stay, from
submitting the form through check-out and the deposit refund.

Route: **`/properties/:propertySlug/trip?bookingId=<uuid>[&access=<token>]`**

## Problem

After booking, a guest's information is spread across one-off surfaces they can only reach from
specific emails:

| Need                      | Existing surface                                      | How the guest finds it today     |
| ------------------------- | ----------------------------------------------------- | -------------------------------- |
| Booking summary           | `/success` (router state only, lost on refresh)       | Only right after submit          |
| Edit booking details      | `/form?bookingId=` (`PENDING_REVIEW` only)            | Acknowledgement email `form_url` |
| Chat with host            | `/properties/:slug/messages`, `/account/stays`        | Property page, account           |
| Stay guide                | `/stay-guide?token=` (Pro+, stay window only)         | Ready-for-check-in email         |
| Approved GAF / pet PDFs   | `/document?token=&doc=`                               | Host shares manually             |
| Parking                   | Marketplace with `linkStay`, `/parkings/requests/:id` | Acknowledgement email callout    |
| Security deposit refund   | `/sd-form?bookingId=`                                 | Check-out email                  |
| Post-stay review (Airbnb) | `/guest-review?bookingId=`                            | Review email                     |
| Next-stay voucher         | `/account/vouchers`                                   | Account                          |
| Cancellation policy       | Listing page                                          | Listing page                     |

`/account` has no list of bookings (the old `guest-trips` cards were removed; the edge function
was kept).

## Decisions

- **Property-scoped route in the operational shell** (`MainLayout`, Property / Calendar / Messages
  tabs), same pattern as `sd-form` and `guest-review`, so branding and the bottom bar match.
- **Access** — new public `get-guest-trip` endpoint accepts either:
  1. a valid HMAC booking access token (`?access=`; minted on submit and in email links), or
  2. a signed-in guest who owns the booking (`guest_user_id`, or email match which then links it).
     Owners get a fresh `accessToken` back so the downstream SD / review / edit links work.

  A bare booking id is **not** enough here, even while `GUEST_BOOKING_ACCESS_ENFORCE` is off, so
  this page is stricter than the legacy readers. Without access the page asks the guest to sign in.

- **No guest self-cancel.** Refunds depend on host policy and are settled manually; a guest-driven
  `CANCELLED` transition would need booking-workflow changes and a refund flow. The page shows the
  listing's cancellation policy and sends cancel/change requests to the host chat.
- **Property detail comes from `get-public-property`** (address, map, check-in times, house rules,
  cancellation policy, host). The new endpoint returns only booking-scoped data plus host contact.
- **Stay guide link** only when `isStayGuideAccessActive` and the property has `propertyShowcase`.
- **Approved GAF / pet** open through the existing durable document share token
  (`ensureBookingDocumentShareToken` → `/document`).

## Scope

1. `supabase/functions/get-guest-trip` + `_shared/guestTrip.ts` (DTO builder, access check).
2. `ui/src/features/guest/trip/`: page, API client, hook, `guestTripPhase` lib (+ unit tests).
   Sections: status hero + progress, next action, stay details, documents, parking, payment and
   deposit, host / chat, stay guide, cancellation policy, review / voucher, help.
3. Entry points:
   - Success page CTA → trip page.
   - `/account/trips` page (restores the legacy path as a real tab) listing bookings → trip page.
   - Acknowledgement email "View your booking" CTA + `{{trip_url}}` placeholder for every email.
   - Back-to-trip link on SD form, guest review, and stay-guide-adjacent pages where a booking id
     is known.
4. Docs: route guide `docs/guides/routes/trip.md`, `account/trips.md`, success/stays/index guides,
   `docs/PROJECT.md`, `docs/architecture/overview.md`, edge function docs, `config.toml` entry.

## Out of scope

- Guest-initiated cancellation and refunds.
- Parking-only bookings (they have `/parkings/requests/:id`).
- Push notifications for trip changes.

## Plans / permissions / audit

- Plans: trip page is core booking flow, every plan. Stay guide link keeps its `propertyShowcase`
  gate.
- Team RBAC: N/A (guest surface).
- activity-log: N/A — read-only endpoint; the only write is idempotent token issue
  (`document_share_token`, guest link) already done silently elsewhere.

## Review pass (2026-10-05)

Walked the page as a guest across pending review, ready (mid-stay and check-out day), completed
and cancelled bookings at 375px and 1024px. Fixed / added:

- **Balance due ignored recorded payments.** Now `totalBalance − guest_balance_paid_amount`
  (matches the host "Total unpaid"), with Balance paid / Paid in full rows. Balance rows hide
  during pending review (rates not set), after check-out (deposit settles via refund) and when
  cancelled.
- **How to pay**: property payment methods (copy number, QR) while a balance is due, or "Ask
  your host how to pay" when none are set up.
- Post-stay cleanup: pending documents and house rules hidden after check-out.
- **House rules** from the listing (every plan; the stay guide is Pro+).
- **Add to calendar** (.ics), check-in-time banner on arrival day, directions fallback to
  coordinates / address.
- `noindex` + robots `/*/trip?`; `?property=` mismatch now short-circuits before any work.
- Connections: **Your trip** card in the guest chat Helpful links (`tripPath` on chat start /
  resume), trip-link card kind for pasted links, host **Open / Copy guest trip link**
  (`issue-guest-trip-link`).

Open: Inbox Insert menu row, guest receipt upload, Playwright E2E.

## Redesign (2026-10-05, Impeccable critique 22/40 → phase-led layout)

Critique (dual-agent, snapshot in `.impeccable/critique/`) found an equal-weight card stack, a
main button that ignored money, an unreadable ledger, contradictory status signals, and wasted
first screen. Chosen direction: phase-led single scroll (not tabs, not scroll-reveal).

- One phase model drives pill, progress, headline, checklist, main button and shortcuts.
- Now card + checklist + blocker-first main button ("Pay ₱X", refund form, review).
- Flat sections: Payment (charges / paid / left, deposit status), Getting there / Your stay,
  Host row, Booking details (collapsed). Desktop two columns with sticky Now column.
- One authored motion moment (progress fill + checklist), reduced-motion static.
- Contrast: status color only in dots; no brand-colored text. 12px floor. Detector clean.
- Known system-level issue (not changed here): primary buttons use white text on the host's
  brand color (`brandColor.ts` "labels on fills stay white"); light brands like mint fail
  4.5:1. Needs an app-wide readable-foreground decision.
