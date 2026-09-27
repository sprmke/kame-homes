---
title: 'Org Portfolio Analytics — operator guide'
status: active
tags: [guides, routes, org, analytics]
updated: 2026-09-27
---

# Org Portfolio Analytics — operator guide

Route: `/org/:orgSlug/analytics`

> **Status:** Documented — redesign (one listings table with attention pinned first, same
> search / filters / views as Properties and Parkings, night-weighted occupancy, header chrome). Property deep Analytics remains at
> [`../org/property/analytics.md`](../org/property/analytics.md). Plan:
> [`../../../workflow/for-testing/org-portfolio-analytics-redesign.md`](../../../workflow/for-testing/org-portfolio-analytics-redesign.md)

## Progress overview

| Section                | E2E save | Validation | Docs | Notes                                                                                     |
| ---------------------- | -------- | ---------- | ---- | ----------------------------------------------------------------------------------------- |
| Portfolio KPI rollup   | —        | —          | Done | Revenue, Bookings, Occupancy, Needs attention (booking/demand signals only)               |
| Listings (one table)   | —        | —          | Done | Search, attention + type filters, Table / Grid / List, pagination; attention pinned first |
| CSV export             | —        | —          | Done | Page header Export CSV; outlook + forward occupancy %; no balance columns                 |
| PDF export             | —        | —          | N/A  | Property-level only                                                                       |
| Platform benchmark     | —        | —          | N/A  | Property-level only                                                                       |
| Parking deep Analytics | —        | —          | N/A  | Out of scope; parking rows link to parking Dashboard                                      |

---

## Overview

Org-wide rollup of listing performance — answers "how is my portfolio doing, and which
listings need attention" rather than deep-diving into any single property.

Layout (top → bottom):

1. **Controls** — `BookingDateRangeFilter` (URL `?from=&to=`, same as Org Dashboard / Property
   Analytics). **Export CSV** sits next to the date control on desktop; on phone, Export is in
   the hero ··· menu and the date filter floats in the toolbar under the brand hero.
2. **KPI cards** — Revenue, Bookings, Occupancy, then **Needs attention** (count of listings
   that need booking/demand action, plus "of N listings"). Glossary dots on Occupancy and
   Bookings. Vs-prior change pills when available.
3. **Listings** — the only list on the page (there is no separate Needs attention card).
   ACTIVE properties and parkings share one toolbar with Properties / Parkings:
   search by name, **Attention** filter (All / Needs attention / On track), **Type** filter
   (All / Properties / Parkings, only when both exist), per-page, and Table / Grid / List
   views (table is desktop only; phones get grid or list).

## Listings table

Column order is always: **Listing**, **Type**, **Attention**, **Occupancy**, **Revenue**,
**Bookings**, **Outlook**. Header padding matches cell padding (same pattern as Bookings /
Finance tables).

- **Attention** — booking and demand signals only (no guest-balance / collections copy).
  Reasons, most urgent first: **Underbooked** (next 30 nights), **No bookings** (zero in the
  selected period), **Soft occupancy** (under 40% fill this period while still having bookings).
  Everything else shows "On track".
- **Outlook** — only the next 30 nights: **Underbooked / Building / Strong / Fully booked** with
  the % booked.
- **Revenue** shows the change vs the prior period under the amount.
- **Order** — needs-attention listings are always first, most urgent on top. Sorting by a column
  header (Listing, Occupancy, Revenue, Bookings, Outlook) orders inside each group. Default is
  Revenue, high to low.
- Rows open property Analytics, or the parking Dashboard for parkings.

Differentiates from Org Dashboard: Dashboard is ops pulse (pending actions, recent bookings);
this page is period performance, rates, outlook, and export. Guest balances belong on Finance /
booking detail, not here.

## Plan gate

The page is **preview-open** on every plan. `analyticsInsights` (Pro `growth` and above) gates
**Export CSV** only: the button stays visible (`org.analytics:export` RBAC); below Pro a corner
plan pill sits on it and the click opens the upgrade modal.

## Permission table

| Permission             | Grants                                              |
| ---------------------- | --------------------------------------------------- |
| `org.analytics:view`   | View the portfolio page (any tier)                  |
| `org.analytics:export` | Show the **Export CSV** button (plan still applies) |

Seeded: Owner → all org permissions including this one. `ADMIN` (Full Access org role) →
granted by default.

**Plans:** existing `analyticsInsights` on export only. **Team RBAC:** existing leaves above.
**activity-log:** N/A — read-only rollup + client CSV blob.

## Calculations

- **Occupancy (portfolio)** — `sum(occupied nights) / sum(available nights)` across included
  listings, not the mean of per-listing occupancy %.
- **Per-listing metrics** — same lodging snapshot as property Analytics (`computePeriodSnapshot`
  / `computePropertyPortfolioRow` / `computeParkingPortfolioRow`).
- **Needs attention** — underbooked next 30 nights, zero bookings in the period, or soft
  occupancy (< 40% fill with at least one booking). Reasons and order live in
  `analytics/lib/orgAnalyticsListings.ts`. Guest-balance / unpaid totals are not attention
  signals on this page.
- **Outlook %** — share of the next 30 nights already booked.

## States

- **Loading**: shared `DashboardSkeleton` (same dense chrome as Org Dashboard).
- **Error**: centered panel with Retry (refetch), matching Org Dashboard recovery.
- **Empty org**: KPI zeros and "No listings yet". Filters with no match show "No listings match your filters".
- **Period change**: `keepPreviousData` keeps prior KPIs visible while the next range loads.

## Testing

| Layer  | Coverage                                                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Unit   | `orgPortfolioRollup.test.ts` (night-weighted occupancy), `orgAnalyticsListings.test.ts` (attention order, filters), `exportCsv.test.ts` |
| Edge   | N/A for rollup helpers (Vitest covers math; avoid Deno-importing `analyticsService`)                                                    |
| Manual | Org with properties only / parkings only / both; Export plan gate; 375px date float + hero export                                       |

## Host-facing knowledge

This page shows how every property and parking listing in your organization performed in the
date range you pick. Listings that look underbooked, empty, or soft on occupancy are listed
first, with a short reason.

**Common host questions**

- Q: Can I export this for my own records?
  A: **Export CSV** is on Pro. On Free the button still shows; tapping it opens Plans.
- Q: Why is occupancy different from averaging each listing?
  A: Portfolio occupancy weights by nights available, so a busy listing counts more than an
  empty one.
- Q: What is the difference between Attention and Outlook?
  A: Attention flags booking or demand problems (gaps ahead, no bookings, soft fill). Outlook
  only describes how full the next 30 nights are.
- Q: Where do unpaid guest balances show?
  A: On Finance and booking detail — not on Analytics.
- Q: Where do parking rows go when I tap them?
  A: Parking Dashboard for now. A full parking Analytics page is not on this screen yet.
