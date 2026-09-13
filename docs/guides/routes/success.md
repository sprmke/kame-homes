---
title: 'Booking Success — operator guide'
status: active
tags: [guides, routes]
updated: 2026-08-17
---

# Booking Success — operator guide

Route: `/properties/:propertySlug/success?bookingId=` (legacy `/success?property=<slug>&bookingId=` redirects here)

> **Status:** Documented.

## Progress overview

| Section          | E2E save | Validation | Docs       | Notes                                                           |
| ---------------- | -------- | ---------- | ---------- | --------------------------------------------------------------- |
| Booking summary  | —        | —          | Documented | Read-only; from `navigate` state                                |
| Brand header     | ✅       | —          | Documented | `get-guest-payment-info` logo                                   |
| Guard / redirect | ✅       | —          | Documented | Requires `bookingId`                                            |
| Mobile shell     | —        | —          | Documented | `MainLayout` bottom tab bar reappears here (no dominant action) |

---

## Overview

Confirmation page shown immediately after a successful [guest form](./form.md) submission. It never fetches the booking from the server on its own — the summary content comes entirely from React Router `navigate` state passed by `GuestForm` at submit time, so refreshing this page loses the detailed summary (the page itself still renders with the redirect guard intact).

---

## Host-facing knowledge

After a guest submits their booking form, they land on a confirmation screen recapping their stay dates, guest count and names, contact info, and pet info (if any). It also includes a short "what happens next" note telling them to wait for the booking-acknowledgment email and to keep the conversation open on Facebook Messenger or Airbnb for any changes.

**Common host questions**

- Q: A guest says the confirmation page didn't show their booking details after they refreshed it.
  A: That's expected. The summary only shows right after submitting, so refreshing (or opening the link fresh) still confirms the booking was received, just without the detailed recap. The guest doesn't need to resubmit.
- Q: Does this page mean the booking is approved?
  A: No, it only means the request was received and is now awaiting review. Approval and the GAF process happen afterward.

---

## Page behavior

### Fields (booking summary card, when `navigate` state is present)

| Field                          | Source                                                           |
| ------------------------------ | ---------------------------------------------------------------- |
| Nights                         | Computed from check-in/check-out                                 |
| Check-in / check-out date+time | `bookingData.checkInDate/checkOutDate/checkInTime/checkOutTime`  |
| Guests (adults/children)       | `bookingData.numberOfAdults/numberOfChildren`                    |
| Guest names                    | `bookingData.primaryGuestName` + `guest2-5Name`                  |
| Contact                        | `bookingData.guestEmail`, `guestPhoneNumber`                     |
| Pet                            | `bookingData.hasPets` + `petName` (shown only if bringing a pet) |

### Load path

1. `GuestForm.onSubmit` navigates here with `state: { bookingData, guestEnter: 'success' }` and `?bookingId=` in the URL.
2. Page reads `location.state.bookingData` for the summary card; if absent (direct load / refresh), the summary card is simply omitted — the page still renders the brand header and "Next Steps" info box.
3. **Guard:** if `?bookingId=` is missing, redirects to the property's calendar page (or `/properties` if no property scope) — this page requires a booking ID to make sense.
4. Brand logo comes from **`get-guest-payment-info`** (same property-scoped branding as the form).

### Behavior / edge cases

- No server call is made to re-fetch the booking; this is intentionally a lightweight, client-state-only confirmation screen.
- The "Next Steps" copy differs slightly in tone but always tells the guest to watch for the acknowledgment email and to return to Facebook Messenger / Airbnb for policy questions or changes.

---

## API reference

| Action          | Endpoint                     |
| --------------- | ---------------------------- |
| Branding / logo | `GET get-guest-payment-info` |

---

## Implementation map

| Concern        | Path                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Page           | `ui/src/features/guest/form/components/GuestFormSuccess.tsx`                                      |
| Routes (wired) | `ui/src/features/guest/property/routes/index.tsx` (`propertyGuestRoutes`, `legacyGuestRedirects`) |
| Paths          | `ui/src/features/guest/lib/guestPublicPaths.ts`                                                   |

---

## Testing

| Layer | Path / spec                                             | Manual |
| ----- | ------------------------------------------------------- | ------ |
| E2E   | `guestFormSubmit.spec.ts` success path (`@smoke` `@ci`) | —      |

---

## Related docs

- [Route index](./README.md)
- [Guest Form](./form.md)
- [`docs/PROJECT.md`](../PROJECT.md)

---

## Pending / follow-ups

- [ ] `ui/src/features/guest/form/routes/index.tsx` (`guestSuccessRoutes`/`guestFormRoutes`) is an **orphaned** route module — not imported by the app router. The route actually served comes from `ui/src/features/guest/property/routes/index.tsx`.
