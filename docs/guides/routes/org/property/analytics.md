---
title: 'Analytics — operator guide'
status: active
tags: [guides, routes, org, property]
updated: 2026-09-23
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
| KPI strip                                    | —        | —          | Done    | **4 headline cards** — Occupancy, Avg nightly rate, Revenue per night, Bookings. Lead time / cancellations / rating / response rate live in Trends & Guests                                                                                                                                              |
| State banner                                 | —        | —          | Removed | Former occupancy-outlook chips (Underbooked / Building / etc.) and unpaid-balance pill above the KPI grid retired; forward state assessment remains in the API bundle, PDF export, AI review, and playbook matching only                                                                                 |
| Occupancy & revenue trend                    | —        | —          | Removed | Former Overview "This period" chart retired; period KPIs remain in the strip; booking pace stays on Trends                                                                                                                                                                                               |
| Booking pace / pickup / next-90-days forward | —        | —          | Done    | Trends **New bookings** card (`BookingPaceCard`): daily/weekly created bookings vs last year. Pickup stays in API for PDF/AI/playbook                                                                                                                                                                    |
| Booking source mix                           | —        | —          | Done    | Shared donut (`AnalyticsDonutChart`): center always = total bookings; hover tooltip for source / % / count. No legend. Compact on Overview; full on Guests                                                                                                                                               |
| Listing page visits                          | —        | —          | Done    | Same donut: center always = page views; hover tooltip for referrer / % / count. Overview only when views or visitors > 0                                                                                                                                                                                 |
| Do next                                      | —        | —          | Removed | Former Overview CTA list retired; guest insights moved to Overview instead                                                                                                                                                                                                                               |
| Guests (age + origins)                       | —        | —          | Done    | **Guest age**, **Party size** (adults+children: 1–4, 5+), and **Guest origins** (max 6 distinct; last row **Others** when more exist) on Overview and Guests                                                                                                                                             |
| Lead time & length of stay                   | —        | —          | Done    | Trends: lead-time + length-of-stay histograms fill a continuous bucket range (zeros between min–max hits, padded to ≥3); hover tooltip (no bar labels). Plus Reviews & response                                                                                                                          |
| Date range control                           | —        | —          | Done    | Shared `BookingDateRangeFilter` (Week/Month/Year/Custom), `?from`/`?to` params — same as Bookings/Finance/Dashboard; default = current month                                                                                                                                                             |
| Teaser (Free/Starter)                        | —        | —          | Removed | Full dashboard is preview-open; plan gate is Export PDF / CSV + AI review generate                                                                                                                                                                                                                       |
| Empty state (new property)                   | —        | —          | Done    | Shown below 10 non-cancelled bookings ever                                                                                                                                                                                                                                                               |
| Comparison toggle (prior vs last year)       | —        | —          | Removed | On-screen toggle dropped as redundant. KPI deltas are always vs-last-period; YoY still in the bundle for PDF + AI review                                                                                                                                                                                 |
| AI Performance Review                        | —        | —          | Done    | Weekly cron + on-demand regenerate (1/hour); score dial, Working/Improve/Avoid columns. Local demo seed includes a mock latest review                                                                                                                                                                    |
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
  (`MobileHeroActionMenu`). Renders with `analytics:export`. Below Pro the click opens the
  upgrade modal (`analyticsInsights`) and a corner plan pill sits on the desktop button.

There is **no period-comparison toggle** — KPI deltas are always period-over-period ("vs last
period"). The server still returns year-over-year figures in the bundle for the PDF and the AI
review; only the on-screen toggle was removed as redundant UI.

**Date range scope:** Almost everything on this page follows the header date control (`?from` /
`?to`): KPI strip, Trends charts, Guests channel mix / age / origins, and listing visits.
Forward occupancy and pickup remain in the API bundle for PDF, AI review, and playbook only
(no dedicated Overview cards).

Inside the page body, **4 headline KPI cards** (Occupancy, Avg nightly rate, Revenue per night, Bookings).
Deltas are period-over-period. All four use muted icon wells. Each title has a small `ⓘ`
glossary tooltip. Booking lead time, cancellations, guest rating and response rate are not
headline cards.

Below that, **four section tabs** (`AnalyticsSectionTabs`): Overview · Trends · Guests · AI review.

Tabs and their contents:

1. **Overview** (`AnalyticsOverviewSection`)
   - **Guest age** / **Party size** / **Guest origins** — separate cards (histograms + ranked list).
   - **Where bookings come from** — compact channel donut (hover tooltip; no legend),
     only when the period has bookings. Includes **Direct** (website) bookings; aliases
     like `direct` / `website` roll up with `Direct`.
   - **Listing visits** — matching donut with page views in the center and referrers on hover;
     omitted when both views and visitors are 0.
   - **How you compare** — "vs Kame median" benchmark, when enough peer listings exist.
2. **Trends**
   - **New bookings** — bookings **created** in the selected range (daily when ≤45 days, else
     weekly) as a monotone area/line chart (finance-style), optional dashed last-year series.
     Toggle bookings / revenue.
   - **Lead time** — how far ahead guests booked (histogram).
   - **Length of stay** — nights per stay (histogram).
   - **Reviews & response** — horizontal bars for cancellation rate, average guest rating
     (fill vs 5 stars), and 24h inbox response rate (with glossary tooltips). Rates are 0–100.
3. **Guests**
   - **Where bookings come from** — donut by `booking_source` (includes **Direct** website
     bookings; `direct` / `website` aliases roll up together); hover tooltip for share % and count.
   - **Guest age** — age histogram for the selected range.
   - **Party size** — guests per booking (`number_of_adults` + `number_of_children`), buckets 1–4 and 5+.
   - **Guest origins** — ranked origin list (free-text from address / nationality). PH matches
     use **City, Province** (e.g. `Makati, Metro Manila`); countries stay as country names.
     Shows at most **6 distinct** origins. If there are more, the last row is **Others**
     (top 5 named + remaining share).
4. **AI review**
   - **AI Performance Review** — a score (0–100), what's working, what to improve, and what to
     avoid. Each item is grounded in the numbers above and, when relevant, cites a recent change
     (a rate update, a blocked date) that plausibly explains a metric move. Regenerates
     automatically once a week (no manual regenerate in the UI). Advisory only: it never changes
     a rate or a setting.
     Local QA: `bun run seed:analytics-demo` inserts a mock latest review for `monaco-2612`
     (model `analytics-demo`) so this card renders without waiting for the weekly cron or Gemini.
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

The page (KPI strip, Overview / Trends / Guests / AI review tabs, playbook) is **preview-open**
on every plan. `analyticsInsights` (Pro `growth` and above) gates **Export PDF** and **AI
review generation** (POST + weekly cron). `analytics-summary` always returns the full bundle
for `analytics:view`. Same action-level pattern as Finance export.

## Permission table

| Permission         | Grants                                                       |
| ------------------ | ------------------------------------------------------------ |
| `analytics:view`   | View the Analytics page (any tier)                           |
| `analytics:export` | Show the **Export PDF** button (plan still applies on click) |

Seeded role templates: Full Access → both; Operations and Read Only → `analytics:view` only;
other custom roles → none by default (configurable per org).

## States

- **Loading**: `DashboardSkeleton` (shared skeleton, KPI cards + chart placeholders).
- **Empty**: fewer than 10 non-cancelled bookings ever → "Not enough booking history yet" with
  the current count.
- **Error**: generic retry message.

## Host-facing knowledge

This page shows how this specific listing is performing for the date range you pick: occupancy,
rates, bookings, and guest mix.

**Common host questions**

- Q: What does New bookings show?
  A: How many reservations were made during your selected dates (by the day they were created),
  not by check-in. The chart shows busy vs quiet days. When we have last-year history, you also
  see that comparison.
- Q: Why does my occupancy rate look different from the Dashboard page?
  A: Analytics uses the same night-by-night calculation as the property Dashboard, but lets you
  pick a custom date range and always shows period-over-period comparison.
- Q: What does "Unknown" mean in Guest Origins / Age?
  A: Some bookings don't have a parseable address/nationality or guest age recorded — those are
  shown as their own bucket rather than silently excluded, so percentages stay honest.
- Q: What does Others mean in Guest origins?
  A: The card shows the five largest places plus one Others row when guests come from more than
  six distinct places. Others is the combined share of everything outside the top five.
- Q: Are website / Direct bookings included in Where bookings come from?
  A: Yes. Bookings made through your listing page (no Airbnb or Facebook link) count as Direct,
  alongside OTAs and social sources.
- Q: Can I download a report on Free?
  A: **Export PDF** is on Pro. The button still shows; tapping it opens Plans.
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
