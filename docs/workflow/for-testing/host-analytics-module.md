---
stage: for-testing
title: 'Host Analytics module — performance insights + AI coaching'
status: in-progress
tags: [planning, planned-modules, analytics, ai, plans, rbac, dashboard]
updated: 2026-09-15
---

# Host Analytics module — performance insights + AI coaching

## Goal

Give hosts a dedicated **Analytics** page in the dashboard that turns their own booking
history into decisions: see how the listing is performing now, compare it to the previous
period **and** the same period last year, look forward at what is already on the books for
the next 90–180 days, and — AI-first — get a plain-language review of **what is working**,
**what to improve** (with a concrete action + deep link), and **what to stop doing**, plus a
curated playbook of tips and tutorials matched to the gaps the data shows. Rather than only
flagging problems, the module classifies where the listing actually stands right now — from
underbooked through fully booked, and independently whether upcoming bookings have
collections at risk — and gives state-appropriate guidance either way: a fully booked listing
gets a yield nudge to raise rates, not silence; an underbooked one gets a pricing/marketing
gap check; a listing with unpaid balances due soon gets a collections nudge regardless of how
full the calendar looks. The full module (deterministic analytics + all three AI surfaces) is
a **Pro-tier paid capability**; Free and Starter see a teaser with an upgrade CTA.

## Implementation status (2026-09-09)

**Shipped: all of Phases 0–5.** Phase 0 (foundation, gating, deterministic service), Phase 1
(property analytics page), Phase 2 (forward-looking: booking pace, next-N-days, YoY comparison
toggle), Phase 2b (public page tracking + monthly pruning cron), Phase 3 (AI Performance Review
— weekly cron + on-demand regenerate), Phase 4 (Improvement Playbook + super-admin CRUD at
`/admin/playbook` + `improvements[].articleSlugs` linking + **Ask Analytics** — `get_property_analytics`
/ `explain_metric` Tier-0 tools on the AI Dashboard Assistant), Phase 5 (org portfolio rollup +
CSV export gated by `org.analytics:export`, property-level PDF export gated by `analytics:export`,
and the privacy-guarded platform benchmark). See the Phase 4/5 task lists below for exact files.

**Still not built:** `_shared/analyticsService_test.ts` / `analyticsAiReview_test.ts` (no Deno
runtime in this environment — flagged, not attempted); a full Playwright/manual browser
walkthrough (kept out of scope for this pass per explicit instruction — API-level and, for the
new pieces below, direct edge-function verification only). Nothing else from the original plan
remains unbuilt.

### Overview polish pass (2026-09-13) — host review feedback

- **Overview is chart-first.** Occupancy/revenue for the selected period moved onto Overview
  (`This period`). Trends keeps booking pace + lead time / length of stay.
- **Past vs ahead are labeled.** KPI occupancy shows `X of Y nights` for the date range. Next
  90 days is a stacked card (bar + confirmed revenue + open nights), not three equal metrics
  that mixed pickup into a forward window.
- **State chips removed** (2026-09-15): on-screen occupancy-outlook / unpaid-balance pills above
  the KPI grid retired; `stateAssessment` still powers PDF, AI review, and playbook matching.
- **Do next** (`AnalyticsNextActionsCard`): removed; former CTA list retired with the overview
  polish pass.
- **Empty listing visits omitted** instead of a full zero card. Compact channel mix on Overview
  when the period has bookings.
- **Page subtitle removed** (no duplicate story above the KPI grid).
- **AI review demo seed** (2026-09-15): `bun run seed:analytics-demo` now inserts a mock latest
  `property_analytics_reviews` row (`model = analytics-demo`) for monaco-2612 so the AI review
  tab can be QA'd locally without Gemini or the weekly cron.

### Overview polish pass (2026-09-10) — host review feedback

- **State banner → compact one-line strip** (`AnalyticsStateBanner`): the full-width tinted
  callout box became a single status row above the KPI grid — colored dot + forward-occupancy
  label + short clause (full sentence on hover); the balance segment shows only when the state
  isn't `clear`.
- **KPI strip trimmed 8 → 4** (`AnalyticsKpiStrip`): Occupancy · Avg nightly rate · Revenue per
  night · Bookings only, matching the 4-up `StatCard` grid on Bookings/Finance/Dashboard. Lead
  time, cancellations, guest rating and response rate remain in the Trends/Guests tab cards, the
  PDF and the AI review.
- **Chart empty states** (`GuestInsightsCard` guest-age, `LeadTimeLosCard` both histograms):
  render the chart footprint — a zeroed axis or faint dashed baseline with a small caption
  ("No data for this range yet") — instead of replacing the panel with a line of text. Guest
  origins shows placeholder bars + caption. `ChannelMixCard` already did this (ghost donut).
- **"Ask AI" toolbar button removed** (`PropertyAnalyticsPage`): it called `openAiAssistant()`
  with no analytics scope, so it added little over the `ⓘ` glossary tooltips + the AI review
  tab. `get_property_analytics` / `explain_metric` stay reachable via the global assistant FAB.
  A _scoped_ "explain this page" action (pre-seeded prompt + context) is a possible follow-up.

### Self-review pass (2026-09-09)

Ran the repo's `/self-review` skill against this module. Verdict was **"Ship with fixes"** —
every P1/P2 finding was then fixed in the same session, and (unlike the initial build) this
pass had a **live local Supabase stack available** (Docker was up; a pre-existing local
migration-history drift unrelated to this module was resolved via `supabase migration repair
--local`, then all 5 of this module's migrations were applied and verified against real seeded
data — 73-booking and 325-property test fixtures already in the local DB).

**Live-verified, not just statically reviewed:**

- All 5 migrations apply cleanly (`host_analytics_foundation`, `property_page_views`,
  `analytics_review_notification_type`, `analytics_ai_review_cron`, plus the two added during
  this fix pass) — correct resulting schema, correct seed data (17 playbook articles, correct
  `analyticsInsights` flag per plan tier).
- `analytics-summary` end-to-end against a real 73-booking property: KPIs, trend, distributions,
  forward view, booking pace, state assessment, and Playbook matching all computed correctly and
  produced _semantically sensible_ output (e.g. a `fully_booked` property correctly surfaced the
  "raise rates" and "collect outstanding balances" playbook articles, not generic ones).
- `analytics-ai-review` GET (empty state) and POST (gracefully degrades to
  `{ available: false }` with no Gemini key configured locally, exactly per the "never fails
  loud" contract) both verified.
- `analytics-org-summary` against a real 325-property org (capped at 200): correct portfolio
  rollup math, correct per-property rows.
- `property-page-view`: valid insert, invalid-property silent no-op, missing-field 400 — all
  three paths verified.
- `analytics-ai-review-cron`: found and fixed a **real bug** this way — the candidate query had
  no `ORDER BY`, so "oldest-reviewed-first" batch selection was non-deterministic before any
  review had ever been generated (every property ties on `null`). Fixed with an explicit
  `.order('id')`; before/after re-run confirmed the fix changes which properties get processed.
- Rate limiting (`analytics-ai-review` 1/hour, `property-page-view` 1/30s) could **not** be
  verified — the `request_rate_limits` table doesn't exist in this local DB yet (unrelated
  pre-existing migration drift, out of scope for this module). Confirmed the documented
  fail-open behavior triggers correctly when the table is missing, which is a real signal but
  not proof the limit itself works once that table exists.
- `property-page-views-prune-cron` (added during this fix pass) could **not** be invoked locally
  — new edge functions need a `functions serve`/edge-runtime restart to become routable, and
  this session did not restart the user's already-running (23h-uptime) local stack without
  asking. Code follows the exact same proven pattern as the two crons that _were_ verified live.

**Fixed as a direct result of the self-review** (see the doc's git history / diff for exact
locations): a dead, unenforced `analytics:export` RBAC leaf (added `org.analytics:export`,
wired to the CSV button, documented the property-level leaf as intentionally reserved); a
missing `ai-assistant-parity.mdc` exclusion entry; two stale/missing workflow index rows
(`planned/README.md` still listed this as "not started", `in-progress/README.md` had no entry
at all); a non-transactional `is_latest` race between the cron and manual regenerate (now
handled via a shared `writeLatestAnalyticsReview` helper that treats a unique-violation as
"another writer won this property" instead of a hard error); duplicated occupancy-state
threshold logic between the property and org code paths (extracted to shared functions); two
unused function parameters; a harmless-but-meaningless leftover CHECK constraint (dropped via a
new migration, applied and verified); a confusing 402 error message on the org page for the
legitimate "org has Pro but zero properties are enrolled in it" case; and a missing gap-night
deep link on the property page's forward-looking card.

Verification evidence: `bun run ci:quality` (type-check + lint + filenames + build) clean after
every change in both the original build and this fix pass — plus, for the first time, real
edge-function execution against a live local Supabase stack (see above). **Still not done:**
a UI walkthrough in an actual browser (Playwright or manual) — the API layer is now genuinely
verified, but no screen has been visually confirmed to render correctly against real data.

## Scope

### In

- New property-scoped module `features/dashboard/analytics/` at
  `/org/:orgSlug/property/:propertySlug/analytics` (new `PropertySection` `'analytics'`).
- Deterministic metrics service (`_shared/analyticsService.ts`) computed on-read from
  `guest_submissions` + `guest_reviews`: occupancy, ADR, RevPAR, revenue/net, booking pace
  ("on the books"), pickup, lead time / booking window, length-of-stay mix, channel/source
  mix, cancellation rate, rating trend, repeat-guest rate — each with **period-over-period**
  and **year-over-year** deltas, plus a **forward 90/180-day** on-the-books view with unbooked
  high-value gap nights.
- **Guest demographics & origins**: age distribution (bucketed `primary_guest_age` /
  `guest2..5_age`, explicit "unknown" bucket for sparse data) and a **Guest Origins** ranked
  list — free-text keyword/substring bucketing of `guest_address` + `nationality` into
  city/region/country buckets (e.g. "Manila 34%, Cebu 12%, Unknown 18%"). No map, no
  geocoding — there's no lat/lng/city column on `guest_submissions` today, so this is a
  ranked list, not a map; revisit as a real map only if structured location data is ever
  captured.
- **Guest responsiveness**: avg first-response time and 24h-response rate, rolled up from
  `inbox_thread_metrics` (Guest Inbox), alongside the booking KPIs — response speed is a
  known driver of conversion and belongs next to occupancy/ADR, not buried in the Inbox
  module.
- **Two-axis state assessment**, computed each time the bundle is built (not a separate
  table): (1) **forward occupancy state** — `underbooked` / `building` / `strong` /
  `fully_booked`, from the booked-nights ratio over the next 30/60 days relative to the
  property's own trailing baseline (not a fixed global threshold — occupancy that's "strong"
  for one property type is weak for another); (2) **balance-collection state** — `clear` /
  `attention_needed` / `at_risk`, from upcoming (unsettled, non-cancelled) bookings with
  `balance > 0` weighted by proximity to check-in. Surfaced as a compact banner in the KPI
  strip and passed as explicit context into the AI Performance Review prompt so its
  `improvements[]` / `avoid[]` are state-appropriate (yield guidance when fully booked,
  pricing/marketing gap-check when underbooked, a collections nudge whenever balance risk is
  present — independent of how full the calendar looks).
- **Public page performance** (new infrastructure — no view/visit tracking exists anywhere
  in the app today): a minimal first-party pageview log (`property_page_views`) capturing
  view count, a client-generated session id (unique-visitor approximation), referrer/UTM, and
  device class from the public guest-facing property route. Deliberately minimal — view
  counts and top referrers, not a full impressions→CTR funnel — since this is genuinely new
  scope, not new charts on existing data.
- Three AI surfaces, all on the existing Gemini router + AI-quota + credit model:
  1. **AI Performance Review** — weekly cron + on-demand `analytics-ai-review`; structured
     `strengths` / `improvements` / `avoid` with impact estimate, specific action, and an
     in-app deep link; stored in `property_analytics_reviews`; Notification Center ping on a
     material score change. Advisory only — never mutates a rate or setting.
  2. **Ask Analytics** — a Tier-0 read tool added to the **existing AI Dashboard Assistant**
     (`get_property_analytics` / `explain_metric`), not a second chat. "Ask about these
     numbers" on the page opens the assistant with the analytics context pinned.
  3. **Improvement Playbook** — seeded `host_playbook_articles` (curated tips/tutorials:
     pricing, photos, amenities, response time, min-stay, promos, calendar hygiene, review
     replies); the AI review's `improvements[]` link to the relevant article(s).
- Plans gating: new `PlanFeatureKey` **`analyticsInsights`** (Pro `growth` / Business `pro` /
  Managed). Full end-to-end: seed migration, both `planFeatures.ts`, `useFeatureGate` +
  `requirePropertyFeature`, feature matrix, `planPresentation` compare row + tier-card gain,
  public `/for-hosts/pricing`.
- Team RBAC: new leaves `analytics:view` + `analytics:export` (property) and mirror
  `org:analytics:view` — catalog, server allow-list, seeded role templates, nav + route +
  edge gates.
- Org portfolio rollup `/org/:orgSlug/analytics` (per-property leaderboard + portfolio KPIs)
  and CSV/PDF export — Phase 5.

### Out (explicitly)

- **Parking analytics** — parking is a separate vertical with simpler economics; a
  `parking/.../analytics` mirror is a later follow-up, noted at the end.
- **External market / comp-set data** (AirDNA-style) — no third-party data purchase. The
  in-scope substitute — a privacy-guarded "vs Kame median" benchmark built from platform
  aggregate, behind an 8-peer minimum-sample threshold — **shipped in Phase 5**
  (`computePlatformBenchmark`); this bullet only excludes buying real third-party market data.
- A separate analytics chatbot — reuse the AI Dashboard Assistant.
- Real-time streaming metrics — analytics is daily-grain, cache-friendly.
- `analytics_daily_rollup` perf table — Phase 6, only if on-read aggregation shows strain.

## Competitive UX brief — host analytics

**Job:** host wants to understand listing performance and know what to change to get more
bookings. **Role:** operator (host / co-host).

- **Guesty Advanced Analytics** — switchable dashboards (Revenue YoY, **Pace Report** =
  current year vs same day last year for revenue / ANR / booked days, Reservations breakdown
  by channel/status/LOS), a **custom report builder**, an **AI data-analysis agent** that
  surfaces insights on request, and downloadable reports gated to the premium tier (Standard
  vs Advanced Analytics).
- **Hostaway** — real-time Occupancy, ADR, **RevPAR**, channel mix, **booking pace**, owner
  payouts, profitability / net income, income forecast; custom dashboard widgets on Pro.
- **PriceLabs Portfolio Analytics** — revenue, occupancy, ADR, RevPAR, **booking pace**,
  **booking pickup**, lead time, LOS, all **paced against last year**, per listing / group /
  portfolio; separate Market Dashboards for competitive context; group sandbox to test a
  strategy change before applying.
- **Airbnb host Insights** — Views→conversion, search visibility, response rate; Occupancy &
  Rates with **366 days past + 180 days future**; a free **competitor set** showing above/
  below the 50th percentile; everything framed as "every dip is an opportunity".
- **Lodgify** — occupancy / revenue / booking trends, filter by property / date / channel,
  owner statements.
- **Hospitable Copilot** — conversational AI with access to bookings, reviews, tasks,
  calendar: "ask a simple question, get an actionable insight."

### Adopt for Kame Homes

- Standard KPI vocabulary: **Occupancy, ADR, RevPAR, Revenue/Net, Booking pace, Pickup,
  Lead time, LOS, Channel mix, Cancellation rate, Rating**. Hosts and any PMS-savvy user
  expect these exact names.
- **Dual comparison**: previous period _and_ same period last year (Guesty Pace Report +
  PriceLabs pacing). A single comparison toggle.
- **Forward-looking on-the-books** panel (Airbnb 180-day future, PriceLabs pace/pickup):
  next-90/180-day occupancy already booked, revenue on the books, high-value gap nights.
- **"Opportunity" framing** for the AI review — strengths / improvements / avoid, each with
  a concrete next step, mirroring Guesty's AI agent + Hospitable Copilot but as a persistent
  card, not only a chat.
- **Premium gate** on the full module (Guesty Advanced Analytics, Hostaway Pro widgets,
  PriceLabs market layer). Teaser for Free/Starter.
- **Ask about these numbers** → the existing assistant (Hospitable Copilot pattern) instead
  of a bespoke report builder — lower build cost, already has tools/quota/safety/blocks.

### Adapt / skip

- No competitor-set / market data at launch (no third-party data spend); optional
  platform-aggregate benchmark later with a privacy floor.
- No custom report builder — fixed, well-chosen sections + assistant Q&A + CSV export.
- Minimal copy (`minimal-ui-copy`), `Asia/Manila`, PHP, mobile-first — house rules.
- Compute on-read from `guest_submissions` (low per-listing booking volume); no rollup table
  until proven necessary.

## Approach

### Placement & tiers of the surface

| Surface             | Route                                            | Phase | Notes                                                  |
| ------------------- | ------------------------------------------------ | ----- | ------------------------------------------------------ |
| Property Analytics  | `/org/:orgSlug/property/:propertySlug/analytics` | 1     | primary build                                          |
| Public page tracker | (public property route, no admin route)          | 2b    | ingest + `PublicPagePerformanceCard` on the page above |
| Org portfolio       | `/org/:orgSlug/analytics`                        | 5     | leaderboard + portfolio KPIs + export                  |
| Parking             | —                                                | later | separate follow-up, not in this plan                   |

### Data model

**Fact source:** `guest_submissions` (property bookings) + `guest_reviews` (ratings). No new
booking fields needed. Key columns already present: `check_in_date` / `check_out_date`
(text `MM-DD-YYYY` → normalize with `_shared/utils.ts`), `number_of_nights`, `booking_rate`,
`down_payment`, `balance`, `security_deposit`, `guest_additional_fee`, `status`,
`created_at` (reservation timestamp → lead time + pace), `booking_source` /
`booking_booking_channel` / `external_source` / `find_us` (channel/source mix —
**Direct** website bookings included; `direct` / `website` aliases canonicalized via
`_shared/analyticsChannel.ts`),
`number_of_adults` / `number_of_children`, `status_updated_at`, `settled_at`. Money helpers
reuse `_shared/bookingFinance.ts`; cancellation logic reuses `_shared/superhostMetrics.ts`
(incl. the OTA feed-drop exclusion).

**New tables**

- `property_analytics_reviews` — one row per generated AI review (pattern:
  `superhost_assessment_runs`). Columns: `id`, `property_id` (FK, cascade), `organization_id`
  (FK, cascade), `period_start` / `period_end` (date), `generated_at`, `generated_by`
  (nullable — null = cron), `model`, `headline` text, `score` int (0–100), `score_delta`
  int, `payload` jsonb `{ strengths[], improvements[], avoid[], metricsSnapshot }`,
  `is_latest` bool. Indexes: `(property_id, generated_at desc)`, partial `(property_id) where
is_latest`. RLS on, `GRANT ALL … service_role` (edge-gated, like every other table).
- `host_playbook_articles` — `id`, `slug` unique, `category` text, `title`, `body_md`,
  `applies_when` jsonb (metric-condition matcher the AI/deterministic picker reads, e.g.
  `{ metric: "occupancy", op: "lt", value: 0.5 }`), `sort_order`, `is_active`. Seed ~15–20
  curated articles in the migration. Super-admin CRUD reuses the help-center-FAQ admin
  pattern (Phase 4).
- Seed migration adds `analyticsInsights: true` to `pricing_plans.features` for `growth`,
  `pro`, `managed` (mirrors `20261213120300_calendar_sync_plan_feature.sql`).
- `property_page_views` — minimal first-party pageview log, new infra (Phase 2b). `id`,
  `property_id` (FK), `viewed_at`, `session_id` (client-generated, localStorage, no PII),
  `referrer_host`, `utm_source`/`medium`/`campaign`, `device_class`
  (`mobile`/`tablet`/`desktop`, derived server-side from UA — raw UA not stored), `is_bot`
  (basic UA filter, excluded from unique-visitor counts). High-volume append-only; queried
  on-read the same way as everything else in this module (grouped count over the requested
  range) rather than its own rollup table — consistent with the "no rollup until proven
  necessary" decision below. Pruned after ~180 days (a small follow-up cron, not blocking
  Phase 2b). Insert path is `servePublic`, unauthenticated, `navigator.sendBeacon` from the
  client — minimum possible work, never blocks public page render.

**Optional later:** `analytics_daily_rollup` (property_id, date, nights_booked,
nights_available, revenue, reservations_made, page_views) + backfill + incremental cron —
Phase 6, only if profiling shows on-read aggregation (bookings **or** page views) is too slow
at scale.

### Metrics service — `supabase/functions/_shared/analyticsService.ts`

Pure functions + a loader, styled after `dashboardService.ts` / `superhostMetrics.ts`
(unit-tested with Deno). Produces one `AnalyticsBundle`:

- **KPIs** (period, prior-period, same-period-last-year): occupancy %, ADR, RevPAR, gross
  revenue, net profit, reservations, nights booked, avg lead time, cancellation rate, avg
  rating, repeat-guest %. Each carries `value`, `changePctVsPrior`, `changePctVsLastYear`.
- **Trend series** — daily/weekly/monthly buckets (reuse `dashboardService.ts` bucketing) of
  occupancy, ADR, revenue.
- **Booking pace** — for the trailing + next few months, cumulative reservations & revenue
  "as of N days before month start" vs the same curve last year (the Guesty Pace Report).
- **Pickup** — net new reservations in the last 7 / 30 days for future check-ins.
- **Distributions** — LOS histogram, lead-time histogram, channel/source mix, pax mix, guest
  age histogram (explicit "unknown" bucket), Guest Origins ranked list (free-text bucketed
  `guest_address` + `nationality`).
- **Guest responsiveness** — avg first-response minutes, 24h-response rate (from
  `inbox_thread_metrics`), with the same period-over-period delta as the booking KPIs.
- **Public page performance** (Phase 2b) — page views, unique visitors (session-id based),
  top referrers, over the selected range, from `property_page_views`.
- **Forward** — next 90 / 180 days: nights already booked, occupancy on the books, revenue
  on the books, list of unbooked nights above a value threshold ("gap nights").
- **State assessment** — `forwardOccupancyState` (`underbooked`/`building`/`strong`/
  `fully_booked`, from the forward 30/60-day booked-nights ratio vs the property's own
  trailing-90-day baseline) and `balanceCollectionState` (`clear`/`attention_needed`/
  `at_risk`, from upcoming unsettled bookings with outstanding balance weighted by proximity
  to check-in, excluding cancelled/settled bookings). Not persisted separately — computed
  fresh into the bundle and passed as explicit AI-review context so recommendations match the
  property's actual current state instead of a generic template.
- **Data-sufficiency flags** — per section `sampleSize` + `enough` bool (gate the UI like
  superhost sample-size gating; "analytics unlock after ~10 completed stays").

### AI design (AI-first)

New `AiFeature` **`host_analytics`** in `_shared/aiModelRouter.ts` (`flash` tier — structured
JSON, multi-field reasoning; same class as `smart_pricing`). All three surfaces:

1. **AI Performance Review** (`analytics-ai-review` fn + `_shared/analyticsAiReview.ts`) —
   input: the `AnalyticsBundle` (**including the state-assessment axes**) + property context
   (amenities, pricing config, min-stay, review themes, plan) + the relevant `activity_log`
   rows for the period (rate changes, blocked-date edits, public-page publishes) so the model
   can explain _why_ a metric moved instead of describing it generically. Gemini returns a
   fixed JSON schema:
   `{ headline, score, scoreDelta, strengths[{title, evidence}],
improvements[{title, why, action, expectedImpact, deepLink}],
avoid[{title, why, deepLink}] }`, where `evidence`/`why` should cite the specific numbers and,
   when relevant, the specific `activity_log` event/date that explains the change — this is
   what keeps every recommendation state-appropriate: a `fully_booked` property gets a
   rate-increase suggestion in `improvements[]`, not an occupancy-boosting one; a property
   with `balanceCollectionState = at_risk` always gets a collections item in `improvements[]`
   or `avoid[]` regardless of how strong occupancy looks. Pattern is `smartPricingAi.ts`
   verbatim: `assertOrgAndPropertyAiQuota('host_analytics')` → generate → `recordAiUsage` → on
   any failure (no keys / quota / kill switch / bad JSON) return `null` and the card shows the
   deterministic bundle only (state banner + KPIs still render — the feature never goes
   blank). **Never writes** a setting. `deepLink` values are resolved server-side from a
   small allow-list of route builders (pricing, calendar-sync, marketing, public-pages,
   settings) so the model can't emit arbitrary URLs.
2. **Ask Analytics** — `_shared/dashboardAssistantAnalyticsTools.ts`: Tier-0 read tools
   `get_property_analytics({ period })` and `explain_metric({ metric })` returning the bundle
   - a `chart` block. Registered in `dashboardAssistantTools.ts`; gated by
     `requirePropertyFeature('analyticsInsights')` inside the tool (like `calendarSync` tools
     in `dashboardAssistantOpsTools.ts`). Page CTA "Ask about these numbers" opens the panel
     via `ai-assistant/lib/assistantOpenStore.ts` with the analytics page pinned as context.
3. **Improvement Playbook** — deterministic matcher (`applies_when` vs the bundle) proposes a
   candidate set; the AI review's `improvements[]` reference article slugs so the list is
   ordered by what actually matters for this listing. Articles render as expandable cards
   with a "Do this" deep link.

**Weekly cron** `analytics-ai-review-cron` (`serveCronPost`, hosted `pg_cron` + `pg_net`):
for each active property on a Pro+ org with `enough` data, regenerate the review, set
`is_latest`, and if `abs(scoreDelta) >= threshold` emit a Notification Center event
(`analyticsReviewUpdated`) via `notificationService.ts`. On-demand **Regenerate** button →
`analytics-ai-review` POST, rate-limited 1 / hour / property (reuse the durable rate limiter
from `_shared/requestRateLimits` or the settings-verification pattern).

### Plans + Team RBAC (mandatory decision)

| Control       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plans**     | **YES.** New `PlanFeatureKey` `analyticsInsights`, entitled on `growth` (Pro) / `pro` (Business) / `managed`. Free + Starter get a **teaser**: the KPI strip with period-over-period only (data the dashboard already exposes) + a locked "Insights, pace & AI review" panel with an upgrade CTA. Full bundle, forward-looking, all 3 AI surfaces, and export require the entitlement. AI surfaces additionally consume `aiMonthlyCreditAllowance` (double-gated, like Smart Pricing). Rationale: analytics + AI coaching is the classic "grow revenue" upsell and belongs with Smart Pricing / calendar sync / marketing studio, which are already Pro+. |
| **Team RBAC** | **YES.** New property leaves `analytics:view` (see the page) and `analytics:export` (CSV/PDF). Org mirror `org:analytics:view` for the portfolio page. Seeded: owner + co-host → view + export; manager → view; others → none by default (configurable). Nav item hidden without `analytics:view`; `RequirePropertyPermission`; `resolveScopedPropertyAccess(req, 'analytics:view')` on `analytics-summary`, `:export` on `analytics-export`.                                                                                                                                                                                                             |

### UI

`features/dashboard/analytics/` — `components/ hooks/ lib/ pages/ routes/`. `AnalyticsPage`
composed of section cards (reuse `recharts`, `ui/src/lib/charts/` palette + styles,
`ui/src/components/charts/`, shadcn, TanStack Query):

1. **Controls** — date-range preset (This month / Last 30d / QTD / YTD / Last 12mo / custom)
   - comparison toggle (Previous period ↔ Same period last year).
2. **State banner** — the two-axis state assessment (forward occupancy state + balance-
   collection state) as a compact, plain-language callout above the KPI strip (e.g. "Fully
   booked through Nov — a good time to raise weekend rates" / "3 upcoming bookings have
   unpaid balances due within 7 days"). Always visible, independent of the AI review.
3. **KPI strip** — Occupancy, ADR, RevPAR, Revenue, Net, Reservations, Avg lead time,
   Cancellation, Rating, Avg response time — each with ▲/▼ vs the selected comparison.
4. **Occupancy & rate trend** — combo line/area (occupancy vs ADR) over the period.
5. **Booking pace** — cumulative on-the-books vs last-year curve, per upcoming month.
6. **Forward — Next 90 days** — occupancy-on-the-books gauge, revenue on the books, gap-night
   list with a "Set a promo / adjust price" deep link.
7. **Channel & source mix** — donut + table.
8. **Lead time & length of stay** — two histograms.
9. **Guests** — age histogram (unknown bucket) + Guest Origins ranked list.
10. **Cancellations & rating** — small trend + latest review themes.
11. **Public page performance** (Phase 2b) — page views / unique visitors trend + top
    referrers.
12. **AI Performance Review card** — headline + score dial, three columns (Working / Improve /
    Avoid), each item expandable with evidence (incl. `activity_log` citations when
    available) + action + deep link; `Regenerate` (rate-limited); `Ask about these numbers`
    opens the assistant.
13. **Playbook** — matched tip/tutorial cards.

States: **loading** skeletons per card; **teaser** (Free/Starter) — KPI strip live, rest
behind a blurred lock + `FeatureGate` CTA; **empty** — "Not enough booking history yet"
with the sample-size needed; **AI-unavailable** — card falls back to deterministic bundle
with a quiet "AI review paused" note. Mobile: single column, each chart in an
`overflow-x:auto` container, 44px targets (`mobile-responsive`).

### Edge functions

| Function                   | Method     | Guard                                                                                    | Purpose                                                          |
| -------------------------- | ---------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `analytics-summary`        | GET        | `serveAuthenticated` + `resolveScopedPropertyAccess('analytics:view')`                   | `?property_id=` / `?org_id=`, `?from=&to=&compare=prior          | yoy`. Full `AnalyticsBundle`when`requirePropertyFeature('analyticsInsights')`passes; slim`{ tier: 'teaser', kpis }` otherwise. |
| `analytics-ai-review`      | GET / POST | same + `requirePropertyFeature` + `assertOrgAndPropertyAiQuota('host_analytics')` (POST) | GET latest row; POST regenerate (rate-limited 1/h/property).     |
| `analytics-ai-review-cron` | POST       | `serveCronPost` (secret)                                                                 | weekly batch refresh + Notification Center ping on score change. |
| `analytics-export`         | GET        | same + `analytics:export`                                                                | CSV (Phase 5) / PDF (`pdfService` pattern).                      |
| `property-page-view`       | POST       | `servePublic` (unauthenticated, rate/bot-filtered)                                       | Ingest one pageview row (Phase 2b) — cheap, fire-and-forget.     |
| AI Dashboard Assistant     | —          | existing                                                                                 | + `get_property_analytics` / `explain_metric` Tier-0 read tools. |

`config.toml`: register the new functions (`verify_jwt = false`); `analytics-ai-review-cron`

- `analytics-export` (PDF) need the `static_files` email/template block only if they render
  templates — otherwise none. Scheduled job via hosted `pg_cron` + `pg_net` (see
  `docs/archive/operations/scheduled-jobs-and-testing.md`), not `config.toml`.

## Implementation tasks

### Phase 0 — Foundation & gating (no visible UI)

- [x] Migration `20261308120000_host_analytics_foundation.sql`: `property_analytics_reviews`,
      `host_playbook_articles` (+ 17 seed rows), `analyticsInsights` → `pricing_plans.features`
      for `growth` / `pro` / `managed` / `business_plus`. RLS on, service-role grant.
- [x] `supabase/functions/_shared/planFeatures.ts` + `ui/src/features/dashboard/plans/lib/planFeatures.ts`
      — added `analyticsInsights: boolean` to type, `DEFAULT_PLAN_FEATURES`, `parsePlanFeatures`
      (server), `PLAN_FEATURE_LABELS` (client).
- [x] `_shared/planEntitlements.ts` — confirmed `requirePropertyFeature`/`isFeatureEnabled` are
      key-generic, no change needed. (Deno unit test not added — no Deno test runner available
      in this environment; flagged as a follow-up.)
- [x] Team RBAC: `analytics:view` / `analytics:export` in
      `ui/src/features/dashboard/team/lib/propertyTeamConstants.ts` +
      `supabase/functions/_shared/propertyTeamPermissions.ts` (kept in sync),
      `propertyPermissionCatalog.ts` (`analytics` module + `COARSE_PLAN_FEATURES` link to
      `analyticsInsights`), seeded role templates (Full Access auto-inherits; Operations +
      Read Only get `analytics:view`). Org-level `org:analytics:view` **not yet added** —
      deferred to Phase 5 (org portfolio rollup) since there's no org-level surface yet.
- [x] `PropertySection` `'analytics'` in `ui/src/features/dashboard/team/lib/propertyPermissions.ts`
      (+ `RequirePropertyPermission.tsx` fallback-redirect order); nav item (icon `BarChart3`)
      after **Pricing** in `adminSidebarNav.ts`; `propertySectionPath` confirmed already generic
      (no per-section switch to update).
- [x] `_shared/analyticsService.ts` — the full `AnalyticsBundle` (KPIs w/ prior + YoY deltas,
      trend, pace, pickup, distributions, forward, state assessment, sufficiency flags).
      Deterministic, timezone-correct (`Asia/Manila` via `bookingsListSort.ts` normalizers).
      `_shared/analyticsService_test.ts` **not added** — no Deno test runner available in this
      environment; flagged as a follow-up (see Open questions).
- [x] `_shared/analyticsService.ts`: guest age histogram (`primary_guest_age`/`guest2..5_age`,
      "Unknown" bucket) + `_shared/guestOriginBucketing.ts` helper (free-text keyword/substring
      match of `guest_address`/`nationality` against a static PH city/region/country list →
      ranked list).
- [x] `_shared/analyticsService.ts`: guest responsiveness rollup from `inbox_thread_metrics`
      (avg first-response minutes, 24h-response rate, joined via `social_conversations.property_id`)
      into the bundle.
- [x] `_shared/analyticsService.ts`: `forwardOccupancyState30d`/`60d` (booked-nights ratio vs
      trailing-90-day baseline) + `balanceCollectionState` (upcoming unsettled bookings with
      `balance > 0` in the next 14 days, weighted by proximity to check-in, cancelled/settled
      excluded) computed into the bundle.
- [x] `analytics-summary` edge fn + `config.toml` entry; teaser vs full payload (bundle is
      always computed, response is trimmed for non-entitled properties).
- [x] `ui` data layer: `features/dashboard/analytics/hooks/{useAnalyticsApi,usePropertyAnalyticsSummary}.ts`
      (TanStack Query, query key includes propertyId + range), types in `lib/types.ts`,
      Manila-aware range presets in `lib/analyticsDateRange.ts`.
- [x] Docs: `plans-feature-matrix.md` row, route guide `docs/guides/routes/org/property/analytics.md`
      (+ `docs/guides/routes/README.md` index row), `PROJECT.md` module paragraph,
      `edge-functions.md` row, `docs/architecture/data-model.md` table entries.
- [x] Verified: `bun run type-check`, `bun run lint` (0 errors), `bun run check:filenames`,
      `bun run build` all pass clean with the new module included.

### Phase 1 — Analytics page (deterministic)

- [x] `pages/PropertyAnalyticsPage.tsx` + `routes/index.tsx` (`analyticsPropertyRoute`);
      registered in `ui/src/features/dashboard/routes/index.tsx` property shell.
- [x] `AnalyticsDateRangeControl` (this month / last 30d / last 90d / last 12mo — no
      period-over-period **vs YoY** comparison toggle yet, that's Phase 2's `compare=yoy` wiring),
      `AnalyticsStateBanner` (state-assessment callout), `AnalyticsKpiStrip` (8 KPIs incl. avg
      response time and 24h response rate), `OccupancyRateTrendCard`, `ChannelMixCard`,
      `LeadTimeLosCard`, `GuestInsightsCard` (age histogram + Guest Origins combined into one
      card rather than two separate `GuestAgeHistogramCard`/`GuestOriginsCard` components — same
      "Guests" section from the UI spec, fewer files). Cancellation rate + rating are KPI-strip
      cards only — no dedicated `CancellationRatingCard` trend chart yet (flagged as a nice-to-have
      follow-up, not blocking).
- [x] Route-level RBAC gate via `propertyRoute('analytics', ...)` (wraps
      `RequirePropertyPermission` automatically — no manual wrapping needed in the page).
      Plan-tier gate: `useFeatureGate('analyticsInsights')` + `AnalyticsTeaserKpiStrip` (4 real
      KPIs, no fabricated data) + upgrade panel for Free/Starter. Empty state below 10
      non-cancelled bookings ever. Loading via shared `DashboardSkeleton`. Mobile: single-column
      stacking via existing `surface-card`/grid conventions (no bespoke mobile pass needed — reused
      the same responsive primitives as Finance/Dashboard).
- [x] Route guide: `docs/guides/routes/org/property/analytics.md` — sections, permission table,
      plan gate, empty/teaser states, host-facing FAQ.

### Phase 2 — Forward-looking

- [x] `BookingPaceCard` (cumulative reservations/revenue this year vs last year, per month,
      toggleable metric) and `NextNinetyDaysCard` (occupancy-on-books progress bar, revenue on
      books, open-night count, pickup last 7d/30d — combined pickup into this card rather than a
      separate `PickupCard`, one less file for the same information). No gap-night deep links yet
      (the `forward.gapNights` list is returned by the API but the UI only shows a count, not a
      per-night "set a promo" link) — flagged as a follow-up polish item.
- [x] `changePctVsLastYear` was already computed in the Phase 0 bundle; Phase 2 added the UI
      side: `AnalyticsComparisonToggle` (Prior period ↔ Last year) driving which delta
      `AnalyticsKpiStrip` displays.
- [ ] Route guide + `PROJECT.md` update for Phase 2 specifically — the Phase 0/1 docs already
      describe the shipped surface; a incremental note distinguishing "Phase 2 also shipped" is
      still pending (low priority, content is accurate, just not phase-attributed).

### Phase 2b — Public page tracking

- [x] Migration `20261309120000_property_page_views.sql`: `property_page_views` table,
      indexed `(property_id, viewed_at desc)`. RLS on, service-role grant.
- [x] `property-page-view` edge fn (`servePublic`) — validates `property_id` is `ACTIVE`
      (silently no-ops otherwise, never leaks existence), basic UA bot-pattern filter +
      device-class derivation, `rateLimitGate` (1/30s per property+session) to dedupe rapid
      re-renders, insert only; `config.toml` entry (`verify_jwt = false`).
- [x] Client tracking hook `usePropertyPageViewTracking.ts` on `PropertyDetailPage.tsx` (the
      public guest-facing property route, `ui/src/features/guest/marketing/pages/`) —
      `navigator.sendBeacon` with a `fetch(keepalive:true)` fallback, session id in
      `localStorage`, no PII, never blocks page render, skipped for editor-preview and
      mock/demo-data views (only fires for real `source: 'api'` properties).
- [x] `_shared/analyticsService.ts`: `buildPublicPageMetrics` — page views/unique visitors
      (session-id based)/top referrers over range, grouped-count query on
      `property_page_views` filtered `is_bot = false` (on-read, no rollup table).
- [x] `PublicPagePerformanceCard` (views/visitors counts + top referrers list, wired into
      `PropertyAnalyticsPage`).
- [ ] Follow-up pruning cron for `property_page_views` retention (~180 days) — flagged, not
      blocking this phase, not built yet.
- [x] Route guide update (new section noted), `PROJECT.md` (Host Analytics paragraph already
      references the shipped tracker; a phase-specific line item is still pending — low
      priority, content accurate).
- [x] Verified: `bun run type-check`, `bun run lint` (0 errors), `bun run build` all pass with
      the Phase 2b files included.

### Phase 3 — AI Performance Review

_(Ships as part of the same initial launch as the deterministic dashboard — Phases 0–4 are
the launch scope, not a deferred follow-up; see the Placement & tiers table.)_

- [x] `host_analytics` added to `_shared/aiModelRouter.ts` (`AI_FEATURES` + `FEATURE_MODELS`,
      flash tier, mirrors `smart_pricing` rates). Adding to "super-admin AI feature list
      surfaces" **not done** — no exhaustive `Record<AiFeature, ...>` display map was found
      anywhere in the super-admin UI to update (verified via repo-wide grep); flagged as N/A
      unless such a surface is added later.
- [x] `_shared/analyticsAiReview.ts` — Gemini call mirrors `smartPricingAi.ts` exactly (key
      rotation, `responseSchema`, `null` on any failure). Deep-link allow-list
      (`ANALYTICS_DEEP_LINK_ROUTES`) resolved server-side from a `deepLinkRoute` enum the model
      picks from — never a raw URL. Prompt includes `forwardOccupancyState30d/60d` +
      `balanceCollectionState` so `improvements[]`/`avoid[]` are state-appropriate, plus recent
      `activity_log` summaries (pricing/booking/public_pages categories) so `why`/`evidence`
      can cite a specific dated change. `_shared/analyticsAiReview_test.ts` **not added** — no
      Deno test runner available in this environment (same limitation as Phase 0).
- [x] `analytics-ai-review` fn (GET latest / POST regenerate, `requirePropertyFeature` +
      `assertOrgAndPropertyAiQuota` gated, 1/hour/property `rateLimitGate`, `recordAiUsage` via
      `maybeRunAnalyticsAiReview`, `analytics.review_regenerated` activity_log event on manual
      regenerate) + `config.toml` entries for both this fn and the cron.
- [x] `analytics-ai-review-cron` fn (weekly, oldest-reviewed-first batch, `TIME_BUDGET_MS`
      guard, skips non-entitled/insufficient-data properties) + hosted `pg_cron` + `pg_net`
      schedule via `sync_analytics_ai_review_cron_job()` (migration
      `20261311120000_analytics_ai_review_cron.sql`, Sunday 16:00 UTC = Monday 00:00 Manila).
      `analytics_review_updated` notification type added to the DB CHECK constraint (migration
      `20261310120000_analytics_review_notification_type.sql`), server `NotificationType` union,
      **and** the separate client-side mirror in `ui/.../notificationsApi.ts` +
      `NOTIFICATION_ICONS` map in `notificationsDisplay.ts` (both required — confirmed via grep,
      matches the byte-identical-mirror pattern already established for `PlanFeatures`).
- [x] `AiPerformanceReviewCard` (score dial, 3 columns — Working/Improve/Avoid — each item
      showing its evidence/why + deep link, Regenerate button, "No review yet" empty state).
      Filename/export use `Ai` not `AI` to match this repo's established casing convention
      (`AiAssistantPanel.tsx`, `AiCreditWalletCard.tsx`, etc. — confirmed via grep before
      naming, not guessed).
- [x] Docs: route guide (Phase 3 section below), `edge-functions.md`, `PROJECT.md`.
      `ai-dashboard-assistant.md` update deferred to Phase 4 (Ask Analytics is what actually
      touches that doc — the AI Performance Review is a separate surface, not an assistant
      tool).
- [x] Verified: `bun run type-check`, `bun run lint` (0 errors), `bun run check:filenames`,
      `bun run build` all pass with the Phase 3 files included.

### Phase 4 — Ask Analytics + Playbook

- [x] `_shared/hostPlaybook.ts` — deterministic matcher: evaluates each active
      `host_playbook_articles.applies_when` condition against the property's `AnalyticsBundle`
      (state assessment, KPI deltas, channel concentration, forward gap-night count), returns
      the matched set sorted by `sort_order`, capped at 6. Wired into `analytics-summary`'s full
      response as `playbook: []` (fails soft to `[]`, never blocks the rest of the bundle).
      `PlaybookList` UI (expandable cards, each with a `#playbook-<slug>` anchor id) wired into
      `PropertyAnalyticsPage`.
- [x] **`improvements[].articleSlugs` linking, shipped 2026-09-09** — `_shared/analyticsAiReview.ts`
      schema gained an optional `articleSlugs` field on each `improvements[]` item; the prompt
      lists the property's already-matched Playbook articles (slug + title) and instructs the
      model to cite by slug only when directly relevant (max 2). `shapeOutput` allow-lists
      returned slugs against the actual matched set — the model can never invent a slug, same
      pattern as `deepLinkRoute`. Both callers (`analytics-ai-review` POST, `analytics-ai-review-cron`)
      now call `matchPlaybookArticles(bundle)` before `maybeRunAnalyticsAiReview` and pass the
      result through. `AiPerformanceReviewCard` renders cited slugs as small chips linking to the
      matching `#playbook-<slug>` anchor in the same page's Playbook card.
- [x] **`_shared/dashboardAssistantAnalyticsTools.ts` (Ask Analytics) — shipped 2026-09-09.**
      `get_property_analytics` (Tier-0 read: KPIs vs prior/YoY, state assessment, forward pace,
      channel mix, top guest origins, matched Playbook titles — re-verifies `analytics:view` RBAC + `analyticsInsights` entitlement independently of the model's claimed `propertyId`, returns
      a soft upgrade message rather than an error when not entitled) and `explain_metric`
      (deterministic glossary lookup, no DB access) — kept in their own file, mirroring the
      `dashboardAssistantOpsTools.ts` (Channel sync) convention, wired into the ~5,300-line
      dispatcher (`dashboardAssistantTools.ts`) additively: one import block, two `switch` cases,
      two tool-declaration list entries — no existing case or list entry touched. Also added to
      `dashboardAssistantRiskClassifier.ts#READ_TOOL_NAMES` and `assistantToolLabels.ts`. The
      **Ask about these numbers** button on `PropertyAnalyticsPage` calls the existing zero-arg
      `openAiAssistant()` — no `assistantOpenStore.ts` signature change was needed, since
      `pageContext.propertyId` already flows from the route the same way it does for every other
      module's launcher (the original blast-radius concern about that file was overstated).
      `docs/architecture/ai-dashboard-assistant.md` updated: new §3.11, tool count 50→52 read
      (99→101 total), the stale "Ask Analytics — deferred" row removed from §5.
- [x] **Super-admin Playbook CRUD at `/admin/playbook` — shipped 2026-09-09.** 4 new edge fns
      (`list-host-playbook-articles-admin`, `create-host-playbook-article`,
      `update-host-playbook-article`, `delete-host-playbook-article`), mirroring the
      `*-help-center-faq` admin pattern exactly (`serveSuperAdmin`, same request/response shape).
      UI: `SuperAdminPlaybookArticlesPage.tsx` + `SuperAdminPlaybookArticleEditorDialog.tsx` +
      `useHostPlaybookArticlesAdmin.ts` (list/create/update/delete hooks), grouped-by-category
      list with active/inactive toggle (no drag-reorder — numeric sort-order field in the editor
      instead, a deliberate scope trim vs the FAQ page's drag-and-drop). Nav: "Playbook articles"
      under Content in `superAdminPlatformNav.ts`; route `playbook` under `/admin`.
- [x] Docs: `PROJECT.md`, route guide, `edge-functions.md` updated for the Playbook piece + CRUD +
      Ask Analytics. `ai-dashboard-assistant.md` updated (§3.11, tool counts, §5 row removed).
- [x] Verified: `bun run type-check`, `bun run lint` (0 errors), `bun run build` all pass with
      every Phase 4 file included.

### Phase 5 — Org portfolio rollup + export

- [x] `/org/:orgSlug/analytics` page: `OrgAnalyticsKpiCards` (portfolio revenue/occupancy/
      reservations/reporting-count rollup) + `OrgPropertyComparisonTable` (sortable, revenue
      default sort, drill-down links to each property's own Analytics page). `org.analytics:view`
      RBAC leaf added end-to-end (client `orgTeamConstants.ts` + `orgPermissions.ts`, server
      `orgTeamPermissions.ts`, `ADMIN` default role updated both sides). Org nav item added
      (`adminSidebarNav.ts`, after Parkings). Plan gate: `RequireOrgFeature` — **new component**,
      the org analog of `RequirePropertyFeature` (this is the repo's first org-scoped paid
      feature; existing org pages are baseline-free). Backend: `analytics-org-summary` fn +
      `_shared/analyticsService.ts#computePropertyPortfolioRow` (a deliberately lighter query
      than the full property bundle — one `guest_submissions` read per property, skips guest
      reviews/inbox/page-views — since the org page may call this once per property in the org).
      **Mixed-enrollment handling** (per the plan's OQ-A): the page itself gates permissively
      (`org.analytics:view` + at least one entitled property, via the `RequireOrgFeature` +
      `resolveOrgAccessContext` combo), but each row in the comparison table reflects that
      property's own actual `analyticsInsights` entitlement — a Free-tier property inside a
      mixed org renders as a locked row (name only, no numbers), never silently included with
      real data.
- [x] CSV export (`Export CSV` button in `OrgPropertyComparisonTable`, client-side blob download),
      gated by `org.analytics:export` (added during the 2026-09-09 self-review fix pass, together
      with the property-level PDF export below — the plan's original "no dedicated export leaf"
      gap is closed on both scopes now).
- [x] **PDF export (property-level) — shipped 2026-09-09.** `ui/.../analytics/lib/exportPdf.ts`,
      client-side `jsPDF` (same `ui/src/lib/pdf/` toolkit as Finance/Maintenance — no new library,
      no server endpoint) rendering state assessment, KPIs vs prior period, the platform
      benchmark (when available), channel mix/guest origins, the latest AI Performance Review
      (headline/score/strengths/improvements/avoid), and matched Playbook articles — all from data
      already loaded on the page. **Download PDF** button on `PropertyAnalyticsPage`, gated by the
      property `analytics:export` leaf (previously defined but intentionally unwired — now wired
      for real; the reserved-for-later code comment removed from `propertyTeamConstants.ts`).
      Org-level export stays CSV-only (per-row data already tabular; PDF wasn't judged worth the
      extra surface there).
- [x] **Privacy-guarded platform benchmark ("vs Kame median") — shipped 2026-09-09**, resolving
      the plan's open "pick a minimum-sample number" question with **8 peers** (the plan's own
      candidate default). `_shared/analyticsService.ts#computePlatformBenchmark`: scans up to 120
      other `ACTIVE` properties (excluding self), keeps up to 60 `analyticsInsights`-entitled
      peers with ≥1 reservation in the period (via `computePropertyPortfolioRow` — the same
      lighter query the org rollup already uses, so this reuses a proven, already-shipped cost
      profile rather than a new expensive cross-tenant query), computes the median
      occupancy/ADR and this property's percentile rank. Returns `available: false` below 8
      qualifying peers — no numbers shown, not even to the requesting host, below that floor.
      Computed only in `analytics-summary`'s full-tier branch (never for teaser/Free-Starter
      responses, which can't see it anyway). New `BenchmarkCard` on `PropertyAnalyticsPage`
      (hidden entirely when `available: false`) and a PDF section.
- [x] Docs: `docs/guides/routes/org/analytics.md`, `docs/guides/routes/org/property/analytics.md`,
      `docs/guides/routes/README.md` index row, `PROJECT.md`, `edge-functions.md` all updated for
      PDF export + benchmark.
- [x] Verified: `bun run type-check`, `bun run lint` (0 errors), `bun run build` all pass with
      every Phase 5 file included.

### Phase 6 — Perf (only if needed)

- [ ] `analytics_daily_rollup` + backfill script + incremental nightly cron; switch
      `analyticsService` loader to read the rollup with a live-tail for today.

## Docs to update

- `docs/PROJECT.md` — new Analytics module, routes, edge fns, tables (no new env vars).
- `docs/architecture/edge-functions.md` — `analytics-summary`, `analytics-ai-review`,
  `analytics-ai-review-cron`, `analytics-export`, `property-page-view` + assistant tools.
- `docs/architecture/plans-feature-matrix.md` — `analyticsInsights` row + tier column values.
- `docs/architecture/ai-dashboard-assistant.md` — `host_analytics` feature, new read tools.
- `docs/guides/routes/org/property/analytics.md` (**new**) and
  `docs/guides/routes/org/analytics.md` (**new**, Phase 5) — sections, permission table,
  plan gate, empty/teaser/AI-unavailable states, "Host-facing knowledge".
- `ui/src/features/dashboard/plans/lib/planPresentation.ts` — compare-matrix row (Dashboard
  or a new "Analytics" group) + `PLAN_TIER_CARD_GAINS` for Pro; then re-check
  `/for-hosts/pricing` and `/org/:orgSlug/plans` tell the same story.
- `docs/guides/routes/for-hosts.md` — pricing/marketing copy for the new capability.
- Route-guide permission tables + `.cursor/rules/route-guides.mdc` route→file map for the new
  routes; `.cursor/rules/plans-and-permissions.mdc` reference-impl list (add `analyticsInsights`).
- `docs/archive/operations/scheduled-jobs-and-testing.md` — the weekly review cron.
- `docs/archive/operations/migration-runbook.md` — the seed/backfill migration.
- `docs/workflow/planned/README.md` — index row (done in this write); on start, move via
  `/workflow-start` and sync `docs/workflow/intake/_to-prompt.md` / `_to-plan.md`.

## Open questions

- **Benchmark minimum-sample threshold — RESOLVED 2026-09-09.** Shipped at the proposed
  candidate: **≥ 8** comparable active, entitled, active-in-period listings
  (`BENCHMARK_MIN_SAMPLE` in `_shared/analyticsService.ts`).
- **Playbook authoring — RESOLVED 2026-09-09.** Seeded 17 articles in Phase 0's migration as
  proposed; super-admin CRUD (`/admin/playbook`) now live for ongoing authoring/refinement.
- **Pageview bot/dedup limitation** (Phase 2b) — UA-based bot filtering and session-id dedup
  are inherently gameable without real device fingerprinting; accepted as a known v1
  limitation rather than building heavier tracking that raises its own privacy questions.
- **State-assessment thresholds** — the forward-occupancy-state and balance-collection-state
  cut points are calibrated per property against its own trailing-90-day baseline rather than
  a fixed global number (a beach property's "strong" occupancy differs from a city condo's);
  exact threshold values need tuning against real data once Phase 0's service is built —
  ship a first-pass default and revisit after a few weeks of production data.
- **Guest Origins bucket list** — the free-text city/region/country keyword list for
  `guestOriginBucketing.ts` should start with PH-focused buckets (matching the primarily
  Philippine guest base) plus a handful of common overseas countries, with "Unknown" as the
  explicit fallback rather than mis-bucketing; expand the keyword list opportunistically
  once real data shows what's landing in "Unknown".
- **UPDATE 2026-09-09 — live-verified, see the Self-review pass section above.** The original
  "needs a human with a local Supabase stack" blocker is resolved: `analytics-summary`,
  `analytics-ai-review` (GET/POST), `analytics-org-summary`, and `property-page-view` were all
  exercised against real seeded data (73 bookings on one property, 325 properties on one org)
  and produced correct, sensible output — including finding and fixing a real bug in
  `analytics-ai-review-cron`'s candidate ordering. **Still open:** no Deno CLI in this
  environment, so `deno check`/`deno test` were never run (correctness was confirmed by actually
  executing the code over HTTP instead, which is stronger evidence but doesn't replace static
  type-checking of the Deno-specific parts); the two flagged test files
  (`_shared/analyticsService_test.ts`, `_shared/analyticsAiReview_test.ts`) still don't exist;
  rate-limit _enforcement_ (not just its fail-open path) is unverified because
  `request_rate_limits` doesn't exist in this local DB (pre-existing, unrelated drift); the new
  `property-page-views-prune-cron` needs an edge-runtime restart to become locally routable and
  was not invoked; and no UI screen has been visually confirmed in a browser.
- **Ask Analytics — RESOLVED / SHIPPED 2026-09-09.** The original blast-radius concern
  (`dashboardAssistantTools.ts`'s dispatcher + `assistantOpenStore.ts`) turned out to be
  addressable with additive-only edits (new file + 2 switch cases + 2 declaration-list entries)
  and no store signature change at all (`openAiAssistant()` already takes zero arguments; ambient
  `pageContext.propertyId` already does the context work). See the Phase 4 task list above.

## Second pass — remaining items closed out (2026-09-09)

Everything flagged as "not built" after the first self-review pass has now shipped: Ask
Analytics, super-admin Playbook CRUD, `improvements[].articleSlugs` linking, property-level PDF
export, and the platform benchmark. Per explicit instruction for this pass, Deno test files and a
Playwright/browser walkthrough were kept out of scope — verification below is edge-function/API
level (curl against local Supabase) plus `bun run ci:quality`, the same standard used in the first
self-review pass.

### Live verification (2026-09-09, second pass)

Restarted the local edge-runtime with the proper secrets env (`bun run dev:api`, non-destructive
— `supabase stop`/`start` restores from backup, no data loss) specifically to make the 4 new
Playbook CRUD functions routable and to get a working `SUPER_ADMIN_EMAILS` check (a bare
`supabase start` doesn't load `supabase/.env.local`, only `./dev.sh`/`dev:api` do — confirmed by
observing the exact same 403 on the already-shipped `list-help-center-faqs-admin` before the
switch, isolating it as a pre-existing environment quirk, not a bug in the new code).

**Verified working end-to-end against real seeded data:**

- `list/create/update/delete-host-playbook-article*` — full CRUD round trip (create → duplicate-slug
  friendly 400 → update/toggle → delete), all correct.
- `property-page-views-prune-cron` — now routable, ran clean (`{ retentionDays: 180, deleted: 0 }`),
  closing the "not verified locally" gap left open by the first self-review pass.
- `analytics-ai-review` GET/POST and `analytics-ai-review-cron` — still degrade gracefully with no
  Gemini key configured for the _review_ feature (`available: false`, `errors: []`), confirming the
  new `matchPlaybookArticles` + `playbookArticles` threading through both callers compiles/loads
  correctly, though the AI-generation `articleSlugs` citation path itself couldn't be exercised
  live (no key) — same limitation as the AI Performance Review always had.
- **Ask Analytics — fully live-verified with real Gemini execution** (a working `GEMINI_API_KEY`
  turned out to be configured for the _dashboard assistant_ feature specifically, unlike the
  Analytics AI-review feature above). Asked the real assistant three different questions on a
  property with 73 real bookings; it correctly called `get_property_analytics` / `explain_metric`,
  and the final answers correctly cited the exact server-computed numbers (occupancy 96.67%, ADR
  ₱2,931.03, RevPAR ₱2,833.33, the `fully_booked` / `at_risk` state labels verbatim, 5 unpaid stays
  totaling ₱33,000).
- `computePlatformBenchmark` — exercised at both the real `BENCHMARK_MIN_SAMPLE = 8` (correctly
  `available: false` against this environment's genuinely-thin seed data — see the bug below) and,
  briefly, a temporarily-lowered threshold of 2 to prove the "available" branch's median/percentile
  math end-to-end (own occupancy 3.11% vs peer median 0.45% → 100th percentile; own ADR 2912.8 vs
  peer median 1605.56 → 100th percentile — both correct), then reverted back to 8 immediately.

**Two real bugs found and fixed by this live pass, neither catchable by static review or
`bun run ci:quality`:**

1. **Benchmark candidate scan was newest-first, backwards for its purpose.** Ordering candidates
   by `created_at desc` biases toward recently-created properties, which have had the _least_ time
   to accumulate real bookings — exactly backwards from "find peers with real reservation history."
   Confirmed live: the only 3 properties in this environment with any bookings ranked
   321st/323rd/325th out of 326 by that ordering, so a 120-row scan never reached them and
   `computePlatformBenchmark` always returned `sampleSize: 0` regardless of the actual data.
   Fixed by flipping to `ascending: true` (oldest-first) — a defensible general design choice, not
   just a local-seed-data patch: an older property has statistically had more time to build up
   activity than a newer one.
2. **A single bad candidate could silently zero out the whole benchmark.** The scan loop had no
   per-candidate error handling — one `resolvePropertyEntitlements`/`computePropertyPortfolioRow`
   throw anywhere in up to 120 candidates would propagate out of `computePlatformBenchmark`, get
   caught by `analytics-summary`'s outer `.catch()` (added specifically so a benchmark failure
   never breaks the rest of the page), and silently downgrade to the "unavailable" fallback —
   masking the real error as an ordinary low-sample result. Fixed by wrapping each candidate's work
   in its own try/catch that skips just that candidate and continues the scan. (This specific
   failure mode wasn't confirmed to be the actual cause in this environment — bug 1 alone fully
   explained the observed `sampleSize: 0` — but the fix is independently correct and was verified
   not to regress the debug instrumentation used to diagnose bug 1.)
3. **Ask Analytics' free-text answers failed the safety reviewer 100% of the time before a prompt
   fix.** `guardDashboardAssistantResponse` (the second-pass Gemini safety reviewer for the
   assistant's free-text response) is only given `groundingPrompt` — the static host-safe facts
   block — as its context, **not** the tool call results (`toolResultsForGrounding`). Finance
   answers dodge this because calendar-month finance/maintenance totals are already baked into
   `groundingPrompt` itself; analytics numbers are not and never will be (Analytics is date-range
   selectable, unlike the fixed "this month" finance figures the grounding prompt precomputes). My
   original prompt instruction let the model put exact figures straight into the `text` block,
   which the reviewer then flagged as an apparent hallucination on every single request. Fixed by
   updating the system prompt's Analytics line to require the same pattern Finance already uses:
   a qualitative `text` block with **no** numbers, plus a `stat_list` carrying the exact tool
   values — `stat_list` fields are checked by the separate, reliable `assertBlocksGrounded`
   structural check (which _does_ see `toolResultsForGrounding`), not the free-text reviewer.
   Re-verified after the fix: same three questions, correct qualitative text + correct `stat_list`
   figures every time.

All fixes verified live after applying them (not just re-read). `bun run ci:quality` re-run clean
after every change in this pass.

### `/self-review` pass (2026-09-09, third pass) — findings and fixes

Ran the repo's `/self-review` skill against the whole module (original build + both fix passes
above). Verdict was **"Ship with fixes"** — one P1, two P2s, no P0s. All three fixed in the same
session:

- [x] **P1 — benchmark scan was sequential and uncached, running on every full-tier
      `analytics-summary` request.** Fixed with a new single-row cache table,
      `platform_analytics_benchmark_cache` (migration `20261314120000`): the expensive peer scan
      (`scanBenchmarkPeers`) now only runs when the cached row is missing or older than
      `BENCHMARK_CACHE_TTL_HOURS = 24`; every other request within that window reads one cached
      row instead of re-scanning up to 120 properties. Also added a `BENCHMARK_TIME_BUDGET_MS =
8_000` wall-clock guard on the scan loop itself (previously unbounded). The peer set is
      platform-wide, not per-property, so caching it doesn't change what any individual host sees
      — the only accepted trade-off is that a cached run's peer values may include up to 1 value
      from the current requester's own property (negligible weight at ≤60 peers, and the
      requester already knows their own number). The cache also stores below-floor results (e.g.
      `sample_size: 3`), not only successful ≥8-peer runs — a genuinely sparse peer pool is worth
      caching too, so a deployment that never reaches the floor isn't stuck re-scanning on every
      request either. Live-verified end to end: cache table populates on first call
      (`computed_at` set, `sample_size: 3` matching this environment's real peer count), a second
      call's `computed_at` stays byte-identical (proving the cache hit, not a re-scan), and — with
      `BENCHMARK_MIN_SAMPLE` briefly lowered to 2 for verification only, then reverted — the
      "available" branch surfaces correctly all the way through a real Ask Analytics conversation
      (`stat_list` with `Occupancy Percentile: 100th`, `Median ADR: ₱1,605.56`, etc.).
- [x] **P2 — Ask Analytics didn't know about the benchmark.**
      `dashboardAssistantAnalyticsTools.ts#toolGetPropertyAnalytics` now also calls
      `computePlatformBenchmark` and includes a `benchmark` field in its response
      (`available`/`sampleSize`/`medianOccupancyRatePct`/`occupancyPercentile`/`medianAdrDisplay`/
      `adrPercentile`); the assistant's system prompt was updated to cite these via `stat_list`
      only, same grounding rule as every other analytics figure.
- [x] **P2 — `plans-feature-matrix.md` stale on export leaves.** Updated: `analytics:export` /
      `org.analytics:export` now correctly described as gating the real, shipped Download PDF /
      Export CSV buttons (both client-side, no dedicated export edge function — same pattern as
      Finance's export leaves), not "reserved."

Docs updated in the same pass: `PROJECT.md`, `architecture/data-model.md` (new cache table row),
`architecture/plans-feature-matrix.md`. `bun run ci:quality` clean after all three fixes.
