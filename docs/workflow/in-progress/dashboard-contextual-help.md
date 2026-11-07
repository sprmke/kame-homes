---
title: 'Dashboard contextual help (info tooltips, how-it-works panels, stat card definitions)'
status: in-progress
tags: [workflow, in-progress, ux, copy, dashboard, help]
updated: 2026-11-07
stage: in-progress
kind: plan
---

# Dashboard contextual help

Make every host dashboard page understandable to a non-technical host without changing any
control, flow, or layout they already use. Help lives **behind small affordances** (an `i` / `?`
next to a label or title, a "How it works" button in a page header, a one-time dismissible intro
card), not as new paragraphs on every screen.

**Scope:** host dashboard only (`/org/:orgSlug/...`, `/org/:orgSlug/property/:propertySlug/...`,
`/org/:orgSlug/parking/:parkingSlug/...`). Super-admin (`/admin/*`) is out of scope. Public and
guest pages are tracked separately in the follow-up GitHub issue (see
[Follow-up ticket](#follow-up-ticket-public-pages)).

**Audience:** paying hosts and their team members, many of whom are not technical.

## Goals

1. Every non-obvious **form field** has a short `?` hint. Obvious fields (name, email, phone,
   address, notes, dates, plain prices) stay as they are.
2. Every non-obvious **stat card** has an `i` hint saying exactly how the number is computed, and
   the copy matches the real server formula.
3. Every **advanced feature** (Smart Pricing, Channel sync, Notifications, Telegram, Templates,
   Marketing Studio, Inbox automation, Public Pages, Team roles) has a **"How it works"** panel
   with a 3 to 4 step visual (icon + one line per step).
4. Section cards with unusual content get a title-level hint.
5. The Support "Broken" category shows a warm thank-you note.
6. Zero regressions: no layout shift, no broken clicks, no new keyboard traps, no E2E breakage,
   works at 375 / 768 / 1024px+, light and dark, touch and mouse.

## Non-goals

- No changes to business logic, data, permissions, plan gates, or flows.
- No renames of existing labels/titles without an explicit decision (listed under
  [Open decisions](#open-decisions)).
- No guided product tours / step-by-step overlays (high maintenance, fights the native mobile
  shell). Can be revisited later.
- No server-side storage for dismissals in this pass (see decision D3).

## What exists today (audit, 2026-11-05)

| Thing                                                              | Where                                                                                    | Notes                                                                                                                                                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FieldLabel` + `FieldHelpTooltip` (`?` icon, Radix Tooltip only)   | `ui/src/components/forms/FieldLabel.tsx`                                                 | Used across 26 dashboard files with 61 `help=` strings. **Bug (fixed in P0):** Radix Tooltip did not open on tap, so this help was unreachable on phones and tablets.                        |
| `MetricInfoDot` (`i` icon, tooltip on desktop, popover below `lg`) | `ui/src/features/dashboard/analytics/components/MetricInfoDot.tsx` + `metricGlossary.ts` | Analytics only. Touch detection is `useIsBelowLg`, which is wrong for touch laptops and mouse-driven narrow windows. Copy mirrored in `_shared/dashboardAssistantAnalyticsTools.ts`.         |
| `StatCard.titleAdornment` slot                                     | `ui/src/components/shared/StatCard.tsx`                                                  | Already supports a hint after the title. Cards with `to` / `onClick` render as a link/button, so a hint inside would be a nested interactive element.                                        |
| `AdminPageHeader.subtitle`                                         | `ui/src/features/dashboard/bookings/components/AdminPageHeader.tsx`                      | Line-clamped to 2 lines on phones. Not a place for instructions.                                                                                                                             |
| `TelegramHelpDialog`                                               | `bookings/components/telegram-notifications/TelegramHelpDialog.tsx`                      | Existing Telegram setup help. Reuse and extend, do not duplicate.                                                                                                                            |
| `GuestFormInfoCallout`                                             | `ui/src/features/guest/form/components/GuestFormOptionCard.tsx`                          | Guest-side callout styling reference.                                                                                                                                                        |
| Rule `ui-minimal-copy.mdc` (always-on)                             | `.cursor/rules/ui-minimal-copy.mdc`                                                      | Says "no helper text / tip callouts unless asked". This plan is the explicit ask, so it needs a sanctioned exception written into the rule (task P0.9), or every future agent will fight it. |
| App-level `TooltipProvider`                                        | `ui/src/App.tsx`                                                                         | Already present, so per-instance providers (as in `FieldHelpTooltip`) are redundant.                                                                                                         |

## Design system for help (the three patterns)

Only these three patterns are allowed. Pick by **where the confusion is**.

| Pattern                             | Use for                                                     | Visual                                                                                                                               | Max copy                                       |
| ----------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| **`InfoHint`** (inline)             | One field, one stat card, one section title, one toggle row | 14px `?` (fields) or `i` (metrics/sections) glyph in a 24px box with a 44px hit area. Hover tooltip on mouse, tap popover on touch.  | 1 to 2 sentences, about 180 characters         |
| **`HowItWorks`** (feature intro)    | A whole module or advanced feature                          | Header icon button "How it works" opening a `ResponsiveModal` (dialog on desktop, bottom sheet on phone) with a 3 to 4 step visual.  | Title + up to 4 steps of one line each + 1 tip |
| **`IntroCard`** (first-visit nudge) | First time a host opens a complex module                    | One-line dismissible card under the header: icon, one sentence, "How it works" button, close `x`. Never shown again after dismissal. | One sentence                                   |

Plus one special case: **`NoticeCallout`** (static, non-dismissible info box) only where context
changes the user's decision at that moment. In this plan: the Support "Broken" note, Smart Pricing
autopilot warning, Channel sync "paused" state (already exists, restyle only).

### Copy rules (apply to every string)

- Follow the `human-copy` skill: plain words, no em dashes, no "simply", "seamlessly", "leverage",
  no exclamation marks except the Support thank-you.
- Structure: **what it is** + **what happens** (+ optional example). Example:
  "Lowest price Smart Pricing can set for any night. It will never go under this."
- Say "guest", "night", "booking", "property", "parking" (context-aware noun, see edge case E14).
- Money: peso sign, no decimals unless the field has them. Times: say "Philippine time" when a
  schedule is involved.
- Never promise a feature the current plan or feature availability hides.
- Every stat card definition must be checked against the server formula before merge (task
  P1.1), and the formula file noted in a code comment next to the copy.

## Phases

Each phase is shippable on its own. Recommended order: P0, P1, P2, P3, P4, P5, then P6 to P9 in any
order, P10 last.

---

### P0. Foundations (blocks everything else)

**Status 2026-11-05: shipped on `feat/dashboard-contextual-help-p0`.** All 13 tasks implemented with
unit tests (copy guard, dismissal state) and a Playwright spec (hover, tap, Esc, keyboard, no
submit, no layout shift, viewport fit). One deliberate implementation change: `InfoHint` uses one
Radix `Popover` anchored to a real button for every pointer type, with hover open/close gated by
`(hover: hover) and (pointer: fine)`. This keeps one content path, makes click/tap work even when
pointer detection is wrong (touch laptops), and still behaves like a tooltip on mouse. Inside a
modal the panel portals into the active `[role="dialog"]` so the background is not inert.

- [x] **P0.1** Create `ui/src/components/help/InfoHint.tsx` (named export `InfoHint`).
  - Props: `label` (accessible name, e.g. "Minimum nightly price"), `children` or `text`
    (content), `variant: 'field' | 'metric' | 'section'` (`?` vs `i` glyph), `side?`, `align?`,
    `className?`.
  - Input detection with `matchMedia('(hover: hover) and (pointer: fine)')`, not viewport width.
    **Implemented:** one Radix `Popover` for all pointers (hover on fine pointers, click/tap
    always). No per-instance `TooltipProvider`.
  - Keyboard: trigger is a real `<button type="button">`, focusable, Enter/Space toggles the
    popover, Esc closes. Focus ring matches `FieldHelpTooltip`.
  - Trigger stops `click` and `pointerdown` propagation and prevents the default click, so it never
    submits a form, toggles a parent label, navigates a parent link, or starts a sheet drag.
  - Keep the side-picking logic from `FieldHelpTooltip.pickHelpTooltipSide` (RTL aware, 16px
    viewport pad, 288px max width), plus Radix `collisionPadding` and `avoidCollisions`.
  - Content: `max-w-[min(calc(100vw-2rem),18rem)]`, `text-xs leading-relaxed`, scrolls if long,
    portaled into the active dialog when inside one, above dialog/sheet z layers.
  - Glyph box `size-6` with `-my-1` so it never grows the label row height (no layout shift).
  - Optional `describedById`: renders the same text in an `sr-only` span with that id so a field
    can set `aria-describedby` and screen readers read the hint on input focus.
- [x] **P0.2** Re-implement `FieldHelpTooltip` and `MetricInfoDot` as thin wrappers over
      `InfoHint` (keep their exports and props so the ~14 + 4 existing call sites keep working). This
      fixes the existing touch bug everywhere at once.
- [x] **P0.3** Add `SectionTitle` helper (or extend existing card header components) that renders
      `title + InfoHint variant="section"` with `min-w-0` truncation on the title and `shrink-0` on the
      hint, so long titles never push the hint off-screen.
- [x] **P0.4** Create `ui/src/components/help/HowItWorksDialog.tsx`: `ResponsiveModal` with
      `title`, `steps: { icon: LucideIcon; title: string; body: string }[]` (3 to 4), optional `tip`,
      optional `learnMoreHref` (Help Center article). Visual: numbered vertical steps with a connector
      line on phone, horizontal 3 to 4 column flow with arrow connectors at `md+`. Icons only from
      `lucide-react`, tinted with existing tokens. No images, so it stays light and theme safe.
- [x] **P0.5** Create `ui/src/components/help/HowItWorksButton.tsx`: header icon button
      (`HelpCircle` in this repo's Lucide version, `aria-label="How <feature> works"`), 44px touch
      target, fits the existing `AdminPageHeader` `actions` slot and mobile hero action row
      (`MobileHeroActionButton`).
- [x] **P0.6** Create `ui/src/components/help/IntroCard.tsx` + `ui/src/lib/help/introDismissal.ts`:
  - Key `kh.help.intro.<userId>.<featureKey>.v<version>` in `localStorage` (implemented with the
    viewer segment, so two people on one device do not hide each other's cards).
  - Every read/write wrapped in try/catch. If storage throws, show the card once per session
    (in-memory fallback) rather than every render.
  - Version suffix lets us re-show a card when the feature changes meaningfully.
  - Card renders nothing until the dismissal state is resolved (no flash of card, then gone).
- [x] **P0.7** Create `ui/src/components/help/NoticeCallout.tsx`: `tone: 'info' | 'thanks' | 'warning'`,
      icon + short text, token colors for light/dark, `role="note"`.
- [x] **P0.8** Copy registry: one `lib/helpCopy.ts` per feature module
      (e.g. `features/dashboard/pricing/lib/pricingHelpCopy.ts`), typed with a shared
      `HelpCopy` / `HowItWorksCopy` type from `ui/src/lib/help/types.ts`. No help strings inline in
      JSX. This makes review, the AI knowledge sync (P10.4) and the lint test below possible.
- [x] **P0.9** Vitest guard `ui/src/lib/help/helpCopy.test.ts` (plain `.ts`, Node env, because
      `.test.tsx` files are not run): imports every `*HelpCopy.ts`, fails on an em dash or en dash,
      hint text over 200 characters, empty strings, steps outside 3 to 4, banned words list from
      `human-copy`.
- [x] **P0.10** Update `.cursor/rules/ui-minimal-copy.mdc` and the `minimal-ui-copy` skill with a
      "Sanctioned help patterns" section: `InfoHint`, `HowItWorks`, `IntroCard`, `NoticeCallout` are
      allowed; inline helper paragraphs and `CardDescription` essays are still not. Keep
      `.claude/` and `.opencode/` mirrors in sync (`bun run setup:ai-tooling` check).
- [x] **P0.11** Architecture doc `docs/architecture/contextual-help.md`: the three patterns, when
      to use which, copy rules, registry location, edge cases. Link from `docs/architecture/overview.md`
      and `docs/README.md`.
- [x] **P0.12** E2E selector audit before shipping P0: grep `ui/e2e/**` for
      `getByRole('button', { name: /.../ })` and `getByText` against titles that will gain an
      "About X" button. Regex names like `/Smart Pricing/` will hit both the feature button and
      "About Smart Pricing" and fail strict mode. Fix specs to exact names. (5 regex button matchers
      exist today.) **Done:** anchored the three matchers that can collide with "About X" /
      "How X works" (`/^Pending review/`, `/^Approve selected/`, `/^Proceed to Pending Documents/`).
      The remaining matchers target names that no hint uses.
- [x] **P0.13** Add a mocked Playwright spec `ui/e2e/features/dashboard/contextualHelp.spec.ts`:
      hint opens on hover (desktop project) and on tap (mobile project), Esc closes, clicking a hint
      inside a form does not submit, no layout shift, panel stays inside the viewport. **Deferred to
      the first surface that ships them:** "inside a link card does not navigate" (needs the P1.2
      stretched-link stat card) and "intro card dismissal survives reload" (needs the first P3/P9
      `IntroCard`). The dismissal logic itself is unit-tested in
      `ui/src/lib/help/introDismissal.test.ts`.
- [x] **P0.14** `FieldLabel` keeps its API; inputs can opt into `aria-describedby` with
      `InfoHint`'s `describedById`. Wire it in P2/P3 where a field's label alone is not enough for a
      screen reader.
- [x] **P0.15** Touch coverage runs in both the desktop and `mobile-chromium-smoke` projects; the
      mobile assertion uses the real 375px viewport, not a fixed guess.

**Exit:** existing hints work on touch, nothing visually moved (compare screenshots of Settings,
Analytics, Channel sync dialog before/after at 375 and 1280).

---

### P1. Stat cards (all host dashboard KPI rows)

**Status 2026-11-05: shipped on `feat/dashboard-contextual-help-p1` (stacked on P0).** The
`StatCard` stretched-link refactor landed once, then hints were wired across property, org,
parking, finance, pricing, org listings, bookings stages, maintenance, team, announcements, and the
marketing storage meter. Tests: `metricDefinitions.test.ts` (copy + source symbol), `helpCopy.test.ts`
(every module), `bookingStages.test.ts`, `metricGlossary.test.ts` (UI/edge parity), and
`statCardHelp.spec.ts` (hover, tap, no navigation, no nested interactive, card navigation still
works).

**Findings while implementing:**

- **Org occupancy was documented wrong.** The card uses the selected range: `occupiedNights /
(periodDays × listingCount)`. The forward-30-day figure is only the `low-occupancy` attention
  item. Corrected in the table below.
- **Org Total Bookings is a booking count**, while property/parking Total Bookings is `occupied
nights / period days`. The same label means different things per dashboard.
- **Org properties/parkings "Total revenue" is `ratedRevenue`** for the current Manila calendar
  month (`computePropertyPeriodStats`), not host net. The hint says so.
- **`NotificationsHubShell` is not mounted by any route today** (`NotificationsPage` uses
  `AdminSectionNavLayout` instead). The summary-card hints are implemented but cannot be E2E
  tested until the hub is mounted. The copy guard still covers the strings.
- **`DashboardOccupancyRingCard` is also unmounted.** Its hint was added for the next time it is
  used.
- **Plans has no usage/limit meters today.** AI credits and storage limits appear in the feature
  matrix, not as live meters. P1's plans row is N/A; the `PlanFeatureMatrix` hints belong to P8.
- **Analytics keeps its own glossary.** ADR and RevPAR use different formulas from the dashboard
  Average Nightly Rate, so they stay in `metricGlossary.ts`. The new parity test guards key drift
  against `METRIC_EXPLANATIONS`; it does not force identical wording.
- **Reviews was missing from the original P1 table.** The Reviews KPI row has non-obvious
  "Responded" (share of reviews with a host response) and "To write" (reviews still due), so both
  now have hints. Added as a late P1 item.

- [x] **P1.1** For each card below, read the server computation, write the definition, and put
      the source file in a comment next to the copy. If a label and its value do not match, record it
      under Open decisions instead of silently renaming.
- [x] **P1.2** Render the hint via `StatCard.titleAdornment`. For cards that are links/buttons
      (`to`, `onClick`, and `TrendCardLink` in `DashboardStatCards` which wraps the whole card in
      `<Link>`), restructure so the hint is **not inside** the `<a>`/`<button>`: use a stretched-link
      pattern (card is a `relative` div, the link is an absolutely positioned overlay, the hint sits
      above it with `relative z-10`). Nested interactive elements are invalid HTML and break screen
      readers and tap targets.
- [x] **P1.3** Mirror the same treatment in `DashboardTrendStatCard` and `StatCardSkeleton`
      (skeleton reserves the 24px hint slot so there is no shift when data loads).

| Page / component                                                          | Cards needing a hint                                                                                       | Skip (obvious)                                                                                          | Formula source / notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Property Dashboard `property/components/DashboardStatCards.tsx`           | Total Revenue, Total Bookings, Occupancy Rate, Average Nightly Rate, and what "vs last period" compares to | none                                                                                                    | `_shared/dashboardService.ts#computePeriodKpiSnapshot` + `_shared/bookingFinance.ts#computeOperatingHostNet`. Total Revenue is **host net**: down payment + balance + parking fee + pet fee + additional fee, minus parking cost you paid, plus security deposit profit lines minus expense lines (**completed stays only**), for non-cancelled bookings that check in during the period. Total Bookings value is **occupied nights / nights in period**. Occupancy is the same ratio as a percent. Average Nightly Rate is **rated revenue allocated to the occupied nights in range ÷ rated nights** (nights with no rate are excluded). Prior period is the **same number of days immediately before** the range (`previousPeriodRange`). |
| Org Dashboard `org/components/org-dashboard/OrgDashboardStatCards.tsx`    | Total Revenue, Total Bookings, Occupancy Rate                                                              | Total Listings, Total Properties                                                                        | **Verified 2026-11-05.** Total Revenue rolls up the same host net per booking. Total Bookings here is a **count of non-cancelled bookings whose check-in falls in the range** (not nights, unlike the property card). Occupancy is **occupied nights in the selected range / (days in range × listings)**, averaged across properties and parking. The forward-30-day occupancy is only the `low-occupancy` attention item, **not** this card. The copy must not claim a forward window.                                                                                                                                                                                                                                                     |
| Parking Dashboard `parking/components/ParkingDashboardStatCards.tsx`      | Total Revenue, Total Reservations, Occupancy Rate, Average Nightly Rate                                    | none                                                                                                    | Parking dashboard service. Use "slot" / "reservation" wording.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Finance `finance/components/FinanceSummaryCards.tsx` (+ Parking Finance)  | Net Profit, Pending Payments                                                                               | Total Income, Total Expenses (add a short hint only if they include booking-derived rows automatically) | `_shared/financeService.ts`. Say which booking amounts flow in automatically vs manual entries, and that the date range filter applies.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Pricing `pricing/components/PricingStatsRow.tsx`                          | Weekend Premium, Custom Dates, Fixed Fees, Smart Pricing                                                   | Base Rate                                                                                               | Smart Pricing card counts nights currently priced by Smart Pricing. Weekend premium: which nights count as weekend.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Parking Pricing `parking/components/ParkingPricingStatsRow.tsx`           | Same pattern as Pricing                                                                                    | Base rate                                                                                               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Org Properties / Parkings summary cards                                   | Total revenue, Avg monthly revenue, Avg occupancy                                                          | Total properties                                                                                        | Which window "monthly" averages over.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Bookings list `bookings/components/BookingsSummaryCards.tsx`              | Each stage card gets a one-line "what this stage means / what you do next" hint                            | none                                                                                                    | Pull text from the status meta in `bookings/lib/workflow.ts` so stage hints stay in sync with the workflow. Legacy nested statuses must map to their parent stage copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Maintenance `maintenance/components/MaintenanceSummaryCards.tsx`          | Telegram enabled, Pending                                                                                  | Total, Completed                                                                                        | "Telegram enabled" = items that will send a reminder to Telegram.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Team `team/components/TeamStatsCards.tsx`, `OrgTeamStatsCards.tsx`        | Team access, From Organization, per-role cards                                                             | Total Members, Pending Invites                                                                          | Explain property member vs org member inheritance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Notifications `notifications/components/NotificationsHubSummaryCards.tsx` | Telegram on, Connected                                                                                     | Unread, Messages                                                                                        | **Implemented, but the component is not mounted by a route today.** `NotificationsPage` uses `AdminSectionNavLayout`; `NotificationsHubShell` has no caller. E2E waits for the hub to be mounted. Copy guard still covers the strings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Announcements `announcements/components/HostAnnouncementStatCards.tsx`    | Action required, Attention, Updates                                                                        | Active                                                                                                  | Severity meaning.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Plans `plans/components/PlanBillingPanel.tsx`, `OrgPlansPage.tsx`         | Any usage/limit meters (AI credits, storage, listings)                                                     | Price                                                                                                   | **N/A today:** no live usage meters. AI credits and storage limits live in the feature matrix and move to P8 (`PlanFeatureMatrix` hints).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Analytics (already done)                                                  | Re-check all `MetricInfoDot` copy still matches the server after P0 migration                              |                                                                                                         | Keep `metricGlossary.ts` in sync with `METRIC_EXPLANATIONS`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Marketing `media-library/MediaStorageMeter.tsx`                           | Storage meter                                                                                              |                                                                                                         | **Implemented.** Copy: uploads count toward plan storage; at the limit new uploads stop until files are deleted or the plan is upgraded (`marketingMediaRules.ts#limitMessage`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

- [x] **P1.4** Shared definitions: property, org and parking "Occupancy Rate" / "Average Nightly
      Rate" copy lives in one `ui/src/lib/help/metricDefinitions.ts` and is imported by all three
      dashboards plus Analytics, so wording cannot drift.
- [x] **P1.5** ~~Hint in the trend line.~~ **Removed after UI review (2026-11-06):** the extra
      `i` beside "vs last period" was redundant and noisy. The prior-period window was verified as
      the same number of days immediately before the range, but no hint ships for it.
- [x] **P1.6** Refactor `StatCard` once for the stretched link (addendum A2) before adding hints to
      any card with `to` / `onClick`. Add a test proving there are no nested interactive elements
      and the hint stays keyboard reachable.
- [x] **P1.7** Add the UI and edge analytics-copy parity guard (addendum A3). The Analytics row is
      not done until it passes.
- [x] **P1.8** Make `metricDefinitions.ts` entries `{ text, source }` and add a test that every
      `source` path exists (addendum A22).
- [x] **P1.9** `DashboardOccupancyRingCard` is the phone/tablet occupancy card and has no
      `titleAdornment` slot. Add an `InfoHint` beside its "Occupancy Rate" label so the formula is
      reachable at 375px too. Verify the ring, label, and hint at 375 before shipping.

### P1 implementation plan (next module)

**Verified formula sources (2026-11-05).** Do not write copy from memory; these are the exact
windows and denominators in `_shared/dashboardService.ts`.

| Card                          | Value shown                                      | Formula source                                                                    | Copy note                                                                                     |
| ----------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Property Total Revenue        | `kpis.netProfit.value`                           | `computePeriodKpiSnapshot` → `hostNetForDashboardKpi` → `computeOperatingHostNet` | Only bookings with **check-in inside the range**, non-cancelled. Full host net, not prorated. |
| Property Total Bookings       | `${occupiedNights} / ${periodDays}`              | `countOccupiedNightsInRange`                                                      | Occupied nights inside the range, not a booking count.                                        |
| Property Occupancy            | `occupiedNights / (periodDays × 1)` as a percent | `occupancyRate` in `computeDashboardStats`                                        | Same numerator as Total Bookings.                                                             |
| Property Average Nightly Rate | `ratedRevenue / ratedNights`                     | `bookingRateLodgingInRange` + `ratedNights`                                       | Only nights that have a rate; nights without a rate are excluded.                             |
| Org Total Revenue             | roll-up of the same host net                     | same                                                                              | Across every property and parking in the org.                                                 |
| Org Total Bookings            | `kpis.checkInsInPeriod.value`                    | `totalBookings` count of check-ins in range                                       | A **booking count**, unlike the property card. Cancelled excluded.                            |
| Org Occupancy                 | `occupiedNights / (periodDays × listingCount)`   | `occupancyRate` with `orgUnitCount`                                               | Averaged across properties + parking. **Not** the forward-30-day attention metric.            |
| Parking Total Revenue         | same host net                                    | `computeOperatingHostNet`                                                         | Reservations that start in the range; parking cost paid is subtracted.                        |
| Parking Total Reservations    | `${occupiedNights} / ${periodDays}`              | `countOccupiedNightsInRange`                                                      | Slot nights, not a reservation count.                                                         |
| "vs last period"              | `previousPeriodRange`                            | `previousPeriodRange`                                                             | Same number of days immediately before the selected range.                                    |

**Order of work (one PR each):**

1. **StatCard stretched link (P1.6).** `ui/src/components/shared/StatCard.tsx` only. `relative`
   shell, overlay `<Link>` / `<button>` with `aria-label={title}`, content above it, hint at
   `relative z-10`. Keep `active`, `aria-current`, focus ring, `native-press`, and `density`.
   Add a test that no interactive element is nested and the hint is tab-reachable. No copy in this
   PR, so a regression is easy to bisect.
2. **Shared definitions (P1.4, P1.8, P1.7).** `ui/src/lib/help/metricDefinitions.ts` with
   `{ text, source }`; `metricDefinitions.test.ts` checks every `source` path exists; analytics
   parity test against `METRIC_EXPLANATIONS`.
3. **Property + parking cards (P1.2, P1.3, P1.9).** Wire `InfoHint` via `titleAdornment`; add the
   ring-card hint; reserve the slot in `StatCardSkeleton`.
4. **Org cards.** Different copy for the booking count and averaged occupancy.
5. **Rest of the P1 table** (finance, pricing, bookings stages, maintenance, team, notifications,
   announcements, plans, marketing storage). Each module owns a `*HelpCopy.ts`.
6. **Decisions D1/D2.** If renaming, do it as a copy-only PR before step 3, then update route
   guides, FAQs, E2E selectors, and screenshots in the same PR.

**Copy drafts (pending D1/D2):**

- Total Revenue (kept): "What you keep from bookings that check in this period: down payment,
  balance, guest fees, minus parking you paid. Security deposit lines count only on completed
  stays."
- Net income (renamed): same sentence, shorter first clause.
- Total Bookings (kept): "Nights booked out of the nights in this period. A 3-night stay fills 3
  nights."
- Nights booked (renamed): same sentence without the label apology.
- Occupancy Rate: "Nights booked divided by the nights in this period."
- Average Nightly Rate: "Average rate on booked nights that have a rate. Nights without a rate are
  not counted."
- Org Total Bookings: "Bookings that check in during this period, across all properties and
  parking."
- Org Occupancy Rate: "Booked nights divided by the nights available across all listings in this
  period."
- Parking Total Reservations: "Slot nights booked out of the slot nights in this period."
- vs last period: "Compared with the same number of days right before this range."

**Acceptance:** each card hint opens on hover and tap at 375 / 768 / 1280; no layout shift when the
icon appears or the skeleton loads; no nested interactive elements; copy matches the table above;
`bun run test` and the P1 Playwright spec pass.

---

### P2. Pricing page: Smart Pricing and Channel sync (highest priority after P1)

Files: `pricing/pages/PropertyPricingPage.tsx`, `pricing/components/SmartPricingDialog.tsx`,
`ChannelSyncDialog.tsx`, `PricingRatesFormCard.tsx`, `PricingDateModal.tsx`,
`PricingSaveDialog.tsx`, `PricingCalendarGrid.tsx`; parking mirror `parking/pages/ParkingPricingPage.tsx`,
`ParkingPricingRatesFormCard.tsx`.

**Page level**

- [ ] **P2.0** Verify every quoted number and cadence before writing copy: Strength bands and the
      gap-night rule in `_shared/smartPricingEngine.ts`, the autopilot schedule in
      `smart-pricing-cron`, and the sync interval in `_shared/calendarSyncRun.ts`
      (addendum A10, A11).
- [ ] **P2.1** `HowItWorksButton` "How pricing works" in the page header: steps
  1. Base and weekend rates set your normal price.
  2. Date rules and custom dates override specific nights.
  3. Smart Pricing can fine-tune open nights within your limits.
  4. Guests see the final nightly price on your booking page and calendar.
- [ ] **P2.2** Calendar legend: add a compact legend `InfoHint` (or extend the existing legend)
      explaining each pill state: custom price, Smart price, booked, blocked, imported from Airbnb.
      Must match the `isCustom / isSmart / isBooked / isBlocked / isImported` states in
      `PropertyPricingPage.tsx`.
- [ ] **P2.3** Mobile hero action buttons (Smart Pricing, Channel sync) are icon-only on phone:
      confirm they have visible labels or long-press titles; add a short label under the icon if
      hosts cannot tell them apart (decision D5).

**Smart Pricing dialog**

- [ ] **P2.4** `IntroCard` inside the dialog when Smart Pricing is off and never used:
      "Smart Pricing adjusts your open nights up or down based on demand, within limits you set."
      with a "How it works" link.
- [ ] **P2.5** Smart Pricing `HowItWorksDialog` (nested from the dialog, or a step view inside
      the same sheet on mobile to avoid modal-on-modal; decision D4). Steps, matching
      `_shared/smartPricingEngine.ts` factors:
  1. Starts from your saved rates.
  2. Looks at day of week, season demand, how far out the night is, how fast nights are selling,
     and single gap nights between bookings.
  3. Moves each open night up or down by at most your Strength, never past your price limits.
     Your holiday and season rules still apply.
  4. "When I approve": you preview and apply. "Automatically": it updates on its own on a schedule.
     Tip: booked and blocked nights are never changed.
- [ ] **P2.6** `InfoHint` on: Strength (with what Gentle ±6% / Balanced ±12% / Bold ±22% mean in
      pesos for the current base rate, e.g. "On a ₱3,000 night, Balanced can move it ₱360 up or down"),
      Never below, Never above (explain the suggested placeholder values and what happens if left
      empty), When prices update (both modes), Preview, the Higher / Same / Lower / Booked legend in
      the preview, and the per-day factor breakdown.
- [ ] **P2.7** `NoticeCallout tone="warning"` when "Automatically" is selected: one line saying
      prices on open nights will change without asking, and how to turn it off. Confirm the cron
      schedule in `smart-pricing-cron` and say it in plain words.
- [ ] **P2.8** Read-only and plan-gated states (`'View only...'`, `'Pro plan required...'`) stay,
      but the hints and How it works stay usable so a host can learn before upgrading.
- [ ] **P2.9** Turn-off confirm ("Resets nights back to your saved rates.") stays; add nothing.

**Channel sync dialog**

- [ ] **P2.10** Channel sync `HowItWorksDialog` with a two-way diagram (two lanes with arrows):
  - **Airbnb to Kame (import):** paste your Airbnb calendar link here. We check it about every 30
    minutes and block those dates so guests cannot double book. Use "Sync now" to check right away.
  - **Kame to Airbnb (export):** copy our link and paste it in Airbnb under Availability, then
    Connect calendars. Airbnb blocks dates booked here.
  - Tip: only dates sync. Prices, guest names and messages do not.
    Confirm interval from `_shared/calendarSyncRun.ts` (`CALENDAR_SYNC_MIN_INTERVAL_MINUTES_DEFAULT = 30`,
    env-overridable, so copy says "about every 30 minutes").
- [ ] **P2.11** Numbered step labels in the existing dialog sections ("1. Get your Airbnb link",
      "2. Share our link with Airbnb") instead of new paragraphs; `InfoHint` on "Airbnb calendar URL"
      (where to find it in Airbnb, with the exact menu path), "Airbnb export link", "Sync now",
      "Remove", last-synced time and error states.
- [ ] **P2.12** Imported calendar error rows: make sure each error state has a one-line fix hint
      ("Link expired. Copy a fresh link from Airbnb and paste it again.").
- [ ] **P2.13** Keep the existing `FieldLabel` help strings in `ChannelSyncDialog` but rewrite to
      copy rules; they now work on touch via P0.2.
- [ ] **P2.14** Paused / unavailable states (`channelSyncAvailability`, `importAvailability`)
      keep their messages; restyle as `NoticeCallout tone="info"` only if it does not change layout.

**Rates form, date modal, save dialog**

- [ ] **P2.15** `InfoHint` on: weekend premium (which nights), fixed fees (when charged: per stay
      vs per night vs per guest), extra guest fee thresholds, minimum nights, date rule percentage
      (positive raises, negative lowers), rule priority when rules overlap, "blocked" dates.
      Skip: base rate.
- [ ] **P2.16** `PricingSaveDialog`: if it lists changes, a hint explaining that existing bookings
      keep the price they were booked at (verify that is true before writing it).
- [ ] **P2.17** Parking pricing mirror: same pattern, parking nouns.
- [ ] **P2.18** Add `presentation: 'modal' | 'inline'` to `HowItWorksDialog` and use the inline
      step view inside the Smart Pricing sheet on phone (addendum A5, decision D4).

---

### P3. Notifications (in-app, push, Telegram) and Telegram setup

Files: `bookings/pages/NotificationsPage.tsx`, `notifications/components/*`
(`NotificationsHubShell`, `NotificationsHubTabs`, `InAppNotificationsSection`,
`InAppNotificationsPanel`, `NotificationPreferencesCard`, `PushNotificationsCard`,
`NotificationBell`), `bookings/components/telegram-notifications/*`,
`bookings/components/Telegram*SettingsCard.tsx` (Admin, Chat, Finance, Maintenance, Marketing,
Staff), `parking/pages/ParkingNotificationsPage.tsx`,
`parking/components/TelegramParkingSettingsCard.tsx`, `ParkingNotificationTemplatesCard.tsx`.

- [x] **P3.1** `HowItWorksButton` "How notifications work". Shipped 2026-11-06: copy in `NOTIFICATIONS_HOW_IT_WORKS`. The entry point started in the header **Manage** sheet, then moved to the **?** beside the page title (property and parking) during the notifications polish pass — it sits with the title instead of competing with the **Manage** action. The channel comparison is the four steps themselves (In-app / Phone push / Telegram / Pick per channel). Steps:
  1. Something happens (new booking, guest message, payment, reminder).
  2. You get it in the bell here in the app, and as a phone push if you turn that on.
  3. You can also get it in Telegram, in your own chat or a group with your team.
  4. Pick which events you want in each place.
     Include a small three-column "channel" comparison (In-app / Phone push / Telegram: where it
     shows, needs setup or not, good for).
- [ ] **P3.2** First-visit `IntroCard` on the Notifications hub. **Shipped then removed 2026-11-06** by product decision: the banner was redundant with the tabs and pushed the KPIs down. The channel explainer now lives in the header **Manage** sheet, so do not re-add a banner here.
- [x] **P3.3** Tabs (Activity / Telegram): tab-level `InfoHint` is not allowed inside tab pills
      (nested button inside `SlidingTabsList` trigger). Instead put a section-title hint at the top
      of each tab panel. Re-run `remeasureDeps` check so the pill does not misalign.
      **Shipped 2026-11-06:** hint on the Activity card title (org-wide scope, same list as the bell). The Telegram tab already had its group heading and per-module descriptions, so no extra title hint there.
- [x] **P3.4** `NotificationPreferencesCard`: hint per preference group saying what triggers it and
      who receives it (just you vs everyone on the team, verify in `notification-preferences`).
      **Shipped 2026-11-06, A12 verified:** `notification-preferences` is per user (`user_id` only, no org column), so the card title says these apply to your account on every device, and each row reuses the existing group hint ("New bookings, check-ins, checkouts, refunds").
- [x] **P3.5** `PushNotificationsCard`: hint explaining per-device opt-in, iOS needs the app added
      to Home Screen first (PWA, see `docs/architecture/pwa.md`), and what "blocked" in the browser
      means with how to fix it. **Shipped 2026-11-06:** one hint on the card title, now inside the
      header **Manage** sheet; the blocked and add-to-Home-Screen cases stay as the inline status line.
- [ ] **P3.6** Telegram setup, the hardest part for non-technical hosts:
  - Turn `TelegramHelpDialog` into the Telegram `HowItWorksDialog` (or have it use the new
    component): 1. Create a bot with @BotFather and copy the token. 2. Paste the token here. 3. Start a chat with your bot (or add it to a group) and get the chat ID. 4. Send a test.
  - `InfoHint` on bot token (keep it secret, what it looks like), chat ID (how to find it,
    negative numbers are groups), `TelegramSecretInput`, `TelegramChatIdField`,
    `TelegramGlobalBotTokenCard` (global vs per-property bot).
  - Each module card (Admin, Chat, Finance, Maintenance, Marketing, Staff, Parking): one
    section-title hint saying what that card sends and when (e.g. Finance: payment reminders on
    the schedule you set). Confirm each against its `telegram-*-cron` / `-settings` function.
  - `TelegramToggleRow`: hint per toggle only where the label is not self-explanatory.
  - `TelegramModalNumberField`: units (days before, hours, Philippine time).
  - `TelegramTemplateEditor` + `TelegramPlaceholdersReference`: hint "Words in {{ }} are replaced
    with real booking details when the message sends."
- [x] **P3.7** Empty states: Activity with no notifications gets icon + one line + "Notification
      settings" link (no essay). **Shipped 2026-11-06** as icon + one line ("No notifications yet.").
      No settings link: the push settings now sit on the same tab directly above the list, so a link
      would point at something already on screen.
- [x] **P3.8** Parking notifications page mirrors the same treatment with parking nouns.
      **Shipped 2026-11-06:** same shell, cards, intro, How it works and hints on the parking page.
- [ ] **P3.9** Verify preference scope and recipients in `notification-preferences` before writing
      "just you" vs "everyone on the team" (addendum A12).

---

### P4. Templates (email templates, custom templates, chat templates)

Files: `bookings/pages/TemplatesPage.tsx`, `bookings/components/property-templates/*`
(`TemplateWorkbench`, `TemplateLibraryRail`, `TemplateLibraryCategoryFilter`,
`PropertyTemplateEditorCard`, `PropertyTemplateEditorPane`, `PropertyTemplatePlaceholdersDialog`,
`AddCustomTemplateDialog`, `SendCustomTemplateDialog`, `TemplateOrganiseDialogs`,
`TemplateSectionImageField`), `org/components/property-settings/PropertyEmailAutomationsSection.tsx`,
`PropertyEmailAutomationTogglePanel.tsx`, `parking/components/ParkingEmailAutomationSection.tsx`.

- [ ] **P4.1** `HowItWorksButton` "How templates work". Steps:
  1. Each booking step sends an email to the guest (booking received, documents needed, ready
     for check-in, and so on).
  2. Pick a template on the left to edit what that email says.
  3. Words in {{ }} fill in with the guest's real details when it sends.
  4. Custom templates are ones you send by hand from a booking.
     Map step 1 to the real status list from `booking-workflow.mdc` so names match.
- [ ] **P4.2** Library rail: badge on each built-in template saying **when it sends** (e.g.
      "Sends on: Ready for check-in"), sourced from the workflow side-effect map, not hard-coded text.
      Custom templates get a "Sent by you" badge.
- [ ] **P4.3** Hints on: category filter, placeholders button, section image field (size and where
      it shows), "Reset to default" (what is lost), send-test, organise / move dialogs.
- [ ] **P4.4** `SendCustomTemplateDialog`: hint on recipient and attachments; confirm wording that
      the email goes to the guest immediately.
- [ ] **P4.5** Email automations toggles (property + parking settings): hint on each toggle
      saying what turns off if disabled ("Guests won't get this email. The booking still moves to
      the next step."). Verify against `workflowOrchestrator` that disabling does not block the
      transition.
- [ ] **P4.6** Note the legacy `{{urgentBlock}}` placeholder is dead (Known sharp edges): make sure
      the placeholders reference does not list it.

---

### P5. Support and Help Center

Files: `help-support/components/TicketComposeForm.tsx`, `NewTicketModal.tsx`,
`help-support/pages/*`, `help-support/lib/supportTicketSchema.ts`.

- [ ] **P5.1** "Broken" (`bug_report`) selected: `NoticeCallout tone="thanks"` above the subject:
      short, warm, human. Draft (finalize with `human-copy`):
      "Thank you for telling us. Kame Space is new and still growing, and every report helps us fix
      things faster. We'll look into it and keep you posted here."
      Animate in with the existing reduced-motion-safe fade; no layout jump when switching categories
      (reserve the space or use height transition, check at 375px).
- [ ] **P5.2** Other categories get a one-line note only if useful:
      Idea: "We read every idea. Popular ones go on our roadmap." Question: link to Help Center
      search before sending. Business: "We usually reply within N business days" (confirm SLA with
      product; drop the number if none, decision D6).
- [ ] **P5.3** Hints on: "How urgent?" (what each level means and expected response), "How should
      we reach you?", attachments (what helps: screenshot, page link, steps).
- [ ] **P5.4** Bug report placeholder text in Details: a 3-line template (what you did, what
      happened, what you expected) as `placeholder`, not prefilled value (so the field is not dirty
      and the unsaved-changes guard is not triggered).
- [ ] **P5.5** Ticket status badges in the tickets workspace: hint on each status (Open, Waiting on
      you, Resolved, and so on; take names from the schema).
- [ ] **P5.6** Super-admin support pages untouched.

---

### P6. Marketing Studio

Files: `marketing/pages/MarketingStudioPage.tsx` and `marketing/components/**` (library,
ai-studio, calendar-builder, design-editor, video-editor, themes, media-library, publishing,
shared). Read `docs/guides/routes/org/property/marketing.md` and the in-progress
`marketing-studio-mobile-and-dashboard-responsive.md` plan first to avoid conflicting edits.

- [ ] **P6.1** Studio-level `HowItWorksButton` "How Marketing Studio works": 1. Pick a theme so
      everything matches your brand. 2. Create a post: AI Studio, a design, a video, or a calendar
      graphic. 3. Edit and save to your library. 4. Publish to Facebook or Instagram, or download.
- [ ] **P6.2** Mode tabs (`MarketingStudioModeTabs`): each mode gets a one-line hint in its empty
      state / home view (not inside the tab pill, see E6): what it makes and a typical use.
- [ ] **P6.3** AI Studio (`ai-studio/*`): hints on look picker, camera move picker, photo picker
      (which photos work best), refine box ("Tell it what to change"), results grid (AI credits used
      per generation, where credits come from, and that results can vary). Sample gallery banner keeps
      its copy. Generating stage: a one-line expected wait time.
- [ ] **P6.4** Calendar builder: hint explaining it turns your open dates and prices into a
      shareable availability graphic, and that it uses live calendar data at the time you save.
- [ ] **P6.5** Design editor (Polotno) and video editor (Remotion): no hints inside the canvas
      tool UI (third-party chrome). Add hints only in our own sidebars: format picker (sizes per
      platform), size dialog, music settings (license source Jamendo), scene settings, autosave
      status ("Saved automatically" meaning), history controls.
      Watch the Polotno chunk vs precache budget memory: do not import editor code from the shared
      help components.
- [ ] **P6.6** Themes: hints on theme AI describe, brand colors, and what "default theme" does.
- [ ] **P6.7** Media library: storage meter hint (P1 table), upload rules (size, types).
- [ ] **P6.8** Publishing (`PublishDialog`, `PublishHistory`): hints on page/account selector
      (needs Meta connection, link to Inbox Channels / settings), caption AI, and history statuses.
      Do not mention scheduling until `marketing-meta-publishing-gaps.md` ships.
- [ ] **P6.9** Template browser / gallery: hint on "Save as template" vs "Save".

---

### P7. Inbox

Files: `inbox/pages/*`, `inbox/components/*` (`InboxChannelsTab`, `InboxAutomationTab`,
`InboxQuickRepliesTab`, `InboxQuickReplyFormDialog`, `QuickReplyGroupTabs`, `InboxAiResponseDialog`,
`InboxFilterBar`, `InboxPlatformTabs`, `InboxPinnedSnippetsPanel`, `InboxInsertMenu`,
`MetaPagePickerDialog`, `MetaInboxOperationModal`, `GuestRequestCard`, `ChatTemplateMessage`).

- [ ] **P7.1** `HowItWorksButton` "How the inbox works": 1. Connect your Facebook Page and
      Instagram (Channels). 2. Guest messages from there and from your booking page chat land here. 3. Reply yourself, use quick replies, or let AI suggest a reply. 4. Turn on auto-reply if you
      want AI to answer simple questions for you.
- [ ] **P7.2** Channels tab: steps for Meta connect, what permissions are asked and why, what
      "Resubscribe" / "Disconnect" do, page picker hint (only Pages you admin show up).
- [ ] **P7.3** Automation tab: hints on every AI toggle, especially auto-reply: what it answers,
      what it never does (bookings, refunds; verify against `social-inbox-ai-suggest` safety rules),
      and how to see what it sent. `NoticeCallout tone="warning"` when auto-reply is on.
- [ ] **P7.4** Quick replies: hint on groups, shortcuts, and insert menu placeholders.
- [ ] **P7.5** `InboxAiResponseDialog` existing `FieldLabel` help: rewrite to copy rules.
- [ ] **P7.6** Filter bar and platform tabs: hint only on non-obvious filters (e.g. "Needs reply").
- [ ] **P7.7** `GuestRequestCard`: hint on what a guest request is and what Accept / Decline does.
- [ ] **P7.8** Parking inbox mirrors.

---

### P8. Settings and forms sweep (every dashboard form)

Method for each file: list every field, mark **help / skip** using the criteria below, write copy
in the module's `helpCopy.ts`, wire `help=` on `FieldLabel` or `InfoHint` on non-`FieldLabel`
labels, verify.

**Needs a hint when the field:** uses jargon (SD, GAF, iCal, ADR, slug, webhook, OTP, chat ID,
autopilot, placeholder), affects what guests see or receive, triggers an automatic action (email,
Telegram, AI, auto-approve), has a unit or range that is not obvious (%, hours, days before,
nights), falls back to an org or default value when empty, is irreversible, or is required by a
legal or building rule (PMO, pet, parking).
**Skip when:** name, email, phone, address, description/notes, plain amounts, dates, obvious
toggles whose label says everything.

| Area                                                                      | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Property settings** (biggest surface)                                   | `org/components/property-settings/*`: `PropertySettingsFields`, `PropertyProfileSettingsSections`, `PropertyOperationalSettingsSections`, `PropertyGuestFormSettingsSection`, `PropertyPaymentMethodsSection` + `PaymentProviderSelect`, `PropertyCancellationPolicySection`, `PropertyEmailAutomationsSection`, `PropertyGuestRewardsSection`, `PropertyVoucherSettingsBlock` + `VoucherRevealStylePicker`, `PropertyLocationSettingsBlock`, `PropertyExternalReviewsBlock`, `PropertySocialsBrandingSection`, `PropertyHouseRulesManageDialog`, `PropertyAmenitiesManageDialog`, `SensitiveSettingsOtpDialog` (why a code is needed) |
| **Org settings**                                                          | `org/components/org-settings/*`: `OrgSettingsFields`, `OrgProfileSettingsSections`, `OrgAiSettingsSection`, `OrgVoiceReceptionistGroup`, `OrgSuperhostProgressSection` (what each requirement means), `OrgDangerZoneSection` (exact consequences)                                                                                                                                                                                                                                                                                                                                                                                      |
| **Onboarding / verification**                                             | `org/pages/OnboardingPage.tsx`, `org/components/onboarding/*` (`VerificationFieldLabel`, `OnboardingVerificationRightsFields`): why each document is needed and who sees it                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Parking settings**                                                      | `parking/pages/ParkingSettingsPage.tsx`, `ParkingSettingsCard`, `ParkingDetailsSection`, `ParkingFeaturesSection`, `ParkingBookingAutomationSection` (existing help, rewrite), `ParkingDirectLinkCard`, `ParkingSettingsIssuesSync`                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Bookings**                                                              | `bookings/pages/BookingDetailPage.tsx`, workflow panel (`workflow-panel/*`): hint on each action button saying what it sends and moves to (from `workflow.ts` side-effect map); `BookingPricingSummary` lines (down payment, balance, SD); `AdminSettingsPage`; manual new booking modal; parking `AdminParkingNewBookingModal`                                                                                                                                                                                                                                                                                                        |
| **Finance**                                                               | `finance/components/OperatingLineItemForm`, `RecurringSeriesModal`, `StayFinanceModal`, `TelegramReminderSchedulePreview`, `FinanceStaysViewToggle`, category combobox                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Maintenance**                                                           | `MaintenanceItemForm`, `RecurringSeriesModal`, `MaintenanceTelegramFilter`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Team**                                                                  | `InviteMemberDialog`, `OrgInviteMemberDialog`, `CustomRoleFormDialog` (existing help), `ApplyTemplatePicker`, `PermissionsTreeView` (view vs edit), `StandardRolesSection` (what each built-in role can do), `OrgRoleListingAccessSection`, `OrgListingAssignmentPicker`. Plus a "How roles work" `HowItWorksDialog`: org vs property vs parking access.                                                                                                                                                                                                                                                                               |
| **Public Pages / Custom pages / Page editor**                             | `custom-pages/pages/CustomPagesPage.tsx`, `PublicPageCard`, `CopyLinksMenu`, `StayDatesLinkModal`, `BookingLinkPickerModal` (new, uncommitted on this branch, coordinate), `page-editor/components/shared/StyleControls.tsx` (existing help). "How public pages work" dialog: which links to share with whom.                                                                                                                                                                                                                                                                                                                          |
| **Plans**                                                                 | `PlanFeatureMatrix` (hint per non-obvious feature row, sourced from `planPresentation.ts` so `/for-hosts/pricing` stays in sync), `PlanReviewDialog` (proration / when billing changes), `TierBadge` tooltip text                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Analytics, Activity, Announcements, Setup guide, Import, AI assistant** | Analytics: re-verify. Activity log: hint on filters and event severities. Announcements: severity. Setup guide (`setup-guide/*`): each step says why it matters. Import (`import/*`): file format and what is overwritten vs added. AI assistant (`ai-assistant/*`): Advanced / AI mode toggle hint, what the assistant can and cannot change.                                                                                                                                                                                                                                                                                         |

- [ ] **P8.1** to **P8.11**: one checkbox per row above, each with its own PR-sized slice.
- [ ] **P8.12** Every touched modal/form with manual Save: confirm the guard (`useUnsavedChangesGuard`
      / `useGuardedClose`) still reports clean after opening and closing hints (hints never touch form
      state).
- [ ] **P8.13** Add one E2E for a dirty settings form: open and close a hint, then navigate away.
      The guard must still prompt, and opening the hint must not mark the form dirty (addendum A6,
      E22).

---

### P9. Feature intro coverage (`HowItWorks` + `IntroCard` matrix)

| Feature           | HowItWorks | IntroCard on first visit             | Entry point                      |
| ----------------- | ---------- | ------------------------------------ | -------------------------------- |
| Pricing (overall) | yes        | no                                   | Pricing header                   |
| Smart Pricing     | yes        | yes (inside dialog, only while off)  | Smart Pricing dialog             |
| Channel sync      | yes        | yes (only when no feeds)             | Channel sync dialog              |
| Notifications     | yes        | yes                                  | Notifications header             |
| Telegram          | yes        | no (setup flow is the intro)         | Telegram tab                     |
| Templates         | yes        | yes                                  | Templates header                 |
| Marketing Studio  | yes        | yes                                  | Studio header                    |
| Inbox             | yes        | yes (only when no channel connected) | Inbox header                     |
| Team and roles    | yes        | no                                   | Team header                      |
| Public Pages      | yes        | yes                                  | Public Pages header              |
| Finance           | yes        | no                                   | Finance header (auto vs manual)  |
| Maintenance       | yes        | no                                   | Maintenance header               |
| Bookings workflow | yes        | no                                   | Bookings header (the stage flow) |

- [ ] **P9.1** At most **one** IntroCard visible per page at a time, never in addition to an
      announcement banner or plan upgrade banner on the same view (priority: blocking banners first).
- [ ] **P9.2** IntroCard hides when the user lacks view permission for the feature or the feature
      is off in feature availability.
- [ ] **P9.3** "Learn more" in every How it works dialog links to the matching Help Center
      article if one exists (`HelpDocumentationPage` topics); else omit the link.
- [ ] **P9.4** Inventory the Help Center topics and create the missing articles for Smart Pricing,
      Channel sync, Telegram setup, Templates, and the stat definitions (addendum A4). Do not ship
      a dead "Learn more" link.
- [ ] **P9.5** Enforce one intro card per page and let blocking banners win (addendum A8). Add the
      `blocked` prop and the slot guard before P3 ships its first card.

---

### P10. Docs, support content, QA (required before claiming done)

- [ ] **P10.1** `documentation-maintenance`: `docs/architecture/contextual-help.md` (new),
      `overview.md`, `PROJECT.md` component index.
- [ ] **P10.2** `route-guides`: update every touched guide under `docs/guides/routes/org/**`
      (dashboard, pricing, notifications, templates, marketing, inbox, help-support, settings, team,
      finance, maintenance, public-pages, custom-pages, analytics, plans, parking/*) with a "Help in
      this page" line.
- [ ] **P10.3** `mobile-responsive`: check every touched screen at 375 / 768 / 1024 / 1280, in
      bottom sheets, in the AI mode live canvas (narrow container).
- [ ] **P10.4** `support-content`: reuse the same copy for Host-facing knowledge Q&A and
      `docs/guides/support/faqs.md` (Smart Pricing, Channel sync, Telegram setup, Templates, stat card
      definitions). Run `bun run check:support-content` and `bun run check:ai-knowledge-coverage`.
      Keep `metricGlossary.ts` and `METRIC_EXPLANATIONS` in sync.
- [ ] **P10.5** `audit-logging`: activity-log: N/A, help UI does not mutate org/property/parking
      state (dismissals are local per-viewer).
- [ ] **P10.6** `plans-and-permissions`: N/A for gating (help is visible to every role and plan);
      confirm no hint reveals a gated feature's controls.
- [ ] **P10.7** `unsaved-changes-guard`: covered by P8.12.
- [ ] **P10.8** `bun run ci:quality` (lint, type-check, Vitest incl. P0.9 guard, Deno, Playwright
      smoke incl. P0.13, build) plus `bun run check:filenames`.
- [ ] **P10.9** Manual QA pass using the `property-dashboard-qa` skill for property pages and the
      same checklist for org and parking pages: hover, tap, keyboard, screen reader (VoiceOver iOS +
      macOS), dark mode, RTL smoke, reduced motion.
- [ ] **P10.10** Copy review: one pass reading every `helpCopy.ts` file aloud for tone and
      consistency (same term for the same thing everywhere).
- [ ] **P10.11** Export the same help copy to the support layer (addendum A1) and add the drift
      test. The Help Center and the UI must not answer the same question differently.
- [ ] **P10.12** Record the observability decision (addendum A21): either `observability: N/A`
      with a one-line reason, or one `help_opened` event keyed by feature, no PII.
- [ ] **P10.13** Add `print:hidden` to `InfoHint`, `IntroCard`, and `HowItWorksButton` (addendum
      A18).

## Plan review addendum (2026-11-05)

Reviewed end to end after P0 shipped. These gaps were missing or under-specified. Each becomes a
task in the phase where it belongs; none is optional for the phases that follow.

### Blocking gaps

| #   | Gap                                                                                                                                                                                                                  | Amendment                                                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **Help copy has two homes.** P10.4 says reuse `helpCopy` in the Help Center, but the support sync reads `docs/**`, not TypeScript. Without a bridge, the UI and the FAQ answer the same question differently.        | Give every `HelpCopyEntry` a stable `contentKey`. Add `scripts/dev/export-help-copy.ts` (or extend `sync-ai-knowledge-base.ts`) to emit the FAQ rows / `content_key`s from the same modules. Add a drift test that fails when a key changes in one place only.                                                                                                                    |
| A2  | **P1.2 is a `StatCard` refactor, not a per-card fix.** `to` / `onClick` wrap the whole card, so any hint inside is a nested interactive element.                                                                     | Change `StatCard` once: `relative` shell, absolutely positioned `<Link>` / `<button>` overlay with an accessible name, content above it, `titleAdornment` at `relative z-10`. Preserve `active`, `aria-current`, focus ring, and the native press. Ship as its own PR with a screenshot diff before any P1 hint. Add tests for no nested interactive elements and keyboard order. |
| A3  | **Analytics copy already exists twice.** `metricGlossary.ts` (UI) and `_shared/dashboardAssistantAnalyticsTools.ts#METRIC_EXPLANATIONS` (edge) duplicate the same definitions, and P0 makes the UI copy user-facing. | Add a parity test (Vitest reading both, or one shared JSON imported by both). P1's Analytics row is not done until the parity test passes.                                                                                                                                                                                                                                        |
| A4  | **"Learn more" can be a dead link.** P9.3 links only when an article exists, but no inventory step exists.                                                                                                           | P9.4: inventory `HelpDocumentationPage` topics. Create articles for Smart Pricing, Channel sync, Telegram setup, Templates, and stat definitions, or omit the link. Dead links are worse than no link.                                                                                                                                                                            |
| A5  | **Nested How it works on phone (D4).** `HowItWorksDialog` is a `ResponsiveModal`; opening it from the Smart Pricing sheet stacks two bottom sheets.                                                                  | Add `presentation?: 'modal' \| 'inline'` (or `nested`). On phone, render the steps inside the existing sheet with a back control; on desktop, nested dialog is fine. P2.5 cannot ship correctly without this.                                                                                                                                                                     |
| A6  | **`aria-describedby` is not wired anywhere yet.** `InfoHint` supports it, but a short label is still the only thing a screen reader hears on focus.                                                                  | P0.14 ships the API; P2/P3/P8 must use it on fields whose visible label is a noun (Strengths, Never below, chat ID, SD, etc.). Do not duplicate the popover content on the trigger and the input at the same time.                                                                                                                                                                |
| A7  | **`SectionTitle` truncates but callers may not want truncation** (e.g. a two-line card title).                                                                                                                       | Keep `truncate` for one-line card headers; allow `titleClassName` or a `wrap` prop for two-line titles. Verify every P1 card at 375px before shipping.                                                                                                                                                                                                                            |
| A8  | **IntroCard has no slot guard (P9.1).** Two modules on one page could both render a card, and an announcement banner could sit above it.                                                                             | Add a `blocked?: boolean` prop (callers pass plan-limit / announcement state) and a tiny `HelpIntroSlotProvider` in `components/help` that only lets one card render per page. Add the priority rule to the architecture doc.                                                                                                                                                     |
| A9  | **`total revenue` / `total bookings` renames (D1/D2) are a cross-surface change.** Renaming changes labels, route guides, FAQs, E2E selectors, and screenshots, not just a string.                                   | If approved, do a standalone copy-only PR before P1 hints: rename in `DashboardStatCards`, parking, route guides, `faqs.md`, and any E2E that reads the title. Until then, do not write a hint that apologizes for the label.                                                                                                                                                     |
| A10 | **Pricing constants are quoted before verification.** P2.6 says Gentle ±6% / Balanced ±12% / Bold ±22%, but the engine is the source of truth.                                                                       | P2.0: read `_shared/smartPricingEngine.ts` (and the cron schedule in `smart-pricing-cron`) and confirm every number, the gap-night rule, and the autopilot cadence before writing copy.                                                                                                                                                                                           |
| A11 | **Channel sync interval can be env-overridden**, so "about every 30 minutes" can be false.                                                                                                                           | Read `_shared/calendarSyncRun.ts#CALENDAR_SYNC_MIN_INTERVAL_MINUTES_DEFAULT` and either surface the effective interval or keep the approximate wording with a code comment. Never promise an exact minute.                                                                                                                                                                        |
| A12 | **Notification preference scope is unverified.** It is unclear whether preferences are per user, per property, or org-wide, and who receives each event.                                                             | P3.4: verify in `notification-preferences` before writing "just you" vs "everyone on the team". The wrong copy causes missed alerts.                                                                                                                                                                                                                                              |
| A13 | **Team inheritance wording is unverified.** "From Organization" cards imply org members automatically get property access, which may not be true.                                                                    | P8.9/P9: verify `resolveScoped*Access` and the seeded role templates before writing inheritance copy.                                                                                                                                                                                                                                                                             |
| A14 | **Finance auto-included rows are unverified.** Saying "booking amounts flow in automatically" is wrong if the service only includes selected statuses.                                                               | P1 Finance row / P8.2: read `_shared/financeService.ts` and state the exact statuses and date-range behavior.                                                                                                                                                                                                                                                                     |
| A15 | **"vs last period" logic is unverified.** P1.5 says "same number of days right before this range"; confirm the prior window, especially at month boundaries.                                                         | **Verified 2026-11-05:** `previousPeriodRange` is exactly the same number of days immediately before `from`. Also verified: the **org card's occupancy is period-based** (`occupiedNights / (periodDays × listingCount)`), not the forward-30-day attention metric. The original P1 table said otherwise and is corrected.                                                        |
| A16 | **Plans usage reset windows are unverified.** "Resets monthly" may be billing-cycle or calendar-month, and AI credits may be pooled at org level.                                                                    | Read `property-entitlements` / `plans` before writing meters.                                                                                                                                                                                                                                                                                                                     |
| A17 | **Intro-card dismissals accumulate on shared devices.** Per-user keys are correct, but old users' keys are never cleared.                                                                                            | Optional: clear `kh.help.intro.<userId>.*` on sign-out. At minimum, document the growth is bounded (one key per feature per user) and never store PII.                                                                                                                                                                                                                            |
| A18 | **Help chrome prints.** Intro cards, hint icons, and the How it works button can appear in print/PDF output.                                                                                                         | Add `print:hidden` to the three components. Low risk, one-line each.                                                                                                                                                                                                                                                                                                              |
| A19 | **Reduced motion is only partly covered.** `NoticeCallout` and `IntroCard` use `motion-safe:`; the modal animations are untested.                                                                                    | Add a Playwright check with `emulateMedia({ reducedMotion: 'reduce' })` that the panel still opens and the steps are readable.                                                                                                                                                                                                                                                    |
| A20 | **Selector audit is broader than 5 matchers.** There are ~28 regex button matchers today, not 5.                                                                                                                     | Audit all of them; anchor with `^` when the accessible name starts with the feature word. Rule for new specs: a regex name must anchor at the start or scope to a container.                                                                                                                                                                                                      |
| A21 | **No observability decision is recorded.** The plan adds a new user-facing action (open help) without saying whether it is measured.                                                                                 | P10: record `observability: N/A` (help is passive, no funnel decision) or add one PostHog event with the feature key and no PII. Do not add per-hint events without a question they answer.                                                                                                                                                                                       |
| A22 | **Stat definitions can drift from the server.** A source comment is easy to ignore.                                                                                                                                  | Make `metricDefinitions.ts` entries `{ text, source }` and add a test that every entry has a `source` path that exists and contains the named function / constant.                                                                                                                                                                                                                |
| A23 | **No sequencing note for the P0 branch.** P0 is off `develop`; E30/E31 work is still uncommitted on another branch.                                                                                                  | Keep P0 isolated. Rebase P6 after the Marketing mobile plan lands and the Public Pages slice after its uncommitted work lands. Do not mix those files into the P0 PR.                                                                                                                                                                                                             |
| A24 | **Smart Pricing turn-off copy is unverified.** "Resets nights back to your saved rates" must match what the engine actually does on disable.                                                                         | P2.9: confirm the reset behavior before keeping the string.                                                                                                                                                                                                                                                                                                                       |

### Decisions

- **D1 / D2:** the user leans toward renaming ("Net income", "Nights booked"). Treat as **pending
  final confirmation**. If approved, do the rename as a standalone copy-only PR (A9), then write
  hints against the new labels. Do not ship a hint that explains a misleading label.
- **D3:** decided. `localStorage`, per viewer and device. Implemented in P0.6.
- **D4:** recommended in-sheet step view on phone. Add the `presentation` prop in A5 before P2.5.
- **D5:** needs a visual check at 375px. P2.3 decides labels vs the How it works dialog.
- **D6:** do not state a response time until product confirms support can meet it. Omit the number
  from the Business category copy until then.

---

## Edge cases and how each is handled

| #   | Edge case                                                                                                                          | Handling                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Tooltip does not open on tap (current `FieldHelpTooltip` bug)                                                                      | `InfoHint` uses Popover on coarse pointers (P0.1, P0.2).                                                                                                                         |
| E2  | Touch laptop / iPad with trackpad / narrow desktop window                                                                          | Detect by `(hover: hover) and (pointer: fine)`, not width. Popover also opens on click for mouse users, so both always work.                                                     |
| E3  | Hint inside a `<label>` toggles the checkbox/switch or focuses the input                                                           | Hint renders outside the `<label>` element (sibling in a flex row), plus `stopPropagation` + `preventDefault`.                                                                   |
| E4  | Hint inside a `<form>` submits it                                                                                                  | `type="button"` always.                                                                                                                                                          |
| E5  | Hint inside a clickable stat card / link card navigates or nests interactive elements                                              | Stretched-link restructure (P1.2).                                                                                                                                               |
| E6  | Hint inside tab pills, sortable table headers, select triggers, accordion triggers                                                 | Not allowed. Put the hint in the panel title or column header text outside the button. Lint check: grep in review for `InfoHint` inside `TabsTrigger` / `SelectTrigger`.         |
| E7  | Hint in a Dialog or vaul bottom sheet: z-index, focus trap, drag gesture                                                           | Portal into the active modal container, z above sheet, `pointerdown` stopPropagation so sheet drag does not start; Esc closes the popover first, then the dialog (Radix layers). |
| E8  | Modal on modal (How it works opened from Smart Pricing dialog) on phone                                                            | Decision D4: render as an in-sheet step view on phone, nested dialog only on desktop.                                                                                            |
| E9  | Label row grows when the 24px hint box appears (layout shift)                                                                      | `-my-1` on the hint box; screenshot diff in P0 exit check.                                                                                                                       |
| E10 | Long titles truncate and push the hint off-screen                                                                                  | Title `min-w-0 truncate`, hint `shrink-0`.                                                                                                                                       |
| E11 | 2-column stat grid at 375px: title + icon + hint wrap                                                                              | Allow title to wrap to 2 lines, keep hint on the first line; verify every grid in P1 at 375.                                                                                     |
| E12 | Skeleton to loaded shift                                                                                                           | Skeletons reserve the hint slot (P1.3).                                                                                                                                          |
| E13 | Read-only member, plan-gated, or feature-paused screens                                                                            | Hints and How it works stay usable; they never show controls the user cannot use. Watermark overlay (`PlanGateWatermarkOverlay`) may cover hints; acceptable.                    |
| E14 | Shared components used by both property and parking                                                                                | Copy functions take a `noun` (`'night' / 'slot'`, `'property' / 'parking'`) instead of hard-coded words.                                                                         |
| E15 | Copy drifts from the real formula after a backend change                                                                           | Formula source comment beside each definition; shared `metricDefinitions.ts`; support-content check.                                                                             |
| E16 | Storage blocked (private mode, Safari ITP) for IntroCard dismissal                                                                 | try/catch, in-memory fallback per session (P0.6).                                                                                                                                |
| E17 | IntroCard flashes then disappears                                                                                                  | Render nothing until dismissal state is read (sync read in `useState` initializer).                                                                                              |
| E18 | Multiple users on one shared device                                                                                                | Dismissal key includes user id.                                                                                                                                                  |
| E19 | Several popovers open at once                                                                                                      | Opening one closes others (Radix outside-click); verify on touch.                                                                                                                |
| E20 | Screen readers                                                                                                                     | `aria-label="About <label>"` on trigger; optional `aria-describedby` on the field; How it works steps as an ordered list.                                                        |
| E21 | Keyboard trap / focus loss when popover closes                                                                                     | Focus returns to the trigger (Radix default); verify inside dialogs.                                                                                                             |
| E22 | Unsaved-changes guard falsely triggered                                                                                            | Hints and placeholders never write form state (P8.12, P5.4).                                                                                                                     |
| E23 | E2E strict-mode failures from new "About X" buttons                                                                                | P0.12 selector audit.                                                                                                                                                            |
| E24 | Component tests (`.test.tsx`) are silently skipped by Vitest                                                                       | Guards are `.ts` (P0.9); UI behavior covered by Playwright (P0.13).                                                                                                              |
| E25 | Bundle size / PWA precache budget                                                                                                  | Help components are tiny and live in `components/help/`; never import marketing editor code; check build budget in P10.8.                                                        |
| E26 | AI mode live canvas renders pages in a narrow container                                                                            | Popover collision boundary is the viewport; verify hints inside the canvas.                                                                                                      |
| E27 | Dark mode / brand colors                                                                                                           | Token colors only (`muted-foreground`, `primary`, existing amber/emerald tokens).                                                                                                |
| E28 | Reduced motion                                                                                                                     | Callout and IntroCard animations respect `prefers-reduced-motion`.                                                                                                               |
| E29 | Category switch on Support form jumps layout                                                                                       | Height transition or reserved space for the callout (P5.1).                                                                                                                      |
| E30 | Uncommitted Public Pages work on `feat/support-content-faq-sync` (`BookingLinkPickerModal`, `CopyLinksMenu`, `StayDatesLinkModal`) | Do P8 Public Pages slice after that work lands, to avoid conflicts.                                                                                                              |
| E31 | In-progress Marketing mobile plan touches the same files                                                                           | Coordinate P6 with `in-progress/marketing-studio-mobile-and-dashboard-responsive.md`; land after or rebase carefully.                                                            |

## Open decisions

- **D1. "Total Revenue" on the property and parking dashboards is host net, not gross revenue.**
  Options: (a) keep the title, explain in the hint (no behavior change, this plan's default);
  (b) rename to "Net income" to match Finance. Recommend (b) in a separate tiny change, because a
  hint that says "this is not total revenue" is a smell.
- **D2. "Total Bookings" shows nights booked over nights in the period** (e.g. "12 / 30").
  Options: keep and explain, or rename to "Nights booked". Recommend rename, same reasoning as D1.
- **D3. IntroCard dismissal storage.** Default: `localStorage` per user per device (no migration,
  per-viewer convenience). Alternative: server-side `user_preferences` so it follows the user
  across devices. Recommend local for now.
- **D4. Smart Pricing How it works on phone:** in-sheet step view (recommended) vs nested bottom
  sheet.
- **D5. Mobile hero icon-only buttons on Pricing:** add tiny labels under icons or rely on the
  How it works dialog. Needs a quick visual check.
- **D6. Support response time promise** for Business tickets: only state a number if support can
  meet it.

## Follow-up ticket (public pages)

Public and guest pages (booking form, calendar, SD form, guest portal, property showcase, parking
booking, `/for-hosts/*`) get the same treatment later, reusing `InfoHint` / `NoticeCallout`.
Tracked in GitHub: [#296](https://github.com/sprmke/kame-space/issues/296).

## Rollout order and size

| Phase | Size                                  | Depends on                 |
| ----- | ------------------------------------- | -------------------------- |
| P0    | M                                     | none                       |
| P1    | M                                     | P0                         |
| P2    | M                                     | P0                         |
| P3    | M                                     | P0                         |
| P4    | S to M                                | P0                         |
| P5    | S                                     | P0                         |
| P6    | L                                     | P0, E31                    |
| P7    | M                                     | P0                         |
| P8    | L (11 slices)                         | P0, E30 for Public Pages   |
| P9    | S                                     | P0.4 to P0.6, phases above |
| P10   | M, runs per slice and once at the end | all                        |
