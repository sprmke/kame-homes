---
title: 'Organization Dashboard — operator guide'
status: active
tags: [guides, routes, org]
updated: 2026-09-03
---

# Organization Dashboard — operator guide

Route: `/org/:orgSlug/dashboard`

> **Status:** Documented

## Progress overview

| Section                  | E2E save | Validation | Docs | Notes                                                         |
| ------------------------ | -------- | ---------- | ---- | ------------------------------------------------------------- |
| Date range filter        | —        | —          | Done | Same presets as property dashboard                            |
| Stat cards               | —        | —          | Done | Revenue, bookings, occupancy, properties/listings             |
| Revenue / bookings chart | —        | —          | Done | Working toggle; `AdminSurfaceCardHeader`                      |
| Booking status donut     | —        | —          | Done | Period-scoped by check-in; total in center; sr-only breakdown |
| Recent bookings          | —        | —          | Done | Compact divided list; resource name + dates, no kind badge    |
| Pending actions          | —        | —          | Done | From `dashboard-stats.attention` (org bookings deep links)    |
| Listings performance     | —        | —          | Done | All/Properties/Parkings tabs only when org has both kinds     |
| Add listing              | ✅       | ✅         | Done | Opens unified `AddEntityDialog`                               |
| Loading skeleton         | —        | —          | Done | `OrgDashboardSkeleton` mirrors KPI + 2×2 board + listings     |

---

## Overview

Org-level performance overview across **all properties** and, when present, **parking listings** in the organization. Layout matches the property dashboard density: KPI strip, then an equal-width `lg:grid-cols-2` board (`items-stretch`), then a full-width listings performance card.

Page title **Dashboard**. Subtitle is _Performance across all properties._ or _Performance across all properties and parking._ when `parkingCount > 0`. On **phone/tablet** (`max-lg`), shared **brand hero** shell (`AdminMobilePage`): teal hero + title/subtitle, date range in overlapping floating toolbar, **Add listing** as hero icon when permitted. Card-header segments (revenue/bookings, All/Properties/Parkings) stay **right of the title** on one row — dense equal-width `SegmentedControl` (`cardHeaderSegmented*ClassName`). Desktop (`lg+`) keeps compact header with date filter + Add listing. Selected **`?from` / `?to`** (Asia/Manila) drives KPIs, charts, status breakdown, recent bookings, and listing performance.

**Add listing** (when the user has **`org.properties:create`** and/or **`org.parkings:create`** — owners and platform admins always; invited members only when granted): same unified modal as the workspace switcher **+** (title **New listing**). Creating a listing navigates to its dashboard.

There is **no** New Booking button on this page.

**Scoped org admins** (`all_listings = false`): KPIs, charts, recent bookings, and listings performance include **only assigned** properties and parkings (same filter as org bookings / inventory lists).

---

## Date range

Uses **`BookingDateRangeFilter`** — same behavior as the property dashboard:

| Preset | Behavior                                                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Week   | Sun–Sat, navigable with arrows                                                                                                      |
| Month  | Current calendar month (default when URL has no range)                                                                              |
| Year   | Current calendar year                                                                                                               |
| Custom | Calendar popover — primary-colored range selection; footer is Apply only (no date readout); **Back to presets** in the panel header |

URL params: `?from=YYYY-MM-DD&to=YYYY-MM-DD`.

---

## Stat cards

| Card                 | Source                         | Notes                                                                                  |
| -------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| **Total Revenue**    | `kpis.netProfit`               | Host net for check-ins in range (property stays **and** parking reservations)          |
| **Total Bookings**   | `kpis.checkInsInPeriod`        | Non-cancelled check-ins in range across properties + parking                           |
| **Occupancy Rate**   | `kpis.occupancyRate`           | Occupied nights ÷ (period days × listing count); listing count = properties + parkings |
| **Total Properties** | `propertyCount`                | Shown when the org has **no** parking listings                                         |
| **Total Listings**   | `propertyCount + parkingCount` | Shown when `parkingCount > 0`; footer shows `N properties · M parking`                 |

KPI icon wells are muted. Colored icon wells remain on the Finance and Bookings pages only.

---

## Board layout (`lg+`)

Equal-width 2×2 grid (`items-stretch`), then listings card:

1. **Revenue Overview** | **Booking Status**
2. **Recent Bookings** | **Pending Actions**
3. **Listings / Properties Performance** (full width)

---

## Revenue Overview chart

Area chart from `trendSeries` (property + parking bookings):

| Toggle       | `dataKey`  | Y-axis                                                          |
| ------------ | ---------- | --------------------------------------------------------------- |
| **Revenue**  | `revenue`  | PHP (rated lodging allocated to occupied nights in each bucket) |
| **Bookings** | `bookings` | Integer check-in count                                          |

Card subtitle (desktop): **Revenue & bookings over time**. Buckets: **daily** when period ≤ 45 days; otherwise **monthly**.

---

## Booking Status

Large donut from `statusBreakdown` — **no vertical legend**. Card subtitle: **Bookings by status · {period label}** (same **`from` / `to`** filter as KPIs and recent bookings — check-in date in range). Slice fills use **`STATUS_TONE_HEX`** from `@/lib/status-tone-colors` — same Tailwind 500 hues as booking status badge dots (rose, yellow, teal, amber, orange, sky, violet, slate). Center shows the **total booking count in the period**. Per-status counts are in a screen-reader-only list (no hover/tap selection or slice tooltips).

**Pending Documents** sums `PENDING_DOCUMENTS`, `PENDING_GAF`, `PENDING_PARKING_REQUEST`, and `PENDING_PET_REQUEST`. Donut slices render only for counts > 0. Cancelled bookings are excluded.

---

## Recent Bookings

Up to **5** stays/reservations with check-in in the selected period, sorted by check-in descending. Card subtitle: **Check-ins · {period label}**. **Divided list** rows: guest name, compact status badge (sm+), resource name · stay dates on one meta line, amount on the right.

---

## Pending Actions

Same visual pattern as property **Needs attention**: divided list with severity dots, label + count, urgent summary chips when critical items exist, header **View** link, **View all (+N more)** when more than five items. Links resolve to the **org bookings** list with the same query filters (status / date). Subtitle: **Bookings & documents**.

Empty state: dashed panel with **All clear**.

---

## Listings / Properties Performance

| Org listings    | Card title             | Rows                               | Header control                                            |
| --------------- | ---------------------- | ---------------------------------- | --------------------------------------------------------- |
| Properties only | Properties Performance | Properties only                    | **View** → `/org/:orgSlug/properties`                     |
| Parking only    | Parkings Performance   | Parking only                       | **View** → `/org/:orgSlug/parkings`                       |
| Both            | Listings Performance   | Filtered by tab; sorted by revenue | **All** / **Properties** / **Parkings** segmented control |

When the org has **both** properties and parking listings, header tabs filter the in-card list (default **All**). With only one kind, tabs are hidden and **View** opens the org properties or parkings index. Card subtitle: **Revenue & occupancy · {period label}**. Kind badges (Property / Parking) show only on **All** when both kinds exist. Each row: name, location, bookings count, occupancy %, revenue, occupancy bar. Row tap → that asset’s dashboard.

When the filtered list has **more than 5** listings, the card shows **5 rows per page** with **Previous** / **Next** controls and a `{start}–{end} of {total}` counter. Switching **All** / **Properties** / **Parkings** resets to page 1.

---

## Host-facing knowledge

This is the landing page for an organization. It rolls up revenue, bookings, and occupancy across every property you manage, and parking slots when you have them.

**Common host questions**

- Q: How is this different from a single property's dashboard?
  A: This page combines every property (and parking listing, if any) in your organization into one view.
- Q: Why don’t I see Parking on the dashboard?
  A: Parking labels and listing rows only appear after you add at least one parking listing to the organization.
- Q: Where did the booking status list go?
  A: The chart shows bookings in the selected period by stage using colors. The number in the center matches **Total Bookings** for that period. Open **Bookings** for the full list by status.
- Q: Can I create a new property or parking listing from here?
  A: Yes, if you have permission. Use **Add listing** in the header.
- Q: A contract-expired reminder appeared. If I close it, will it come back?
  A: Yes after you refresh the page. Closing it only hides it while you keep using the dashboard.

---

## API

| Function          | Scope | Query                                         |
| ----------------- | ----- | --------------------------------------------- |
| `dashboard-stats` | Org   | `GET ?org_slug=:slug&from=&to=` (or `org_id`) |

Org scope returns `parkingCount`, `parkingPerformance`, and `recentBookings[].bookingKind` / parking fields. Property scope remains `?property_id=…` without org params (`parkingCount: 0`).

---

## Implementation map

| Concern                | Path                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Page                   | `ui/src/features/dashboard/org/pages/OrgDashboardPage.tsx`                                                                 |
| Hook                   | `ui/src/features/dashboard/org/hooks/useOrgDashboardStats.ts`                                                              |
| Skeleton               | `ui/src/components/skeletons/AdminSkeletons.tsx` → `OrgDashboardSkeleton`                                                  |
| Stat cards             | `ui/src/features/dashboard/org/components/org-dashboard/OrgDashboardStatCards.tsx`                                         |
| Revenue chart          | `ui/src/features/dashboard/org/components/org-dashboard/OrgRevenueBookingsChart.tsx`                                       |
| Status donut           | `ui/src/features/dashboard/org/components/org-dashboard/OrgBookingStatusDonut.tsx`                                         |
| Recent bookings        | `ui/src/features/dashboard/org/components/org-dashboard/OrgRecentBookingsList.tsx`                                         |
| Pending actions        | `ui/src/features/dashboard/org/components/org-dashboard/OrgPendingActionsCard.tsx`                                         |
| Listings performance   | `ui/src/features/dashboard/org/components/org-dashboard/OrgPropertiesPerformanceCard.tsx`                                  |
| Add listing dialog     | `ui/src/features/dashboard/org/components/AddEntityDialog.tsx`                                                             |
| Aggregates             | `supabase/functions/_shared/dashboardService.ts`                                                                           |
| Edge function          | `supabase/functions/dashboard-stats/index.ts`                                                                              |
| Status labels / colors | `ui/src/features/dashboard/bookings/lib/bookingStatus.ts`, `ui/src/features/dashboard/bookings/components/StatusBadge.tsx` |

---

## Permissions

- Route guard: `RequireOrgPermission` section `dashboard` → `org.dashboard:view`
- Add listing: `org.properties:create` / `org.parkings:create` (via `org-access` flags)
- Org-wide `dashboard-stats`: all-listings admins see every listing; scoped admins only assigned listings

---

## Testing

| Layer | Path / spec                                                            | Manual |
| ----- | ---------------------------------------------------------------------- | ------ |
| Unit  | `supabase/functions/_shared/dashboardService.ts` helpers when pure     | —      |
| E2E   | `ui/e2e/features/org/orgHubSmoke.spec.ts` dashboard shell load (`@ci`) | —      |
| N/A   | KPI accuracy vs production data                                        | —      |

---

## Related docs

- [Route index](../README.md)
- [Organization properties](./properties.md)
- [Organization parkings](./parkings.md)
- [Org bookings](./bookings.md)
- [Property dashboard](./property/dashboard.md)
- [`docs/PROJECT.md`](../../../PROJECT.md)
