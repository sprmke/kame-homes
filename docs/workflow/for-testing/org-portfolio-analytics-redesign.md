---
title: 'Org portfolio analytics redesign'
status: for-testing
tags: [workflow, for-testing, analytics, org, parking, ux]
updated: 2026-09-27
stage: for-testing
kind: plan
---

# Org portfolio analytics redesign

## Implementation status (2026-09-27)

**Phases A–E complete** (code + `ci:quality` green). Manual QA remaining — see route guide Testing row.

### Phase A — Data correctness + parking rollup

- [x] `occupiedNights` / `periodDays` on portfolio metrics
- [x] `computeParkingPortfolioRow` + pair helpers (one bookings load for current + prior)
- [x] `analytics-org-summary`: properties + parkings, night-weighted `rollupOrgPortfolio`, prior deltas, `attentionCount`
- [x] Cap 200 properties + 200 parkings
- [x] Vitest rollup + CSV tests

### Phase B — Page chrome + KPI + attention

- [x] `OrgAnalyticsPage`: URL period, `BookingDateRangeFilter`, Export in `desktopActions` + `MobileHeroActionMenu`
- [x] KPI strip: Revenue / Occupancy / Bookings / Needs attention + glossary
- [x] `OrgAnalyticsAttentionCard`

### Phase C — Listings comparison UI

- [x] `OrgListingsComparison` (segment filter, phone cards, desktop table, outlook chips)
- [x] CSV kind column + tests
- [x] Removed nested Export from table header; deleted old `OrgPropertyComparisonTable`

### Phase D — Docs

- [x] Route guide, edge-functions, PROJECT, routes README, org permission copy

### Phase E — Verify

- [x] Vitest `orgPortfolioRollup` + `exportCsv`
- [x] `bun run ci:quality` green
- [x] Moved to for-testing for manual QA

## Goal

Make `/org/:orgSlug/analytics` a host-useful portfolio page: answer **which listings are carrying revenue, which need attention, and how the portfolio is trending**, with correct rollup math for **properties and parkings**, and UI chrome that matches Org Dashboard / Property Analytics (date range + export in the page header, list pattern for listings).

Today the page is a thin KPI strip + jargon-heavy property table. Much of the backend row payload is unused in the UI, occupancy rollup math is misleading, parkings are absent, and controls diverge from every other org page.

## Competitive UX brief — org portfolio analytics

**Job:** multi-listing host wants portfolio health + ranking + "what to fix this week."  
**Role:** operator (host / co-host).  
**Surface:** org admin.

### PMS leaders

- **Guesty Advanced Analytics** — account-wide dashboards; occupancy / ANR / RevPAL; listing filters; Business on the Books (forward); downloadable reports on premium.
- **Hostaway** — portfolio occupancy + profitability; ranking underperformers; financial rollups.
- **PriceLabs / Baileys (OwnerRez)** — rank every listing by ADR / RevPAN / occupancy / profit; pace vs last year; gap alerts; group filters.
- **Hospitable Metrics** — portfolio widgets; slice by listing; Copilot for "which listing needs attention."

### Adopt for Kame Homes

- Night-weighted portfolio occupancy (not equal average of listing %).
- Listing leaderboard with **attention signals** (outlook + unpaid balance), not only revenue sort.
- Plain labels already used on property Analytics (`Avg nightly rate`, `Revenue per night`, `Bookings`) + `MetricInfoDot`.
- Header chrome: shared date filter + Export CSV beside it (Property Analytics PDF pattern).
- Type filter All / Properties / Parkings (reuse Org Dashboard `OrgPropertiesPerformanceCard` pattern).

### Adapt / skip

- No custom report builder; no AirDNA market comps at org level (property "vs Kame median" stays property-only).
- No full parking Analytics deep page in this plan (KPIs + rollup row only; parking `/analytics` remains a later follow-up from `host-analytics-module.md`).
- No org-level AI review / PDF (CSV only). Keep plan gate on export only (`analyticsInsights` + `org.analytics:export`).
- Minimal copy; hide page subtitle below `lg`.

## Current state (audit)

| Area    | Today                                                                                 | Problem                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Route   | `/org/:orgSlug/analytics`                                                             | Documented; Phase 5 shipped                                                                                                       |
| Edge    | `analytics-org-summary` → `computePropertyPortfolioRow` per ACTIVE property (cap 200) | Properties only; no parkings                                                                                                      |
| KPIs    | Revenue, Avg Occupancy, Total Reservations, Properties                                | Avg = mean of rates (equal weight); "Properties" is not actionable; no vs-prior deltas                                            |
| Table   | Occupancy, ADR, RevPAR, Revenue, Reservations                                         | Jargon; no glossary; ignores API fields `cancellationRate`, `forwardOccupancyState30d`, `balanceCollectionState` (already in CSV) |
| Export  | Inside table card header                                                              | Should be page `desktopActions` / `MobileHeroActionMenu` like Property Analytics                                                  |
| Date    | `AnalyticsDateRangeControl` Select presets; local state only                          | Org Dashboard + Property Analytics use `BookingDateRangeFilter` + URL `?from=&to=` + `FloatingToolbar`                            |
| List UX | Hand-rolled HTML table                                                                | Org Dashboard uses card list + All/Properties/Parkings segments                                                                   |
| Overlap | Thin ranking vs Org Dashboard "Listings Performance"                                  | Analytics should add rates + outlook + collections + export, not duplicate the same thin list                                     |

### Calculation notes (must fix)

1. **Portfolio avg occupancy** in `analytics-org-summary` is mean of per-property occupancy %. A 10%-full listing and a 90%-full listing both weight 50%. Correct portfolio occupancy:  
   `sum(occupiedNights) / sum(periodDays)` across included listings (same night-weighting Org Dashboard uses for org occupancy via total nights ÷ units × days).
2. **Per-listing occupancy / ADR / RevPAR** for properties reuse `computePeriodSnapshot` (lodging rate prorated into range). Keep that; expose `occupiedNights` (and optionally `periodDays`) on each row so the rollup is auditable.
3. **Parking** bookings live on `guest_submissions` with `parking_id` (already aggregated in `dashboardService` for Org Dashboard). Add `computeParkingPortfolioRow` mirroring the property row with parking-appropriate fields (revenue, occupancy, reservations; ADR/RevPAR from parking nightly economics when present).
4. **Locked rows** — preview-open now always returns `locked: false`. Drop dead locked UI paths or keep type for CSV backward compatibility only.

## Scope

### In

- Full UX redesign of org Analytics page chrome + KPIs + listing comparison + Needs attention.
- Extend `analytics-org-summary` for parkings + night-weighted portfolio KPIs + prior-period deltas + attention counts.
- Align date range + export with Property Analytics / Org Dashboard.
- Show outlook + balance states in UI (already computed).
- Plain metric labels + glossary dots (reuse `metricGlossary` / `MetricInfoDot`).
- CSV columns for listing kind (property | parking) + updated fields.
- Route guide + edge-functions / PROJECT docs; tests for rollup math + CSV.
- Plans / RBAC: keep existing `org.analytics:view` / `:export` + `analyticsInsights` on export (N/A new keys).
- Activity log: N/A (read-only + client CSV blob).

### Out

- Property Analytics page rewrite (already polished).
- Dedicated `/org/.../parking/.../analytics` deep page + AI review for parking.
- Org-level PDF / AI portfolio review / Ask Analytics org tool (optional later).
- `analytics_daily_rollup` perf table (Phase 6 only if load hurts).
- Changing Org Dashboard Listings Performance card (leave as ops pulse).

## Approach

### Information architecture (top → bottom)

```
AdminMobilePage "Analytics"
  heroTrailing: Export CSV (MobileHeroActionMenu when permitted)
  overlap (phone): FloatingToolbar + BookingDateRangeFilter
  desktopActions: BookingDateRangeFilter + Export CSV (TierBadgeAnchor)

1. KPI strip (4 cards, with vs last period)
   - Revenue
   - Occupancy (night-weighted) — glossary
   - Bookings
   - Needs attention (count of listings underbooked OR balance ≠ clear)
   Meta line under strip (optional, muted): "N properties · M parkings" — omit if zero of a kind

2. Needs attention (conditional card)
   - Only when attentionCount > 0
   - Compact list: name · kind badge · outlook / balance chips · link to property Analytics or parking Dashboard
   - Cap ~5 + "View all in table" scroll/focus

3. Listings comparison
   - Header: "Listings" + All | Properties | Parkings segment (only when both kinds exist)
   - Phone: card rows (match OrgPropertiesPerformanceCard density)
   - lg+: table or same cards in denser grid — prefer one shared list component for consistency
   - Columns / row facts:
     Listing (+ kind badge when All)
     Occupancy
     Avg nightly rate (properties; parkings when computable; hide or "—" if N/A)
     Revenue per night (same)
     Revenue
     Bookings
     Outlook (chip: Underbooked / Building / Strong / Full)
     Collections (chip only if not clear)
   - Default sort: revenue desc; clickable sort on money/rate/bookings/occupancy
   - Row click / name → property Analytics or parking Dashboard (until parking analytics exists)
   - Empty: "No listings in this period" / no assets yet
```

### Differentiation from Org Dashboard

| Org Dashboard                                             | Org Analytics                                   |
| --------------------------------------------------------- | ----------------------------------------------- |
| Ops pulse: pending actions, recent bookings, status donut | Performance period: rates, outlook, collections |
| Quick listing revenue/occupancy list                      | Full comparison + export + attention states     |
| Add listing CTA                                           | Export CSV                                      |

Hosts should not feel the two pages show the same four numbers twice.

### Data contract (`analytics-org-summary`)

Response shape (additive; keep existing keys during migrate):

```ts
{
  period: { from, to },
  priorPeriod: { from, to },
  portfolio: {
    totalRevenue: number,
    totalRevenueChangePct: number | null,
    avgOccupancy: number,              // night-weighted %
    avgOccupancyChangePts: number | null,
    totalReservations: number,
    totalReservationsChangePct: number | null,
    propertyCount: number,
    parkingCount: number,
    listingCount: number,
    attentionCount: number,
    // deprecate entitledPropertyCount or alias listingCount
  },
  rows: Array<
    | PropertyPortfolioUiRow
    | ParkingPortfolioUiRow
  >
}
```

Each unlocked row includes existing metrics plus `kind: 'property' | 'parking'`, `occupiedNights`, `listingId` / `listingSlug` / `listingName` (or keep property* + parking* fields with a discriminator). Prefer a unified:

```ts
{
  kind: 'property' | 'parking',
  id, name, slug,
  locked: false,
  occupancyRate, adr, revpar, grossRevenue, reservations,
  cancellationRate,
  forwardOccupancyState30d,
  balanceCollectionState,
  occupiedNights,
}
```

Parking: `balanceCollectionState` may stay `clear` if parking unpaid model differs; document behavior. Prefer reusing `computeBookingFinancials` when unpaid balance exists on parking bookings.

### UI chrome alignment

| Control     | Pattern to copy                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Date        | `BookingDateRangeFilter` + `useDateNavigation` + URL via `resolveAnalyticsPeriod` / `writeAnalyticsPeriodParams` (same as Property Analytics) |
| Export      | Page-level button; plan gate + RBAC unchanged; move out of table header                                                                       |
| Mobile date | `FloatingToolbar` overlap on `AdminMobilePage`                                                                                                |
| Delete      | `AnalyticsDateRangeControl` if unused after migrate                                                                                           |

### Host-facing labels

| Avoid on screen     | Prefer            |
| ------------------- | ----------------- |
| Portfolio Revenue   | Revenue           |
| Avg Occupancy       | Occupancy         |
| Total Reservations  | Bookings          |
| ADR                 | Avg nightly rate  |
| RevPAR              | Revenue per night |
| Property Comparison | Listings          |

Glossary via existing `MetricInfoDot`. Outlook chips: short words only (`Underbooked`, `Building`, `Strong`, `Full`).

## Implementation tasks

### Phase A — Data correctness + parking rollup

- [ ] Add `occupiedNights` (and `periodDays` if needed) to `computePropertyPortfolioRow`.
- [ ] Add `computeParkingPortfolioRow(parkingId, from, to)` in `_shared/analyticsService.ts` (query `guest_submissions` by `parking_id`; mirror snapshot math).
- [ ] Rewrite `analytics-org-summary`: load ACTIVE properties + ACTIVE parkings for org; unified rows; night-weighted `avgOccupancy`; prior-period portfolio deltas; `attentionCount`.
- [ ] Cap: keep 200 listings total or 200 properties + 200 parkings (document choice; prefer combined 200 sorted by name then kind, or 200 each if orgs are small — default **200 properties + 200 parkings** matching current property cap).
- [ ] Deno unit tests for night-weighted rollup helper + parking row smoke (or Vitest mirror if Deno not in CI path — follow `testing` skill: prefer `_shared/*_test.ts` for math).
- [ ] Update UI types in `analytics/lib/types.ts` + hooks.

### Phase B — Page chrome + KPI + attention

- [ ] Rebuild `OrgAnalyticsPage` like `OrgDashboardPage` / `PropertyAnalyticsPage`: URL period, `BookingDateRangeFilter`, export in `desktopActions` + `MobileHeroActionMenu`.
- [ ] Rewrite `OrgAnalyticsKpiCards` → align with `AnalyticsKpiStrip` patterns (deltas, glossary, friendlier titles; Needs attention instead of Properties count).
- [ ] New `OrgAnalyticsAttentionCard` (conditional).
- [ ] Remove export from table header; remove subtitle clutter (`subtitle` only if parking mixed — mirror dashboard wording: "Properties and parking" / omit on phone via existing `AdminMobilePage` behavior).

### Phase C — Listings comparison UI

- [ ] Replace/rename `OrgPropertyComparisonTable` → `OrgListingsComparison` (segment filter, card list on `max-lg`, table or dense list on `lg+`).
- [ ] Surface outlook + collections chips; sort keys include those optionally.
- [ ] Drill-down: property → `propertySectionPath(..., 'analytics')`; parking → `parkingSectionPath(..., 'dashboard')` until parking analytics exists.
- [ ] Update `exportCsv.ts` + tests for `kind` column and unified rows.
- [ ] Mobile: `AdminListRefineSheet` only if sort/filter exceeds one segment control — default segment in card header is enough for v1.

### Phase D — Docs + gates

- [ ] Update `docs/guides/routes/org/analytics.md` (sections, host Q&A, parking, chrome).
- [ ] Update `docs/architecture/edge-functions.md` (`analytics-org-summary` row).
- [ ] Touch `docs/PROJECT.md` Analytics blurb if rollup description changes.
- [ ] Update `orgTeamConstants` description strings if they still say "properties" only.
- [ ] `activity-log: N/A — read-only rollup + client CSV`.
- [ ] Plans/RBAC: N/A new keys — document in route guide.
- [ ] Manual QA checklist in route guide Testing row.

### Phase E — Verify

- [ ] Seed/local: org with 1 property + 1 parking; confirm KPI totals = sum of listing rows; occupancy night-weighted.
- [ ] Org with properties only / parkings only / both — segment visibility.
- [ ] Export CSV plan gate + RBAC.
- [ ] 375 / 768: date float + export menu; no dual bottom bars; sheets for date presets via existing filter.
- [ ] `bun run ci:quality` + targeted Vitest/Deno tests.

## Docs to update

| Doc                                                  | Change                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `docs/guides/routes/org/analytics.md`                | Full rewrite of layout, parking, attention, chrome              |
| `docs/guides/routes/README.md`                       | Status blurb if needed                                          |
| `docs/architecture/edge-functions.md`                | Response shape + parking                                        |
| `docs/PROJECT.md`                                    | Org analytics one-liner                                         |
| `docs/workflow/for-testing/host-analytics-module.md` | Note org redesign + parking rollup (still no parking deep page) |
| `ui/.../orgTeamConstants.ts`                         | Permission descriptions                                         |

## Open questions

Prefer decided defaults (override only if product disagrees):

1. **Parking deep link** → parking Dashboard until a parking Analytics page exists. **Decided.**
2. **Listing cap** → 200 properties + 200 parkings. **Decided.**
3. **Parking ADR/RevPAR** → compute when nightly lodging math applies; else show Revenue + Occupancy + Bookings only and leave rate cells empty. **Decided.**
4. **Needs attention definition** → underbooked next 30 nights, zero bookings in period, or soft occupancy (< 40% with bookings). **Balance / unpaid guest totals are not attention signals on org Analytics** (Finance owns collections). **Decided (updated).**
5. **Org Ask Analytics tool** → out of scope. **Decided.**

## Success criteria

- Hosts can see properties and parkings on one portfolio page with correct totals.
- Occupancy KPI matches night-weighted math (spot-check against sum of occupied nights).
- Export + date range live in page header chrome, consistent with Property Analytics / Org Dashboard.
- Attention listings are visible without opening CSV.
- Labels match property Analytics vocabulary; ADR/RevPAR jargon not primary UI.
- Mobile: bottom sheet / floating date pattern; no Export buried in a card header.

## Related

- Shipped module: [`../for-testing/host-analytics-module.md`](../for-testing/host-analytics-module.md)
- Route guide: [`../../guides/routes/org/analytics.md`](../../guides/routes/org/analytics.md)
- Property Analytics (chrome reference): [`../../guides/routes/org/property/analytics.md`](../../guides/routes/org/property/analytics.md)
- Org Dashboard listing list pattern: `OrgPropertiesPerformanceCard.tsx`
