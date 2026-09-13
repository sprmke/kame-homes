---
title: 'Analytics — operator guide'
status: active
tags: [guides, routes, org, property]
updated: 2026-09-13
---

# Analytics — operator guide

Route: `/org/:orgSlug/property/:propertySlug/analytics`

> **Status:** Documented — Phase 0/1/2/2b/3/4 shipped (deterministic dashboard + forward-looking
> view + YoY comparison + public page tracking + AI Performance Review + Improvement Playbook +
> Ask Analytics), Phase 5 shipped as org portfolio rollup + CSV export.
> Plan: [`../../../../workflow/for-testing/host-analytics-module.md`](../../../../workflow/for-testing/host-analytics-module.md)

## Progress overview

| Section                                      | E2E save | Validation | Docs    | Notes                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | -------- | ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section tabs                                 | —        | —          | Done    | Overview / Trends / Guests / AI review (`AnalyticsSectionTabs`)                                                                                                                                                                                                                                          |
| KPI strip                                    | —        | —          | Done    | **4 headline cards** — Occupancy (with nights booked / nights in range), Avg nightly rate, Revenue per night, Bookings. Compact occupancy-state strip sits above the grid. Lead time / cancellations / rating / response rate live in Trends & Guests                                                    |
| State banner                                 | —        | —          | Done    | Compact status chips above the KPI grid (`AnalyticsStateStrip`) — occupancy outlook (Underbooked / Building / Strong / Fully booked) plus an unpaid-balances chip when collections aren't clear                                                                                                          |
| Occupancy & revenue trend                    | —        | —          | Done    | recharts occupancy bars / revenue area. Lives on **Overview** as "This period" (not Trends)                                                                                                                                                                                                              |
| Booking source mix                           | —        | —          | Done    | Donut by `booking_source`. Compact preview on Overview when there are bookings; full card on Guests                                                                                                                                                                                                      |
| Listing page visits                          | —        | —          | Done    | Overview only when page views or unique visitors > 0 (empty zero-card omitted). `property-page-view` beacon + monthly prune cron                                                                                                                                                                         |
| Do next                                      | —        | —          | Done    | Overview CTA list (`AnalyticsNextActionsCard`) from occupancy/balance state: Collect balances, Adjust pricing / Raise remaining rates, Promote listing, or the top Playbook tip / AI review                                                                                                              |
| Guests (age + origins)                       | —        | —          | Done    | Age histogram (explicit "Unknown" bucket) — renders a zeroed axis + caption when no signal, not a text swap; free-text-bucketed origin list (placeholder bars when empty)                                                                                                                                |
| Lead time & length of stay                   | —        | —          | Done    | Two histograms — empty range keeps the chart footprint (faint baseline + "No data for this range yet")                                                                                                                                                                                                   |
| Date range control                           | —        | —          | Done    | Shared `BookingDateRangeFilter` (Week/Month/Year/Custom), `?from`/`?to` params — same as Bookings/Finance/Dashboard; default = current month                                                                                                                                                             |
| Teaser (Free/Starter)                        | —        | —          | Done    | 4-KPI preview + upgrade CTA, no fabricated data                                                                                                                                                                                                                                                          |
| Empty state (new property)                   | —        | —          | Done    | Shown below 10 non-cancelled bookings ever                                                                                                                                                                                                                                                               |
| Booking pace / pickup / next-90-days forward | —        | —          | Done    | `BookingPaceCard` on Trends; `NextNinetyDaysCard` on Overview (booked nights bar, confirmed revenue, open nights + pricing link, last-7/30 pickup as a caption)                                                                                                                                          |
| Comparison toggle (prior vs last year)       | —        | —          | Removed | On-screen toggle dropped as redundant. KPI deltas are always vs-last-period; YoY still in the bundle for PDF + AI review                                                                                                                                                                                 |
| AI Performance Review                        | —        | —          | Done    | Weekly cron + on-demand regenerate (1/hour); score dial, Working/Improve/Avoid columns                                                                                                                                                                                                                   |
| Improvement Playbook                         | —        | —          | Done    | `PlaybookList`, matched via `_shared/hostPlaybook.ts` against the bundle, 17 seeded articles + super-admin CRUD                                                                                                                                                                                          |
| Ask Analytics (AI Assistant integration)     | —        | —          | Done    | `get_property_analytics` + `explain_metric` Tier-0 read tools stay available via the global assistant FAB. The dedicated **Ask AI** toolbar button was **removed** (2026-09-10) — it opened the generic assistant with no analytics scope, so it added little over the glossary tooltips + AI review tab |
| PDF export                                   | —        | —          | Done    | Client-side jsPDF report (state, KPIs, channel/origins, AI review, Playbook); gated by `analytics:export`                                                                                                                                                                                                |
| Org portfolio rollup + export                | —        | —          | Done    | `/org/:orgSlug/analytics` — see [`../analytics.md`](../analytics.md)                                                                                                                                                                                                                                     |

---

## Overview

Property-scoped performance dashboard. Deterministic metrics are computed on-read from
`guest_submissions` (bookings), `guest_reviews`, `inbox_thread_metrics` (Guest Inbox
responsiveness), and `property_page_views` (public listing page visits) — no rollup table, no
AI cost, always fresh.

**Controls live in the standard page-header slot**, exactly like Bookings / Finance / the
property Dashboard:

- **Date range** — the shared `BookingDateRangeFilter` (Week / Month / Year / Custom + ←/→
  navigation), driven by the same `?from` / `?to` URL params via `analytics/lib/analyticsPeriod.ts`
  - `useDateNavigation`. Default window is the current calendar month. On mobile it sits in the
    floating toolbar that straddles the hero edge.
- **Export PDF** — desktop: a button next to the date filter; mobile: a `···` hero action menu
  (`MobileHeroActionMenu`). Only renders on the full (entitled) dashboard **and** with
  `analytics:export`. (The dedicated **Ask AI** button was removed 2026-09-10 — see § Ask AI below.)

There is **no period-comparison toggle** — KPI deltas are always period-over-period ("vs last
period"). The server still returns year-over-year figures in the bundle for the PDF and the AI
review; only the on-screen toggle was removed as redundant UI.

Inside the page body, a **compact occupancy-state strip** (`AnalyticsStateStrip`) sits above
**4 headline KPI cards** (Occupancy, Avg nightly rate, Revenue per night, Bookings). Occupancy
shows nights booked of nights in the selected range. Deltas are period-over-period. All four use
muted icon wells. Each title has a small `ⓘ` glossary tooltip. Booking lead time, cancellations,
guest rating and response rate are not headline cards.

Below that, **four section tabs** (`AnalyticsSectionTabs`): Overview · Trends · Guests · AI review.

Tabs and their contents:

1. **Overview** (`AnalyticsOverviewSection`)
   - **This period** — occupancy bars / revenue area for the selected date range (moved here
     from Trends so the first tab has a chart).
   - **Next 90 days** — booked-nights bar, confirmed revenue, open nights (links to Pricing),
     and a caption for new bookings in the last 7 / 30 days. This window is forward-looking and
     is not the same as the date-range KPIs.
   - **Do next** — up to three CTAs from occupancy/balance state (Collect balances, Adjust
     pricing or Raise remaining rates, Promote listing) plus the top Playbook tip or "See AI
     review".
   - **Where bookings come from** — compact channel donut, only when the period has bookings.
   - **Listing visits** — page views, unique visitors, top referrers; omitted when both views
     and visitors are 0.
   - **How you compare** — "vs Kame median" benchmark, when enough peer listings exist.
2. **Trends**
   - **Booking pace** — this-year-vs-last-year monthly curve with a solid/dashed legend;
     trailing all-zero future months are trimmed.
   - **How guests book** — lead-time and nights-per-stay histograms with direct value labels
     and horizontal (unrotated) axis labels. An empty range keeps the chart footprint — a faint
     dashed baseline + "No data for this range yet" — instead of collapsing to a line of text.
3. **Guests**
   - **Where bookings come from** — donut by `booking_source`; raw slugs are humanised via
     `analytics/lib/channelLabels.ts` and the legend shows share % plus count.
   - **Who's booking** — guest-age histogram: when the only signal is the `Unknown` bucket it
     draws a zeroed axis with a "No age data for this range yet" caption over it (not a text
     swap) + a ranked "Guest origins" list (free-text bucketed from `guest_address` /
     `nationality` — no map, no geocoding; placeholder bars + caption when empty).
4. **AI review**
   - **AI Performance Review** — a score (0–100), what's working, what to improve, and what to
     avoid — each grounded in the numbers above and, when relevant, citing a specific recent
     change (a rate update, a blocked date) that plausibly explains a metric move. Regenerates
     automatically once a week (no manual regenerate in the UI). Advisory only — it never changes
     a rate or a setting.
   - **Improvement Playbook** — expandable tip cards, matched against this property's current
     numbers (occupancy state, response rate, channel concentration, etc.) from a curated
     17-article seed set. Not personalized by AI — a deterministic condition matcher.
     Super admins manage the article catalog at `/admin/playbook`.

**Export PDF** (toolbar, requires `analytics:export`) renders a client-side report (jsPDF, same
toolkit as Finance/Maintenance exports) from the data already on the page — current state, KPIs
vs prior period, channel mix/guest origins, the latest AI Performance Review (when one exists),
and the matched Playbook articles. No server round trip beyond what the page already loaded.

### Ask AI

There is **no dedicated Ask AI button on this page** (removed 2026-09-10). The old button just
called `openAiAssistant()` — it popped the generic AI Dashboard Assistant with no analytics
prompt or scope seeded, so it added little over the `ⓘ` glossary tooltips and the AI Performance
Review tab. The analytics read tools still exist: a host who opens the assistant from the global
FAB can ask about this property and the assistant calls `get_property_analytics` (the same
bundle this page renders) and `explain_metric` — see
[`../../../../architecture/ai-dashboard-assistant.md`](../../../../architecture/ai-dashboard-assistant.md)
§3.11. Re-introducing a _scoped_ "explain this page" action (pre-seeded prompt + property/date
context) is a possible future follow-up.

## Plan gate

Full dashboard requires the `analyticsInsights` plan feature (Pro `growth` and above). Free/Starter
see a **teaser**: a 4-KPI strip (occupancy, ADR, RevPAR, reservations — real numbers, not
placeholders) plus an upgrade panel. The server (`analytics-summary`) computes the same
deterministic bundle either way and only trims the response for non-entitled properties — the
teaser numbers are never fabricated.

## Permission table

| Permission         | Grants                                                          |
| ------------------ | --------------------------------------------------------------- |
| `analytics:view`   | View the Analytics page (any tier — teaser or full)             |
| `analytics:export` | Show and use the **Export PDF** button in the Analytics toolbar |

Seeded role templates: Full Access → both; Operations and Read Only → `analytics:view` only;
other custom roles → none by default (configurable per org).

## States

- **Loading**: `DashboardSkeleton` (shared skeleton, KPI cards + chart placeholders).
- **Empty**: fewer than 10 non-cancelled bookings ever → "Not enough booking history yet" with
  the current count.
- **Teaser**: Free/Starter — 4-KPI strip + upgrade CTA, rest of the page hidden (not blurred/
  watermarked — a clean upgrade panel instead).
- **Error**: generic retry message.

## Host-facing knowledge

This page shows how this specific listing is performing — not just booking counts, but whether
you're currently underbooked, building momentum, running strong, or fully booked, plus whether
any upcoming bookings still owe a balance.

**Common host questions**

- Q: Why does my occupancy rate look different from the Dashboard page?
  A: Analytics uses the same night-by-night calculation as the property Dashboard, but lets you
  pick a custom date range and always shows period-over-period comparison.
- Q: What does "Unknown" mean in Guest Origins / Age?
  A: Some bookings don't have a parseable address/nationality or guest age recorded — those are
  shown as their own bucket rather than silently excluded, so percentages stay honest.
- Q: Why does Occupancy say 10% but Next 90 days says 0%?
  A: Occupancy is the month (or range) you picked in the date control. Next 90 days is what's
  already reserved from today forward. They are two different windows on purpose.
- Q: What does Do next do?
  A: Those rows are shortcuts. Underbooked listings point you to Pricing and Marketing.
  Unpaid upcoming stays point you to Bookings. Tips open the AI review tab.
- Q: I'm on the Free plan — why can't I see the charts?
  A: The full Analytics dashboard (charts, next 90 days, guest insights, and the AI review) is a
  Pro feature. The KPI strip at the top still shows your real numbers.
- Q: Does the AI review change my rates or settings?
  A: No. It's advisory only — it can suggest an action (e.g. "raise your weekend rate") but
  never applies one. You'd still make that change yourself on the Pricing page.
- Q: Why does "Regenerate" sometimes say it's unavailable?
  A: It's rate-limited to once an hour per property, and if the AI service is briefly
  unreachable it falls back to your last review rather than erroring.
- Q: Where did the "Ask AI" button go?
  A: It was removed — it just opened the general assistant without focusing it on this page. For
  a plain-language explanation of any metric, hover the small ⓘ next to its name; for a written
  assessment of the whole property, use the **AI review** tab. You can still open the assistant
  from the sparkle button in the corner and ask about this listing.
