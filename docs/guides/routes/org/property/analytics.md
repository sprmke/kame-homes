---
title: 'Analytics — operator guide'
status: active
tags: [guides, routes, org, property]
updated: 2026-09-27
---

# Analytics — operator guide

Route: `/org/:orgSlug/property/:propertySlug/analytics`

> **Status:** Documented — Phase 0/1/2/2b/3/4 shipped (deterministic dashboard + forward-looking
> view + YoY comparison + public page tracking + AI Performance Review + Improvement Playbook +
> Ask Analytics), Phase 5 shipped as org portfolio rollup + CSV export.
> Plan: [`../../../../workflow/for-testing/host-analytics-module.md`](../../../../workflow/for-testing/host-analytics-module.md)

## Progress overview

| Section                                      | E2E save | Validation | Docs    | Notes                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------- | -------- | ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section tabs                                 | —        | —          | Done    | Overview / Trends / Guests / AI review (`AnalyticsSectionTabs`)                                                                                                                                                                                                                                                                                                            |
| KPI strip                                    | —        | —          | Done    | **4 headline cards** — Occupancy, Avg nightly rate, Revenue per night, Bookings. Lead time / cancellations / rating / response rate live in Trends & Guests                                                                                                                                                                                                                |
| State banner                                 | —        | —          | Removed | Former occupancy-outlook chips (Underbooked / Building / etc.) and unpaid-balance pill above the KPI grid retired; forward state assessment remains in the API bundle, PDF export, AI review, and playbook matching only                                                                                                                                                   |
| Occupancy & revenue trend                    | —        | —          | Removed | Former Overview "This period" chart retired; period KPIs remain in the strip; booking pace stays on Trends                                                                                                                                                                                                                                                                 |
| Booking pace / pickup / next-90-days forward | —        | —          | Done    | Trends **New bookings** card (`BookingPaceCard`): daily/weekly created bookings vs last year. Pickup stays in API for PDF/AI/playbook                                                                                                                                                                                                                                      |
| Booking source mix                           | —        | —          | Done    | Shared donut (`AnalyticsDonutChart`): center always = total bookings; hover tooltip for source / % / count. No legend. Always on Overview (compact) and Guests; empty donut when no bookings                                                                                                                                                                               |
| Listing page visits                          | —        | —          | Done    | Same donut: center always = page views; hover tooltip for referrer / % / count. Always on Overview (empty when no views)                                                                                                                                                                                                                                                   |
| Do next                                      | —        | —          | Removed | Former Overview CTA list retired; guest insights moved to Overview instead                                                                                                                                                                                                                                                                                                 |
| Guests (age + origins)                       | —        | —          | Done    | **Guest age**, **Party size** (adults+children: 1–4, 5+), and **Guest origins** (max 6 distinct; last row **Others** when more exist) on Overview and Guests                                                                                                                                                                                                               |
| Lead time & length of stay                   | —        | —          | Done    | Trends: lead-time + length-of-stay histograms fill a continuous bucket range (zeros between min–max hits, padded to ≥3); hover tooltip (no bar labels). Plus Reviews & response                                                                                                                                                                                            |
| Date range control                           | —        | —          | Done    | Shared `BookingDateRangeFilter` (Week/Month/Year/Custom), `?from`/`?to` params — same as Bookings/Finance/Dashboard; default = current month                                                                                                                                                                                                                               |
| Teaser (Free/Starter)                        | —        | —          | Removed | Full dashboard is preview-open; plan gate is Export PDF / CSV + AI review generate                                                                                                                                                                                                                                                                                         |
| Empty state (new property)                   | —        | —          | Done    | Shown below 10 non-cancelled bookings ever                                                                                                                                                                                                                                                                                                                                 |
| Comparison toggle (prior vs last year)       | —        | —          | Removed | On-screen toggle dropped as redundant. KPI deltas are always vs-last-period; YoY still in the bundle for PDF + AI review                                                                                                                                                                                                                                                   |
| AI Performance Review                        | —        | —          | Done    | Cron (current month) + on-demand Analyze/Refresh (1/day per week, month, or year). Only the **current** Manila week/month/year; custom or shifted ranges show N/A. CTA follows the selected range; mismatched latest review does not render. Generating stage while POST runs. Plan `analyticsInsights` + leaf `analytics.aiReview:add`. Local demo seed for `monaco-2612` |
| Improvement Playbook                         | —        | —          | Done    | `PlaybookList`, matched via `_shared/hostPlaybook.ts` against the bundle, 17 seeded articles + super-admin CRUD. Single-open accordion; an AI review `Playbook:` tip expands the matching article. `@ci` spec `ui/e2e/features/analytics/aiReviewPlaybook.spec.ts`                                                                                                         |
| Ask Analytics (AI Assistant integration)     | —        | —          | Done    | `get_property_analytics` + `explain_metric` Tier-0 read tools stay available via the global assistant FAB. The dedicated **Ask AI** toolbar button was **removed** (2026-09-10) — it opened the generic assistant with no analytics scope, so it added little over the glossary tooltips + AI review tab                                                                   |
| PDF export                                   | —        | —          | Done    | Client-side jsPDF report (state, KPIs, channel/origins, AI review, Playbook); gated by `analytics:export`                                                                                                                                                                                                                                                                  |
| Org portfolio rollup + export                | —        | —          | Done    | `/org/:orgSlug/analytics` — see [`../analytics.md`](../analytics.md)                                                                                                                                                                                                                                                                                                       |

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
   - Two 3-column rows; every card always renders (empty body when no data).
   - **Guest age** / **Party size** / **Guest origins** — separate cards (histograms + ranked list).
   - **Where bookings come from** — compact channel donut (hover tooltip; no legend). Includes
     **Direct** (website) bookings; aliases like `direct` / `website` roll up with `Direct`.
   - **Listing visits** — matching donut with page views in the center and referrers on hover
     (empty donut when views are 0).
   - **How you compare** — "vs Kame median" benchmark; dashed empty state when peer sample is
     too small.
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
     (a rate update, a blocked date) that plausibly explains a metric move. Advisory only: it
     never changes a rate or a setting.
     **Period gate:** only the **current** week, month, or year (Asia/Manila) is applicable.
     Custom ranges and ←/→ shifts to other weeks/months/years show **Current period only** (no
     review body, no Analyze/Refresh). Detection: `analytics/lib/aiReviewPeriod.ts` (client) mirrors
     `_shared/analyticsAiReviewPeriod.ts` (server).
     **Analyze / Refresh:** header CTA tracks the selected current period. When the latest review’s
     `period_start`/`period_end` match the filter → **Refresh** (or **Refreshed** after a success
     today). When they do not match (or there is no review) → **Analyze this week|month|year** and
     the card body stays empty for that range (never shows another period’s review). While POST is
     in flight, the body swaps to `AiPerformanceReviewGeneratingStage` (aurora + cycling status).
     Rate limit: **once per Manila day per period kind** (`propertyId:week|month|year`). Requires
     `analytics.aiReview:add` + `analyticsInsights` (`TierBadgeAnchor` / upgrade modal). **Analyze /
     Refresh is disabled** when `sufficiency.enough` is false (fewer than 10 non-cancelled bookings
     ever), matching the AI review cron skip, so hosts are not pushed into rate-limit or AI-down
     toasts on sparse history. POST
     `analytics-ai-review?from&to` with the selected current period; server rejects non-current
     ranges (400). Weekly cron still regenerates entitled properties using the **current calendar
     month**.
     Layout: a **summary band** (score dial + headline + "vs last review" delta) spans the full
     card width, with **Working / Improve / Avoid** below it as three bordered panels
     (`lg:grid-cols-3`; stacked below `lg`).
     Each actionable item is a **read → do → go** stack: title + evidence first, then a quiet
     footer (hairline divider) with the recommendation, a named deep link (`Go to Pricing`, from
     `analytics/lib/aiReviewDeepLink.ts`, falling back to `Go there`), and a secondary playbook tip
     (text button, not a filled chip). Working items that have no next step omit the footer.
     Local QA: `bun run seed:analytics-demo` inserts a mock latest review for `monaco-2612`
     (model `analytics-demo`) so this card renders without waiting for the weekly cron or Gemini,
     and seeds `platform_analytics_benchmark_cache` so **How you compare** has a peer sample.
   - **Improvement Playbook** — expandable tip cards, matched against this property's current
     numbers (occupancy state, response rate, channel concentration, etc.) from a curated
     17-article seed set. Not personalized by AI — a deterministic condition matcher.
     Super admins manage the article catalog at `/admin/playbook`.
     One article is open at a time. The open article is owned by `PropertyAnalyticsPage`, so a
     `Playbook:` tip in the AI review above **expands** the matching card, moves focus to its
     disclosure button, and scrolls it into view (`analytics/lib/playbookReveal.ts`). Clicking the
     same tip again re-scrolls rather than collapsing. Article bodies are authored as plain text
     and rendered with preserved line breaks.

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

| Permission               | Grants                                                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `analytics:view`         | View the Analytics page (any tier)                                                                                                                                                |
| `analytics:export`       | Show the **Export PDF** button (plan still applies on click)                                                                                                                      |
| `analytics.aiReview:add` | Show **Analyze / Refresh** and call `POST analytics-ai-review` (spends AI credits; `analyticsInsights` plan still applies). Viewing a matching review needs only `analytics:view` |

Seeded role templates: Full Access → all three; Operations and Read Only → `analytics:view` only;
other custom roles → none by default (configurable per org).

## States

- **Loading**: `DashboardSkeleton` (shared skeleton, KPI cards + chart placeholders).
- **Sparse / empty period**: full layout still renders (KPIs, tabs, charts). Values and series
  may be zeros or empty when there is little booking history; no full-page "not enough history"
  gate. Chart cards with no signal use a **dashed empty body** (no axis labels or zero-filled
  bars) so empty Overview / Trends cards stay readable. AI review cron still skips properties
  with fewer than 10 non-cancelled bookings ever (`sufficiency.enough`). Regression: `@ci`
  "renders the full dashboard with little booking history" in
  `ui/e2e/features/analytics/aiReviewPlaybook.spec.ts`.
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
- Q: What does How you compare mean?
  A: It shows your occupancy and average nightly rate against the median of other active Pro
  listings on Kame (not named competitors). It stays empty until enough peer listings have
  bookings in the same kind of period, so one or two other hosts are never exposed as "the
  market."
- Q: Does the AI review change my rates or settings?
  A: No. It's advisory only. It can suggest an action (e.g. raise your weekend rate) but never
  applies one. You'd still make that change yourself on the Pricing page.
- Q: What do the "Playbook:" tips under a suggestion do?
  A: They open the matching tip in the Improvement Playbook card below and scroll you to it, so
  you can read the how-to without hunting for it.
- Q: Why does the AI review say Current period only?
  A: AI review only covers the current week, month, or year. Switch the date filter back to
  this week, this month, or this year.
- Q: How often can I analyze the AI review?
  A: Once a day for each of this week, this month, and this year. After you analyze a range, that
  button shows Refreshed until tomorrow. A weekly background pass also updates Pro listings for
  the current month.
- Q: I switched from month to week and the review disappeared. Why?
  A: The last review was for a different range. Use **Analyze this week** to generate one for the
  week you have selected.
- Q: Why does analyze sometimes say it's unavailable?
  A: You can analyze each range once a day. If the AI service is briefly unreachable it keeps
  your last review instead of erroring.
- Q: Where did the "Ask AI" button go?
  A: It was removed — it just opened the general assistant without focusing it on this page. For
  a plain-language explanation of any metric, hover the small ⓘ next to its name; for a written
  assessment of the whole property, use the **AI review** tab. You can still open the assistant
  from the sparkle button in the corner and ask about this listing.
