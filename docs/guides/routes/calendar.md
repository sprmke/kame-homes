---
title: 'Calendar (booking picker) — operator guide'
status: active
tags: [guides, routes, calendar]
updated: 2026-08-17
---

# Calendar (booking picker) — operator guide

Route: `/properties/:propertySlug/calendar`

> **Status:** Documented — operational guest flow.

## Progress overview

| Section        | E2E save | Validation | Docs       | Notes                                                 |
| -------------- | -------- | ---------- | ---------- | ----------------------------------------------------- |
| Date selection | ✅       | ✅         | Documented | Overlap + past-date rules                             |
| Proceed → form | ✅       | ✅         | Documented | Guest-auth gate, preserves query params               |
| Property scope | ✅       | ✅         | Documented | Slug from URL path segment                            |
| Legacy `/`     | —        | —          | Documented | `/?property=` → property calendar                     |
| Mobile shell   | —        | —          | Documented | `MainLayout` bottom tabs (Property/Calendar/Messages) |

---

## Overview

Operational **check-in / check-out picker** before the guest booking form (`CalendarPage`). Renders inside **`MainLayout`**: org **brand-color band** at the top with **`GuestOperationalHeader`**, overlapping **`GuestFormBrandHeader`**, **`PublicPropertyCalendar`** (shared with the property detail booking modal), then **`GuestStayContextBar`** once both dates are selected (below the grid, above **Proceed**), then the proceed button.

Guests browse and select dates freely without signing in; authentication is only requested when they commit to book.

**Date selection:** **`PublicPropertyCalendar`** — first tap sets check-in, second tap sets check-out. Past dates and overlapping non-cancelled bookings / owner blocks are disabled via **`get-booked-dates`** and **`guestCalendarAvailability.ts`** (same rules as the property detail modal). Selecting a date on/before the current check-in restarts the selection. **Same-day turnover:** when picking check-out, a day that is blocked for new check-ins (another guest arrives that morning) remains selectable as your check-out date.

**Layout:** Calendar route uses a narrower **`MainLayout`** card (**`max-w-xl`**, vs **`max-w-3xl`** on form/success). Calendar, date summary, and proceed button share a centered **`max-w-[33rem]`** column so the grid size stays fixed while the outer card loses excess horizontal whitespace.

**Proceed to Booking Form:** enabled once both dates are picked. Calls **`requireGuestAuth`** first — if the guest doesn't have an active session, `GuestAuthModal` opens (email OTP or Google/Facebook); once authenticated, navigation resumes automatically via the stored `resume` intent. Navigates to **`/properties/:propertySlug/form`** with **`checkInDate`** / **`checkOutDate`** query params, preserving legitimate params (e.g. `source`). Deprecated keys (`dev`, `testing`, submit-form control flags) are stripped on load and on navigate.

**Mobile shell (2026-09-10):** `MainLayout` renders a persistent phone/tablet `BottomTabBar` (Property/Calendar/Messages) via `GuestPublicLayout` — no dominant single action here, so the tab bar stays visible (unlike `/form`, which claims the band with `ContextualActionBar`).

**Share links:** Admin **`guestCalendarPath(slug)`** → **`/properties/<slug>/calendar`**.

**Legacy:** **`/?property=<slug>`** on the marketing landing redirects to **`/properties/<slug>/calendar`**. Old **`/calendar?property=<slug>`** redirects to the same path. **`/properties/:slug/calendar?bookingId=`** redirects to the property's `/form` route (legacy deep link support).

---

## Query params

| Param       | Purpose                           |
| ----------- | --------------------------------- |
| `source`    | e.g. `airbnb` — forwarded to form |
| `bookingId` | Redirects to property form route  |

Property slug is **not** passed as `?property=` on new links — it is the **`:propertySlug`** path segment. Deprecated **`dev`**, **`testing`**, and submit-form flag params are stripped from the URL on load / navigate.

---

## Host-facing knowledge

This is the guest-facing date picker guests see before filling out a booking form. It shows which dates are already taken and blocks anything that overlaps an existing (non-cancelled) stay.

**Common host questions**

- Q: Why does a guest need to sign in just to pick dates?
  A: They don't. Browsing and picking dates is open to everyone; signing in is only required at the very last step, right before they move on to the actual booking form.
- Q: If I cancel a booking, do those dates open back up here right away?
  A: Yes, cancelled bookings no longer block dates on this calendar.
- Q: Can I send a guest directly to this page for a specific property?
  A: Yes, each property has its own calendar link you can share (found next to the property in your dashboard).

---

## API reference

| Action        | Endpoint                         |
| ------------- | -------------------------------- |
| Booked ranges | `GET get-booked-dates?property=` |

---

## Implementation map

| Concern          | Path                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| Page             | `ui/src/features/guest/calendar/pages/CalendarPage.tsx`                          |
| Calendar grid    | `ui/src/features/guest/property/components/PublicPropertyCalendar.tsx`           |
| Availability lib | `ui/src/features/guest/calendar/lib/guestCalendarAvailability.ts`                |
| Booked dates     | `ui/src/features/guest/form/hooks/useGuestBookedDates.ts`                        |
| Shell layout     | `ui/src/layouts/MainLayout.tsx`, `GuestOperationalHeader`, `GuestStayContextBar` |
| Routes           | `ui/src/features/guest/property/routes/index.tsx`                                |
| Guest-auth gate  | `ui/src/features/guest/auth/context/GuestAuthContext.tsx` (`requireGuestAuth`)   |
| Paths            | `ui/src/features/guest/lib/guestPublicPaths.ts`                                  |
| Landing redirect | `ui/src/features/guest/marketing/pages/GuestLandingPage.tsx`                     |

---

## Testing

| Layer | Path / spec                                                                                              | Manual |
| ----- | -------------------------------------------------------------------------------------------------------- | ------ |
| Unit  | `ui/src/features/guest/calendar/lib/guestCalendarAvailability.ts` (add colocated test when rules change) | —      |
| E2E   | `ui/e2e/features/guest-form/guestCalendarSmoke.spec.ts` (`@ci`, mocked `get-booked-dates`)               | —      |

---

## Related docs

- [Guest landing](./index-landing.md)
- [Form](./form.md)
- [Guest & host auth](./auth.md)
- [`docs/architecture/routing.md`](../../architecture/routing.md)
