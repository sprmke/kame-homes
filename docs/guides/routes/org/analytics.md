---
title: 'Org Portfolio Analytics — operator guide'
status: active
tags: [guides, routes, org, analytics]
updated: 2026-09-23
---

# Org Portfolio Analytics — operator guide

Route: `/org/:orgSlug/analytics`

> **Status:** Documented — Phase 5 shipped. CSV export at this org level; PDF export and the
> "vs Kame median" platform benchmark are property-level features (see
> [`../org/property/analytics.md`](../org/property/analytics.md)) — this rollup page shows
> neither, by design (a portfolio table already compares properties against each other).
> Plan: [`../../../workflow/for-testing/host-analytics-module.md`](../../../workflow/for-testing/host-analytics-module.md)

## Progress overview

| Section                   | E2E save | Validation | Docs | Notes                                                                        |
| ------------------------- | -------- | ---------- | ---- | ---------------------------------------------------------------------------- |
| Portfolio KPI rollup      | —        | —          | Done | Revenue, avg occupancy, reservations, active-property count                  |
| Property comparison table | —        | —          | Done | Client-sortable, revenue-desc default, drill-down link per property          |
| Mixed-enrollment handling | —        | —          | Done | All active properties report numbers (preview-open)                          |
| CSV export                | —        | —          | Done | Client-side blob download; `analyticsInsights` on click                      |
| PDF export                | —        | —          | N/A  | Not at this scope — see per-property PDF export instead                      |
| Platform benchmark        | —        | —          | N/A  | Not at this scope — a per-property comparison here would duplicate the table |

---

## Overview

Org-wide rollup of the property-level Analytics module — see
[`../org/property/analytics.md`](../org/property/analytics.md) for what each property's own
page shows. This page answers "how is my portfolio doing, and which properties need attention"
rather than deep-diving into any single one.

Layout (top → bottom):

1. **Controls** — date range preset (This month / Last 30d / Last 90d / Last 12mo).
2. **Portfolio KPI cards** — total revenue, average occupancy (mean across active
   properties), total reservations, and an active-property count.
   Icon wells are muted.
3. **Property Comparison table** — every active property in the org, sortable by name,
   occupancy, ADR, RevPAR, revenue, or reservations (click a column header, click again to
   reverse). Each property name links to that property's own Analytics page. **Export CSV**
   downloads the currently sorted/loaded rows (Pro+; Free hosts see the button and get the
   upgrade modal).

## Plan gate

The page is **preview-open** on every plan (including Free). `analyticsInsights` (Pro `growth`
and above) gates **Export CSV** only: the button stays visible (`org.analytics:export` RBAC);
below Pro a corner plan pill sits on it and the click opens the upgrade modal. Same pattern as
Finance export and Activity log CSV.

## Permission table

| Permission             | Grants                                              |
| ---------------------- | --------------------------------------------------- |
| `org.analytics:view`   | View the portfolio page (any tier)                  |
| `org.analytics:export` | Show the **Export CSV** button (plan still applies) |

Seeded: Owner → all org permissions including this one. `ADMIN` (Full Access org role) →
granted by default. No narrower org-level roles exist today for this leaf.

## States

- **Loading**: shared `DashboardSkeleton`.
- **Error**: generic retry message if the rollup request fails.
- **Empty org**: KPI zeros and an empty comparison table (no 402).

## Host-facing knowledge

This page compares every property in your organization side by side, so you can see at a
glance which listings are carrying the portfolio and which ones need attention.

**Common host questions**

- Q: Can I export this for my own records?
  A: **Export CSV** is on Pro. On Free the button still shows; tapping it opens Plans.
