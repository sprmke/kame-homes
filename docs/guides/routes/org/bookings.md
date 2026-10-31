---
title: 'Org Bookings List — operator guide'
status: active
tags: [guides, routes, org, booking-workflow]
updated: 2026-08-24
---

# Org Bookings List — operator guide

Route: `/org/:orgSlug/bookings`

> **Status:** Documented

## Progress overview

| Section                       | E2E save | Validation | Docs | Notes                                            |
| ----------------------------- | -------- | ---------- | ---- | ------------------------------------------------ |
| Summary stage cards           | —        | —          | Done | Property + parking rows share stage buckets      |
| Filter bar                    | —        | —          | Done | Includes **Booking type** (property / parking)   |
| Table / card / calendar views | —        | —          | Done | **Listing** column: property or parking name     |
| Kanban view                   | —        | —          | N/A  | Hidden at org level (property list keeps kanban) |

---

## Overview

Paginated list of **property stays** and **parking-slot reservations** across the organization.

Differences from property list:

1. Each row shows **Listing** — property name or parking slot name (no kind badge; use **Booking type** filter to narrow).
2. **More filters → Booking type** narrows to property stays or parking only.
3. Property rows open `/org/:orgSlug/property/:propertySlug/bookings/:bookingId`.
4. Parking rows open `/org/:orgSlug/parking/:parkingSlug/bookings/:bookingId`.
5. No header actions (date picker, new booking, parking shortcuts) — create stays and parking reservations from each property or parking slot’s bookings page.
6. Views: table, card, calendar only (no kanban).

Stay-side `need_parking` on property bookings is unchanged — that is nested stay workflow, not standalone parking reservations.

---

## Host-facing knowledge

This page combines every property stay and every parking-slot reservation across your organization. Each row's **Listing** column shows the property or parking name, and the **Booking type** filter lets you narrow the list to stays only or parking only.

**Common host questions**

- Q: Why is there no kanban here?
  A: Parking reservations use a simple status path (review → active → completed). Kanban remains on each property’s bookings page for the full stay workflow.
- Q: How do I add a parking reservation?
  A: Open the parking slot’s bookings page and use **New booking** — it opens that slot’s booking form in a dialog, right in the dashboard.

---

## API

`GET /functions/v1/list-bookings?org_slug=…` (or `org_id=…`)

- Permission: `org.bookings:view`
- Returns rows where `property_id IN (org properties)` **OR** `parking_id IN (org parkings)`.
- Response includes `booking_kind`, `property_*` and/or `parking_*` meta.
- Optional `?booking_kind=property|parking`, `?property_id=` (property stays only within org).

Parking-scoped list: `?parking_id=…` with parking team `bookings:view`.

Admin create: `POST create-parking-booking?parking_id=…`  
Status changes: `POST transition-parking-booking?parking_id=…` with `{ bookingId, toStatus }`.

---

## UI map

| Piece         | Path                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| Page          | `ui/src/features/dashboard/org/pages/OrgBookingsPage.tsx`                       |
| Shared list   | `ui/src/features/dashboard/bookings/pages/BookingsListPage.tsx` (`scope="org"`) |
| Listing label | `ui/src/features/dashboard/bookings/components/BookingResourceLabel.tsx`        |
| Hook          | `ui/src/features/dashboard/bookings/hooks/useBookings.ts`                       |
| Edge function | `supabase/functions/list-bookings/index.ts`                                     |

---

## Permissions

- Route guard: `RequireOrgPermission` section `bookings` → `org.bookings:view`
- Org-wide `list-bookings`: all-listings admins see every listing; scoped admins (`all_listings = false`) only bookings for assigned properties/parkings
- Parking rows on org list require org-level access; parking-slot mutations use parking team RBAC on detail/create endpoints.

---

## Testing

| Layer | Path / spec                                                           | Manual            |
| ----- | --------------------------------------------------------------------- | ----------------- |
| Unit  | `ui/src/features/dashboard/bookings/lib/workflow.test.ts`             | —                 |
| E2E   | `ui/e2e/features/org/orgHubSmoke.spec.ts` bookings list shell (`@ci`) | —                 |
| E2E   | `ui/e2e/features/bookings/propertyBookingProceed.spec.ts` (`@smoke`)  | Host proceed flow |

---
