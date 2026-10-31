---
title: 'Pay Parking — operator guide'
status: active
tags: [guides, routes, parking]
updated: 2026-08-29
---

# Pay Parking — operator guide

Route: `/properties/:propertySlug/parking/:bookingId` (legacy `/bookings/:bookingId/parking` redirects here)

> **Status:** Documented — **redirects into marketplace** (pay-parking → marketplace connect).

## Progress overview

| Section              | E2E save | Validation | Docs       | Notes                                                                                |
| -------------------- | -------- | ---------- | ---------- | ------------------------------------------------------------------------------------ |
| Marketplace redirect | ✅       | —          | Documented | Linked → request status; own-default form when available; else `/parkings?linkStay=` |
| Host Find parking    | ✅       | —          | Documented | Use your parking (+ multi-slot sheet) / Search other parkings / marketplace fallback |
| Legacy vehicle form  | Soft     | —          | Deprecated | No longer the guest/default entry; historical columns retained                       |

---

## Overview

Opening the old **pay parking** URL no longer shows the plate/brand/color form. It **redirects** into the parking marketplace e2e flow:

1. If this property stay already has a linked marketplace parking booking → `/parkings/requests/:parkingBookingId`
2. Else if the property’s org has an **available** own parking for the stay dates → `/parkings/:slug/form?linkStay=…&checkInDate=…&checkOutDate=…`
3. Otherwise → `/parkings?linkStay=<propertyBookingId>` (or `/parkings/in/:city?linkStay=…` when the property city is known)

Guests then use the normal Reserve → registration → pay flow. After sign-in, `linkStay` auto-selects the property stay when linkable. Same-org pinned submits auto-claim to `PENDING_PAYMENT` (no Accept self-notify).

Legacy `/bookings/:bookingId/parking` still resolves `property_slug` and redirects to the scoped URL (then marketplace).

---

## Host-facing knowledge

When a guest needs parking, use **Use your parking** if you list your own slot (or **Find parking** when you don’t). If you have several free slots, pick one in the sheet, then Open or Copy. Share that link so the guest can reserve and pay (or skip pay when complimentary own parking is on). **Search other parkings** opens the public marketplace if your slot is busy or you want another listing. Once they pay (or complimentary confirms), this booking’s Parking tab shows the match and the Progress parking step completes automatically.

**Common host questions**

- Q: Where did the old vehicle form go?
  A: Parking is arranged through Find parking / the marketplace now. Vehicle details are collected when the guest reserves a slot.
- Q: Does Find parking change the booking status?
  A: It marks that the stay needs parking. Matching and payment happen on the parking side; this booking’s parking step completes after a successful linked payment.

---

## Redirect matrix

| Condition                                   | Destination                                           |
| ------------------------------------------- | ----------------------------------------------------- |
| Preview embed (`bookingId=preview` + embed) | `PayParkingEmbedPreview` (static)                     |
| Linked marketplace booking exists           | `/parkings/requests/:id`                              |
| Org-owned parking available for stay dates  | `guestParkingOwnDefaultPath` (pinned form + linkStay) |
| Unlinked / eligible stay                    | `guestParkingFindPath({ bookingId, locationSlug })`   |
| Missing / cancelled / not found             | Error + **Find parking** → `/parkings`                |

Bootstrap: `GET get-pay-parking` (also returns `linked_parking_booking_id`, `city_location_slug`, `owner_default_parking_slug` + stay dates).

The retired `POST submit-pay-parking` endpoint still exists for backward-compatible vehicle-field updates and is now anti-spam gated (Turnstile + honeypot + durable rate limit via `_shared/antiSpam.ts`); it has no live UI caller. See [PROJECT.md → Anti-spam & CAPTCHA](../../PROJECT.md).

---

## Implementation map

| Concern            | Path                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Redirect page      | `ui/src/features/guest/pay-parking/pages/PayParkingPage.tsx`                                           |
| Find URL helper    | `ui/src/features/guest/lib/guestPublicPaths.ts` (`guestParkingFindPath`, `guestParkingOwnDefaultPath`) |
| `linkStay` persist | `ui/src/features/guest/marketing/parkings/lib/parkingLinkStay.ts`                                      |
| Host Find parking  | `BookingDetailPage` + `useEnsureNeedParking` + `useOwnerDefaultParking` + `useBookingParkingShareLink` |
| Owner default API  | `supabase/functions/resolve-owner-default-parking/index.ts`                                            |
| Edge bootstrap     | `supabase/functions/get-pay-parking/index.ts`                                                          |

---

## Testing

| Layer | Path / spec                                                 | Manual           |
| ----- | ----------------------------------------------------------- | ---------------- |
| Unit  | `parkingStatusMachine_test.ts`                              | —                |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) | PayMongo `@live` |

---

## Related docs

- [Route index](../README.md)
- [`parkings.md`](../parkings.md) — `linkStay` behavior
- [`org/property/bookings-detail.md`](../org/property/bookings-detail.md) — Find parking actions
- [`docs/workflow/done/parking-owner-owned-default.md`](../../workflow/done/parking-owner-owned-default.md)
- [`docs/workflow/done/parking-pay-parking-marketplace-connect.md`](../../workflow/done/parking-pay-parking-marketplace-connect.md)
