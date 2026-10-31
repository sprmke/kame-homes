---
stage: done
title: 'Org bookings: property + parking (unified)'
status: done
tags: [planning, planned-modules, booking-workflow]
updated: 2026-08-01
---

# Org bookings: property + parking (unified)

> **Status:** Shipped (2026-07-31)

## Goal

Org `/org/:orgSlug/bookings` lists **property stays** and **parking-slot reservations** in one paginated list. Property `/bookings` stays property-only (kanban kept). Parking `/parking/:slug/bookings` uses the same `list-bookings` API scoped by `parking_id`. Guest public reserve/submit e2e remains a follow-up (Avail parking e2e).

## Shipped scope

- Migration: `guest_submissions.parking_id`, nullable `property_id`, mutual-exclusion CHECK
- `list-bookings` org union + `?parking_id=` + `?booking_kind=property|parking`
- `create-parking-booking`, `transition-parking-booking` (no stay orchestrator)
- Org list: resource column + type badge, booking-type filter, no kanban
- Parking list + detail: `/org/.../parking/.../bookings/:bookingId`
- Admin **Add parking** modal on org + parking pages

## Out of scope (follow-up)

- Public `/parkings/:slug/form` submit e2e
- Parking calendar/sheet/email parity with stay workflow

## Key files

| Area       | Path                                                                   |
| ---------- | ---------------------------------------------------------------------- |
| Migration  | `supabase/migrations/20260731120000_guest_submissions_parking_id.sql`  |
| List API   | `supabase/functions/list-bookings/index.ts`                            |
| Create     | `supabase/functions/create-parking-booking/index.ts`                   |
| Transition | `supabase/functions/transition-parking-booking/index.ts`               |
| Org UI     | `ui/src/features/dashboard/bookings/pages/BookingsListPage.tsx`        |
| Parking UI | `ui/src/features/dashboard/parking/pages/ParkingBookingsPage.tsx`      |
| Detail     | `ui/src/features/dashboard/parking/pages/ParkingBookingDetailPage.tsx` |
