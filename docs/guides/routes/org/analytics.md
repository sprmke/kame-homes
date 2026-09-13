---
title: 'Org Portfolio Analytics — operator guide'
status: active
tags: [guides, routes, org, analytics]
updated: 2026-09-08
---

# Org Portfolio Analytics — operator guide

Route: `/org/:orgSlug/analytics`

> **Status:** Documented — Phase 5 shipped. CSV export at this org level; PDF export and the
> "vs Kame median" platform benchmark are property-level features (see
> [`../org/property/analytics.md`](../org/property/analytics.md)) — this rollup page shows
> neither, by design (a portfolio table already compares properties against each other).
> Plan: [`../../../workflow/in-progress/host-analytics-module.md`](../../../workflow/in-progress/host-analytics-module.md)

## Progress overview

| Section                   | E2E save | Validation | Docs | Notes                                                                        |
| ------------------------- | -------- | ---------- | ---- | ---------------------------------------------------------------------------- |
| Portfolio KPI rollup      | —        | —          | Done | Revenue, avg occupancy, reservations, properties-reporting count             |
| Property comparison table | —        | —          | Done | Client-sortable, revenue-desc default, drill-down link per property          |
| Mixed-enrollment handling | —        | —          | Done | Free-tier properties in the org render as locked rows, not real data         |
| CSV export                | —        | —          | Done | Client-side blob download of the currently loaded rows                       |
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
2. **Portfolio KPI cards** — total revenue, average occupancy (mean across entitled
   properties), total reservations, and a "properties reporting" count (entitled vs total
   active properties — visible proof of how many properties are actually contributing numbers).
   Icon wells are muted.
3. **Property Comparison table** — every active property in the org, sortable by name,
   occupancy, ADR, RevPAR, revenue, or reservations (click a column header, click again to
   reverse). Each property name links to that property's own Analytics page. **Export CSV**
   downloads the currently sorted/loaded rows.

## Plan gate

Requires `analyticsInsights` on **at least one** property in the org (permissive page-level
gate via `RequireOrgFeature`, this repo's first org-scoped paid-feature gate). Inside the table,
each row reflects that specific property's own entitlement — a Free-tier property inside an
otherwise-Pro org shows as a locked row (name only, no numbers), not silently included with
real data and not silently hidden either.

## Permission table

| Permission           | Grants                                                             |
| -------------------- | ------------------------------------------------------------------ |
| `org.analytics:view` | View the portfolio page (any tier, subject to the plan gate above) |

Seeded: Owner → all org permissions including this one. `ADMIN` (Full Access org role) →
granted by default. No narrower org-level roles exist today for this leaf.

## States

- **Loading**: shared `DashboardSkeleton`.
- **Error / no entitled properties**: the backend returns HTTP 402 when zero properties in the
  org have `analyticsInsights` — surfaced as a plain error message (this shouldn't normally be
  reachable given the page-level plan gate, but the org's entitlement can theoretically change
  between the gate check and the data fetch).

## Host-facing knowledge

This page compares every property in your organization side by side, so you can see at a
glance which listings are carrying the portfolio and which ones need attention.

**Common host questions**

- Q: Why does a property show as "Locked" with no numbers?
  A: That specific property isn't on the Pro plan. Portfolio Analytics only shows real numbers
  for properties that have Analytics enabled individually.
- Q: Can I export this for my own records?
  A: Yes — **Export CSV** downloads the table exactly as sorted, including locked rows (shown
  as "Locked" rather than blank).
