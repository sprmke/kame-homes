---
title: 'Guest Trips — operator guide'
status: active
tags: [guides, routes, account]
updated: 2026-10-04
---

# Guest Trips — operator guide

Route: `/account/trips`

> **Status:** Documented.

## Overview

List of the signed-in guest's **property** bookings, grouped **Upcoming** (soonest first),
**Past**, and **Cancelled**. Each row (photo, property, dates, status pill) opens that booking's
[trip page](../trip.md). Nav label **Trips**, between Profile and Stays (Stays is the chat hub).

Bookings with the guest's email but no `guest_user_id` are linked to the account when the list
loads (`linkGuestBookingsByEmail`). Parking marketplace bookings are not listed.

---

## Host-facing knowledge

Guests who sign in see every booking they've made with you (and other hosts) under **Trips**, and
can open each one to check status, documents, payment and your contact details.

**Common host questions**

- Q: My guest says a booking is missing from Trips.
  A: They need to sign in with the same email they used on the booking form.

---

## Load path

1. **`guest-trips`** (GET, guest JWT) → `listGuestTrips`: property bookings only
   (`property_id` set, `parking_id` null), newest check-in first (sorted after normalizing the
   `MM-DD-YYYY` text dates).
2. Grouping by `guestTripListGroup` (Manila today): cancelled → Cancelled; completed or checked out
   past date → Past; checked out awaiting refund stays in Upcoming.

Empty: "No trips yet." + Browse properties.

---

## Implementation map

| Concern | Path                                                                        |
| ------- | --------------------------------------------------------------------------- |
| Page    | `ui/src/features/guest/account/pages/GuestTripsPage.tsx`                    |
| Hook    | `ui/src/features/guest/account/hooks/useGuestTrips.ts`                      |
| API     | `fetchGuestTrips` in `ui/src/features/guest/account/lib/guestAccountApi.ts` |
| Edge    | `supabase/functions/guest-trips/index.ts`                                   |
| Service | `listGuestTrips` in `supabase/functions/_shared/guestProfileService.ts`     |

## Related docs

- [Trip page](../trip.md)
- [Stays (chat hub)](./stays.md)
- [Account index](./index.md)
