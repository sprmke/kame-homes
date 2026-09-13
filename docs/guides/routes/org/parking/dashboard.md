---
title: 'Parking dashboard — operator guide'
status: active
tags: [guides, routes, org, parking]
updated: 2026-08-17
---

# Parking dashboard — operator guide

Route: `/org/:orgSlug/parking/:parkingSlug`

> **Status:** Documented

## Overview

Parking-scoped home. **UI mirrors** the property dashboard (`DashboardPage`): on **phone/tablet** the shared **brand hero** shell (`AdminMobilePage`) with date range in an overlapping toolbar and **View Parking** as a hero icon; desktop keeps the compact header + date filter + View Parking. KPI stat cards, finance chart + transactions-due card + mini calendar (same short fixed-height occupancy overlay as property). Metrics load live via **`dashboard-stats?parking_id=`** for this slot (bookings scoped to `guest_submissions.parking_id`).

---

## Host-facing knowledge

This dashboard is the home screen for one parking slot. It's the same layout you know from property dashboards, just labeled for reservations instead of stays. You can filter by date range, open the public parking listing, and see revenue, occupancy, and reservation KPIs for this slot.

**Common host questions**

- Q: Why are some KPI cards zero?
  A: Numbers reflect bookings linked to this parking slot in the selected date range. New slots or quiet periods may show zeros until reservations exist.
- Q: How is this different from the property dashboard?
  A: It covers a single **parking slot** (tower bay, motorcycle space, etc.), not a rental unit. Labels say “reservations” instead of “bookings.”
- Q: Where do I edit rates or slot details?
  A: Use **Pricing** for nightly rates and the calendar, and **Settings** for photos, location, and payment methods. This dashboard is for at-a-glance monitoring.

---

## Sections

| Section          | Property equivalent                                        | Parking notes                                                                                                                     |
| ---------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Header           | Dashboard title + date filter + View Property              | Title **Dashboard**; subtitle includes slot display name; **View Parking** opens public detail `/parkings/:parkingSlug` (new tab) |
| KPI cards        | Total Revenue, Total Bookings, Occupancy, Avg Nightly Rate | **Total Reservations** label instead of Total Bookings. Icon wells muted (same as property dashboard).                            |
| Chart + calendar | `DashboardFinanceCalendarSection`                          | `ParkingDashboardCalendarSection` — live booking calendar when data exists                                                        |

---

## Implementation map

| Concern        | Path                                                                               |
| -------------- | ---------------------------------------------------------------------------------- |
| Page           | `ui/src/features/dashboard/parking/pages/ParkingDashboardPage.tsx`                 |
| Stat cards     | `ui/src/features/dashboard/parking/components/ParkingDashboardStatCards.tsx`       |
| Calendar block | `ui/src/features/dashboard/parking/components/ParkingDashboardCalendarSection.tsx` |
| Empty stats    | `ui/src/features/dashboard/parking/hooks/useParkingDashboardStats.ts`              |
| Shell          | `ui/src/features/dashboard/org/components/ParkingAdminShell.tsx`                   |

---

## Testing

| Layer | Path / spec                                                                  | Manual        |
| ----- | ---------------------------------------------------------------------------- | ------------- |
| Unit  | `parkingStatusMachine_test.ts`                                               | —             |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs | PayMongo live |
| N/A   | Parking host dashboard shell load                                            | —             |
