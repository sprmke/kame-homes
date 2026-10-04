---
title: 'Dashboard mobile native v2 (ground-up phone redesign)'
stage: planned
status: not started
tags: [mobile-responsive, mobile-native, dashboard, design-system, gestures]
updated: 2026-10-04
kind: plan
---

# Dashboard mobile native v2

Rebuild every dashboard screen's **phone layout** (`max-lg`) so it looks and behaves like a native iOS/Android app, matching the product shots in `marketing/social/src/features/*Screens.tsx`. Desktop (`lg+`) keeps its current layout and behavior. Every desktop capability stays reachable on phone.

Public pages (marketing site, guest flows, account) come after this. They have their own follow-up task list at the end of this plan.

## 1. Why v2 (what is wrong today)

[`mobile-native-redesign.md`](../for-testing/mobile-native-redesign.md) (phases 0 to 4at) already fixed the **structure**: bottom tab bar, More sheet, `ResponsiveModal` bottom sheets with drag-to-dismiss, `MobileChoiceSheet`, `ContextualActionBar`, list refine sheets, skeletons. That work stays.

What it did not fix is the **screen composition**. Phone pages are still the desktop page re-flowed into one column:

| Today (phone)                                                                         | Marketing shots (target)                                                                                       |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Teal `MobileBrandHero` band with tenant switcher, title, ··· menu                     | Large left-aligned title (≈30px, bold, tight tracking) on a plain paper canvas, one trailing pill or action    |
| Card grids with status badge + ⋯ per card (e.g. `MaintenanceRemindersCardGrid`)       | **Grouped list sections** ("Today", "Next 30 days", "Done") of rows inside one rounded card, hairline dividers |
| Completing a task = open ⋯ menu or edit modal                                         | **Check circle** on the row completes it in one tap                                                            |
| Very dense type (row titles 13px, meta 11px) from phases 4af/4aj/4m                   | Row title 15px semibold, sub 12.5px muted, section label 13px muted                                            |
| Borderless `shadow-native` floating cards                                             | White cards, 1px hairline border, ~22px radius, no shadow                                                      |
| Tables/kanban squeezed into cards; stat grids with icons                              | 2-up metric tiles with one delta line; one chart card; one "What to try" insight card with a single CTA        |
| Small outline buttons, actions hidden in ⋯                                            | Full-width pill buttons (h≈46px), paired actions ("Message guest" / "Open booking")                            |
| Settings as long forms with inputs everywhere                                         | **Toggle rows** and drill-in rows (title + sub + chevron) that open a focused editor                           |
| No swipe actions, no pull-to-refresh, no push/pop motion, no tab re-tap scroll-to-top | Native gestures throughout (section 5)                                                                         |

Reference screens (all authored at 393×852 iPhone points in `marketing/social/src/features/kit.tsx`):

| Shot            | Source component                        | Real route it should match                      |
| --------------- | --------------------------------------- | ----------------------------------------------- |
| Maintenance     | `opsScreens.tsx#MaintenanceScreen`      | `…/property/:p/maintenance`                     |
| Team member     | `opsScreens.tsx#TeamScreen`             | `…/team` member detail                          |
| Ask Kame (AI)   | `opsScreens.tsx#AiModeScreen`           | AI assistant sheet + AI mode                    |
| Alerts          | `opsScreens.tsx#AlertsScreen`           | Notifications sheet / page                      |
| Insights        | `growthScreens.tsx#InsightsScreen`      | `…/analytics` (+ dashboard stats)               |
| Content Studio  | `growthScreens.tsx#ContentStudioScreen` | `…/marketing`                                   |
| Booking site    | `guestScreens.tsx#BookingSiteScreen`    | Public property page (follow-up, section 11)    |
| Receptionist    | `guestScreens.tsx#ReceptionistScreen`   | Guest voice (follow-up) + Inbox transcript view |
| Pricing         | `bookingScreens.tsx#PricingScreen`      | `…/pricing` (Smart Pricing)                     |
| Calendar        | `bookingScreens.tsx#SyncCalendarScreen` | `…/pricing` calendar view + Channel Sync        |
| Payment receipt | `bookingScreens.tsx#ReceiptCheckScreen` | Booking detail → receipt / AI receipt check     |
| Booking         | `bookingScreens.tsx#BookingFlowScreen`  | `…/bookings/:bookingId`                         |

## 2. Decisions

### Locked (from the request)

1. Phone layouts are rebuilt per page, not re-styled. A page may render a different component tree below `lg`.
2. Desktop (`lg+`) layout and behavior do not change in this plan.
3. **Functional parity:** every action, field, filter, export and state available on desktop is reachable on phone (possibly one level deeper, in a sheet or drill-in screen).
4. Phone content is minimal: one primary job per screen, secondary things behind drill-in, sheet or ···.
5. Dashboard first. Public pages are a separate follow-up (section 11).

### Needs a call before Phase 1 (recommendation first)

| #   | Question                                                                                    | Recommendation                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Retire the teal `MobileBrandHero` on phone?                                                 | **Yes.** Replace with `LargeTitleHeader` on paper (matches every shot). Keep the `AdminMobilePage` prop API so pages migrate without rewrites. This reverses phases 4e, 4p, 4w, 4ao, 4ap (hero arc/collapse work).                                                                |
| D2  | Port marketing palette v3 (emerald `162 80% 30%` + graphite darks) into `ui/src/index.css`? | **Yes, app-wide, as Phase 0b**, so app and marketing match. It touches desktop colors too (only colors, not layout). If you'd rather keep desktop as-is, scope the new tokens to `max-lg` and accept two greens for a while.                                                      |
| D3  | Reverse the "native density" type scale (phases 4af, 4aj, 4m) on phone?                     | **Yes.** Adopt the shot scale: page title 28 to 30px, row title 15px, sub 12.5 to 13px, section label 13px. Update `mobile-responsive.mdc` §4, which currently forbids larger phone titles.                                                                                       |
| D4  | Where does the tenant (org / property / parking) switcher go once the hero is gone?         | Small tappable eyebrow above the large title on **root tab pages only** ("Skyline Suite 2604 ⌄"), opening the existing switcher as a sheet. Detail pages show a back link instead.                                                                                                |
| D5  | Custom pull-to-refresh in a normal browser tab?                                             | **Standalone PWA only** (`display-mode: standalone`). In a browser tab the browser's own pull-to-reload stays.                                                                                                                                                                    |
| D6  | Gesture library                                                                             | **No new dependency.** `framer-motion` (already installed) for drag/swipe/springs; pointer events for long-press; the existing `sheetDrag.ts` approach for thresholds. Revisit only if a spike fails.                                                                             |
| D7  | Super-admin console (`/admin/*`) in scope?                                                  | **Native-lite only** (Phase 9): shared header, grouped lists, sheets. No per-page bespoke redesign; it is an internal tool.                                                                                                                                                       |
| D8  | Marketing Studio editors (Polotno design, Remotion video)                                   | Keep [`marketing-studio-mobile-and-dashboard-responsive.md`](./marketing-studio-mobile-and-dashboard-responsive.md) as the owner of editor internals. This plan only redesigns the Studio **landing/composer** (Content Studio shot) and the editor chrome (header, bottom bars). |

## 3. Design language: "Native v2" spec

Goes into `DESIGN.md` §8 and the updated `mobile-responsive.mdc`. All values are phone (`max-lg`) only.

### Canvas and surfaces

- Page canvas: paper (`--background`, near-neutral light; graphite in dark mode). No colored band at the top.
- Card: white (`--card`), `1px` hairline (`--border`), radius ≈ 22px (`rounded-[1.375rem]`), padding 16px, **no shadow**. Gap between cards 10 to 12px. Side gutter 16px.
- Grouped list: one card holding N rows; rows divided by hairline; row padding 12px vertical. No nested cards inside cards.
- Dark planes (graphite/night) only for one emphasis card per screen (e.g. "What to try", AI insight), never for whole pages in light mode.

### Type (phone)

| Role                     | Size / weight                             |
| ------------------------ | ----------------------------------------- |
| Large page title         | 28 to 30px / 700, −0.035em                |
| Compact (scrolled) title | 17px / 600, centered or inline in top bar |
| Section label            | 13px / 600 muted                          |
| Row / card title         | 15px / 600 to 700                         |
| Row sub / meta           | 12.5 to 13px muted                        |
| Hero number (₱8,400.00)  | 34 to 40px / 700 tabular                  |
| Metric tile value        | 24 to 28px / 700 tabular                  |
| Pill                     | 12 to 13px / 700                          |

### Components (shot vocabulary)

- **Pill**: tones `brand`, `soft` (tint bg + brand-deep text), `muted`, `dark`, `sun` (warning/time), `coral` (overdue/negative), `mint` (on dark). Replaces ad-hoc badge colors on phone. Maps onto existing `statusToneColors`.
- **CheckDot**: 24px circle, hairline ring when open, filled brand with white check when done.
- **Avatar**: 32 to 36px initials circle, soft tint.
- **IconTile**: 36 to 38px rounded square, tint bg, brand-deep icon. Row lead for activity, settings, receipts.
- **Toggle row**: title + sub left, `Switch` right, whole row tappable.
- **Drill-in row**: title + sub left, value/pill + chevron right, pushes a sub-screen or sheet.
- **Date pill**: trailing muted pill ("Oct 28"), `sun` when today/time-bound ("2 PM").
- **Pill buttons**: h-12 `rounded-full`; dark (default primary on light), brand (confirm/success), ghost (secondary). Paired buttons split 50/50.
- **Metric tile**: label, value, one delta line (brand when up, coral when down).
- **Insight card**: dark plane, small icon + eyebrow, one sentence, one mint CTA.
- **Stage progress**: diamond/dot stepper with filled segments (booking status).
- **Key-value list**: label left muted, value right bold, dotted or hairline separators (receipt).
- **Week strip**: horizontally scrollable day chips with price under the date (pricing).

### Motion

- Spring-based, short (180 to 260ms). Respect `prefers-reduced-motion` everywhere (fade only).
- Press: `scale(0.98)` + background tint on rows/buttons (`native-press` already exists; re-tune).
- No decorative perpetual motion on dashboard screens.

## 4. Architecture

### 4a. New primitives (`ui/src/components/mobile/native/`)

Named exports, `PascalCase.tsx`, no barrel re-exports across features. Each renders only what phone needs; desktop code paths never import them unless desired.

| Primitive                                                          | Purpose                                                                                                              |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `LargeTitleHeader`                                                 | Large title, optional eyebrow (tenant switcher), trailing slot (pill or one action), optional back link              |
| `NativeTopBar`                                                     | Sticky translucent bar (blur, hairline when scrolled) that shows the compact title once the large title scrolls away |
| `useLargeTitleCollapse`                                            | Scroll observer driving the large → compact title handoff (replaces `useMobileHeroCollapseProgress`)                 |
| `NativeScreen`                                                     | Page frame: header + body + bottom clearance; replaces `AdminMobilePage` internals (same props kept)                 |
| `ListSection`                                                      | Section label + grouped card + optional footer/"See all"                                                             |
| `ListRow`                                                          | lead / title / sub / trailing / chevron; `as="button"                                                                | "link"`; press state; optional `swipeActions` |
| `TaskRow`                                                          | `ListRow` with `CheckDot` lead + optimistic toggle + undo toast                                                      |
| `ToggleRow`                                                        | `ListRow` + `Switch`; whole row toggles; disabled + locked (plan gate) states                                        |
| `NativePill`, `CheckDot`, `InitialsAvatar`, `IconTile`, `DatePill` | Shot vocabulary                                                                                                      |
| `MetricTile`, `MetricTileGrid`                                     | 2-up KPI tiles                                                                                                       |
| `InsightCard`                                                      | Dark emphasis card with one CTA                                                                                      |
| `PillButton`, `PillButtonPair`                                     | Full-width / split pill buttons                                                                                      |
| `KeyValueList`                                                     | Receipt / summary rows                                                                                               |
| `StageProgress`                                                    | Booking status stepper                                                                                               |
| `ActivityTimeline`                                                 | IconTile + title + sub + trailing check/time rows                                                                    |
| `WeekStrip`                                                        | Scroll-snap day chips                                                                                                |
| `SwipeableRow`                                                     | framer-motion horizontal drag revealing leading/trailing actions; full-swipe commits primary action                  |
| `PullToRefresh`                                                    | Wraps a scrollport; calls `onRefresh()` (TanStack `refetch`/`invalidateQueries`); standalone-only (D5)               |
| `useLongPress`                                                     | Long-press opens the row's action sheet (same items as ···)                                                          |
| `haptics.ts`                                                       | `tap()`, `success()`, `warning()` via `navigator.vibrate` when supported; no-op on iOS; respects reduced motion      |
| `NativeSegmented`                                                  | Segmented control restyle (pill track) for in-page filters                                                           |
| `EmptyState` (native variant)                                      | Icon tile + one line + one pill CTA                                                                                  |
| `NativeSkeletons`                                                  | Skeletons matching `ListSection`/`MetricTile`/`LargeTitleHeader` shapes                                              |

Pure logic (swipe thresholds, PTR thresholds, collapse progress math) lives in `.ts` files with Vitest tests, like `sheetDrag.test.ts`. Note: `.test.tsx` component tests do not run in this repo's Vitest setup, so keep testable logic out of components.

### 4b. Shell changes (`AdminLayout` and friends)

- `AdminMobilePage` keeps its props (`title`, `badge`, `trailing`, `overlap`, `fillMain`…) but renders `NativeScreen` (`LargeTitleHeader` + `NativeTopBar`). Pages migrate for free first, then get bespoke bodies.
- `MobileBrandHero`, `MobileStickyChrome`, `useMobileHeroCollapseProgress`, `useMobileStickyChrome`, `.mobile-brand-hero*` CSS: removed after all callers move (Phase 10 cleanup). Property `BookingDetailPage` renders `MobileBrandHero` directly; move it too.
- `BottomTabBar`: restyle to v2 (graphite or paper dock per D2, brand active pill, 10px labels). **Re-tap active tab = scroll to top** (then a second re-tap pops to the tab root).
- **More sheet**: grouped `ListSection`s (Operations / Growth / Settings / Help), `IconTile` leads, chevrons. Plan-locked modules show a `NativePill` lock, not hidden.
- **Notifications sheet**: Alerts shot layout: grouped by Today / Earlier, `IconTile` lead per event type, swipe to mark read, "Mark all read" in header.
- **Tenant switcher**: eyebrow trigger (D4) → existing switcher content inside a bottom sheet with search.
- **Scroll restoration** per route on back navigation (list → detail → back keeps position).
- **Push/pop transitions**: detail routes slide in from the right and back out; tab switches cross-fade. Use the View Transitions API where supported (already used for `dashboard-rail`/`dashboard-main`), fallback no animation.
- **Back navigation**: detail pages show "‹ Section" back link in the header. Spike in Phase 0: does iOS standalone PWA support edge-swipe back? If not, add an edge-swipe back gesture on detail routes only.
- **Keyboard**: `ContextualActionBar` rides above the on-screen keyboard (`visualViewport`); focused field scrolls into view; inputs get correct `inputMode` / `enterKeyHint` / `autoComplete`.
- **Offline / PWA banners, setup guide prompt**: restyle to inline `ListSection` notices, not floating banners over content.

### 4c. Rendering strategy per page

Two patterns, chosen per page:

1. **Shared tree, phone variants**: same component, phone-only classes and sub-components (`lg:hidden` / `max-lg:hidden`). Use when the desktop structure already fits.
2. **Split view**: `useIsBelowLg()` selects `XPageMobile` vs the existing desktop page, both fed by the **same hooks** (queries, mutations, permissions, plan gates). Use when the phone composition is fundamentally different (Dashboard, Bookings list, Booking detail, Maintenance, Finance, Pricing, Team, Settings). Rule: **no data or permission logic in the `*Mobile` component**, only composition. That is what guarantees parity.

Avoid rendering both trees and hiding one with CSS for heavy pages (double queries/DOM). `useIsBelowLg` must be SSR-safe and stable across resize (it already is).

### 4d. Parity guarantee

Each page gets a **parity table** in its route guide (`docs/guides/routes/**`), "Mobile (`max-lg`)" section:

| Desktop capability | Phone location | Gesture shortcut |
| ------------------ | -------------- | ---------------- |

A page is not done until every row of its desktop inventory (from the same route guide) has a phone location. Gestures are always shortcuts, never the only path (accessibility: every swipe action also exists in the row's ··· / long-press sheet).

## 5. Gestures and native interaction catalogue

| ID  | Interaction                       | Where                                                                                  | Implementation notes                                                                                                                                                                                                                     |
| --- | --------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Swipe row actions                 | Maintenance, Finance ledger, Notifications, Inbox threads, Bookings list, Team invites | Trailing swipe: secondary (Edit, Delete in coral). Leading swipe: primary (Complete, Mark read, Mark paid). Full swipe commits primary. Destructive still confirms via `AlertDialog`. Only one row open at a time; tap elsewhere closes. |
| G2  | Pull to refresh                   | All root list/tab pages                                                                | Standalone PWA only (D5). Calls the page's query refetch; spinner in the header area; `overscroll-behavior-y: contain` on the scrollport.                                                                                                |
| G3  | Long-press action sheet           | Any row with actions                                                                   | Opens the same `ResponsiveOverflowMenu` items as ···; haptic tick on Android.                                                                                                                                                            |
| G4  | Tap check circle                  | Maintenance, onboarding/setup checklist, recurring finance due items                   | Optimistic, success haptic, undo toast (sonner) for 5s. Uses existing mutations (activity log already emitted server-side; verify).                                                                                                      |
| G5  | Sheet detents                     | Detail sheets (booking quick view, transaction, reminder, notification)                | Add a medium (≈55%) and full detent to `sheet.tsx` drag logic; drag up to expand, down to collapse/dismiss.                                                                                                                              |
| G6  | Push/pop navigation + back        | List → detail everywhere                                                               | Section 4b. Edge-swipe back only if the Phase 0 spike shows the OS does not provide it.                                                                                                                                                  |
| G7  | Tab re-tap scroll to top          | Bottom tab bar                                                                         | Section 4b.                                                                                                                                                                                                                              |
| G8  | Horizontal pager between segments | Booking detail panels, Inbox filters, Finance (Ledger / Stays)                         | Only on screens with **no** swipeable rows (avoid gesture conflicts). `scroll-snap` pager synced with `NativeSegmented`.                                                                                                                 |
| G9  | Week/day swipe                    | Pricing week strip, calendar month                                                     | Scroll-snap week strip; month swipe left/right; keep the existing touch range-select from 4ad.                                                                                                                                           |
| G10 | Infinite scroll                   | Bookings list, Finance ledger, Activity, Notifications, Inbox                          | Replace phone pagination with "load more on reach end" (`@tanstack/react-virtual` is already installed for long lists). Desktop keeps pagination.                                                                                        |
| G11 | Press feedback                    | All rows, buttons, tiles                                                               | `-webkit-tap-highlight-color: transparent`; scale/tint press; no hover-only affordances.                                                                                                                                                 |
| G12 | Haptics                           | Complete, toggle, destructive confirm, refresh trigger                                 | `haptics.ts`; Android only; never required for meaning.                                                                                                                                                                                  |
| G13 | Safe areas                        | Header, tab bar, sheets, contextual bar                                                | `env(safe-area-inset-*)` everywhere; test notch + home indicator in standalone.                                                                                                                                                          |

## 6. Per-page work (property dashboard)

Each page task follows the same steps:

1. Read its route guide; list every desktop capability (parity table).
2. Build the phone composition with v2 primitives (split view where noted).
3. Wire gestures from section 5.
4. Layout-matched skeleton, empty state, error state, plan-locked state, no-permission state.
5. Light + dark mode, 375 / 390 / 430px and 768px (tablet still uses phone layout below `lg`; check it does not look stretched: cap content width ≈ 640px centered on `md`).
6. Update the route guide "Mobile" section + parity table.

Paths below are relative to `/org/:orgSlug/property/:propertySlug/`.

### P1. Dashboard (index) — split view

- Header: eyebrow property switcher, title "Today" style greeting is **not** used; title = "Dashboard", trailing date-range pill (opens existing range sheet).
- **Needs attention** → `ListSection` "Needs attention" of `ListRow`s (icon tile, one line, trailing count pill), each deep-links.
- **Today** section: check-ins/check-outs as rows with `InitialsAvatar` + status pill (Booking shot style).
- **Metric tiles** 2-up (occupancy, revenue, ADR, upcoming) with one delta line; tap → Analytics/Finance.
- **Maintenance reminders** → top 3 `TaskRow`s (complete inline) + "See all".
- **Transactions due** → top 3 rows with amount + date pill + "See all".
- **Board section** (finance chart + calendar + ops): finance chart becomes one chart card (Insights bar style, current period highlighted); calendar becomes a 7-day `WeekStrip` of occupancy; full calendar via "Open calendar".
- View Property → item in header ··· (one action) or a row in More.
- Pull to refresh.

### P2. Bookings list — split view

- Header: "Bookings", trailing "+" (New booking → existing modal as full sheet).
- `NativeSegmented` stage filter (Needs review / Upcoming / In stay / Past / All) replacing stage summary cards; counts shown in segments.
- Search field under the title (iOS style, collapses on scroll), refine icon → existing `AdminListRefineSheet` (filters, sort, query params preserved).
- Rows grouped by date ("Today", "This week", "Later"): `InitialsAvatar`, guest name, "Oct 18 to 20 · Unit 2604", trailing status pill (Booking/Alerts shot colors).
- Views: list is the phone default; Kanban becomes a **horizontal stage pager** (G8) of row lists; calendar view stays reachable via segmented "List / Board" in refine sheet.
- CSV import → header ··· → existing wizard as full-height sheet.
- Swipe: leading = primary next workflow action when it's a single safe step (e.g. "Mark reviewed"); otherwise only trailing "Message".
- Infinite scroll (G10). Pull to refresh.

### P3. Booking detail — split view (highest value screen)

- Header: back "‹ Bookings", title guest name, trailing status pill.
- Summary card: ref + unit, Stay / Guests / Paid columns, `StageProgress` (Booking shot).
- **Workflow panel** → "Next step" card with the single primary action as `PillButton`; secondary actions in ··· sheet. Keep all current workflow behaviors (`WorkflowPanel`, pending review ack, plan skip, AI review trigger) — only recomposed.
- **Activity** → `ActivityTimeline` (form received, receipt verified, GAF approved, guide sent…).
- Receipt → drill-in screen in the Payment receipt shot layout: hero amount, `KeyValueList`, "AI check complete" section with `TaskRow`-style checks, "Verified" pill button state.
- Documents (GAF, pet, ID), parking, pets, AI summary → drill-in `ListRow`s, each opening a sheet or sub-screen.
- Footer `PillButtonPair`: "Message guest" / primary workflow action.
- **Edit mode** keeps `ContextualActionBar` (Save / Cancel) and the unsaved-changes guard; fields grouped into `ListSection`s; workflow-sensitive revert warnings unchanged.
- Pay parking section → drill-in.
- Horizontal pager between Overview / Guest / Payments / Documents only if it tests well (G8); otherwise drill-ins.

### P4. Pricing + Calendar (`pricing`, `calendar` redirect) — split view

- Segmented "Calendar / Rates / Sync".
- **Calendar**: month grid with booking bars colored by source (Direct = brand, Airbnb = graphite), legend chips, "Synced now" pill in header; tap a bar → booking quick sheet; tap a day → day sheet (rate, block/unblock, min stay). Owner stays/blocks as muted bars. Keep 4ad touch range-select.
- **Rates**: `WeekStrip` per week with price chips; Smart Pricing suggestion card (old price struck, new price, reason line, Skip / Apply `PillButtonPair`); rules as rows (Weekend rate +15%, Minimum stay 2 nights) drilling into editors. Rates and fees sidebar becomes a `ListSection`.
- **Sync** (Channel Sync / iCal import-export / conflicts): grouped rows with status pills; "New Airbnb booking imported" style event rows.
- Guardrails, preview, past/blocked/synced nights all keep their current rules.

### P5. Finance — split view

- Header trailing: "+" new transaction; ··· for export report.
- Metric tiles (income, expenses, net, due) + one chart card.
- Segmented "Ledger / Stays" (existing toggle) with optional pager.
- Ledger rows grouped by month: IconTile per category, title, sub (date · unit), amount right (coral for expense), status pill when due/overdue.
- Swipe: leading "Mark paid", trailing Edit/Delete (recurring delete keeps `RecurringDeleteDialog` choice).
- Filters/sort/category → refine sheet. Calendar view reachable from refine sheet.
- Transaction create/edit → full-height sheet with grouped fields; recurring series modal; entry activity history as drill-in.
- Infinite scroll.

### P6. Maintenance — split view (exact shot)

- Header: "Maintenance", trailing count pill ("1 due"), "+" add.
- Sections: **Today**, **Overdue** (coral pills), **Next 30 days**, **Later**, **Done** (collapsed after 5, "Show all").
- `TaskRow`: check circle, title, sub ("Unit 2604 · after Maria S. checks out" / "every 6 months"), trailing date pill (sun when time-bound today), assignee avatar.
- Tap check = complete (G4) with undo; recurring items spawn next occurrence exactly as today.
- Tap row → reminder detail sheet (edit, recurrence, Telegram, history, delete).
- Swipe: trailing Edit / Delete. Calendar view + filters (status, Telegram) + sort + export → refine sheet / ···.

### P7. Analytics (Insights) — split view

- Header: "Insights", trailing period pill (opens period sheet).
- Metric tiles (Occupancy, Avg nightly rate…) with delta vs previous period.
- Chart cards: occupancy by weekday (sun bars for weak days, brand for strong, % labels), revenue trend.
- `InsightCard` "What to try" with one CTA (e.g. Open Pricing) — wire to existing Ask AI output; hidden when no insight.
- Ask AI → opens assistant sheet prefilled. Plan gate state uses native locked card.

### P8. Marketing / Content Studio — shared tree + new landing

- Landing = Content Studio shot: prompt card ("Describe the post"), photo chips, Made/AI pill, preview card (post mock), channel checks (Facebook / Instagram), schedule pill, `PillButton` Schedule/Publish.
- Tabs (Generate / Design / Video / Calendar / Templates / Publish history) → `NativeSegmented` scroll strip or More-style list; editors keep their internals per D8.
- Publish history → grouped rows with status pills.

### P9. Inbox — shared tree

- Thread list: avatar, name, last message preview, time, unread dot, channel icon (Messenger / Instagram / web / voice). Swipe: Mark read / Archive.
- Thread view: full-screen push; chat bubbles (Ask Kame / Receptionist shot), composer pinned above keyboard, AI suggest as chip row above composer, quick replies sheet.
- Voice receptionist transcripts render in the Receptionist shot style with the "Answered from your house guide" footer chip.
- Filters → segmented + refine sheet.

### P10. Notifications (page + bell sheet) — shared tree

- Alerts shot: Today / Earlier sections, IconTile per type, one line, time; swipe Mark read.
- Settings part (this device PWA, in-app activity, Telegram bots per module, `?module=staff|operations` redirects) → `ToggleRow`s + drill-in rows into each bot's editor; save behavior unchanged; unsaved guard kept.

### P11. Templates — shared tree

- List of template groups as `ListSection`s with drill-in rows.
- Editor: full-screen push; WYSIWYG kept (4ak density work stays), preview as a sheet; placeholders picker as `MobileChoiceSheet`; `ContextualActionBar` Save.

### P12. Public pages (list + `public-pages/:pageId/edit`) — shared tree

- List: rows with page thumbnail lead, status pill (Live / Draft), chevron.
- Page editor: section list as reorderable rows (drag handle, long-press to reorder), section editor as full sheet, live preview as a toggle ("Edit / Preview" segmented).

### P13. Team — split view (exact shot for member detail)

- List: Members / Invitations / Roles segmented; member rows with avatar, name, role pill, status.
- **Member detail** screen: name title + role pill, "Invite accepted" status card with units, "What {name} can do" `ToggleRow` list (Bookings, Check-in details, Maintenance, Guest inbox, Finance, Settings…), driven by the existing permissions tree. Plan-gated permissions show lock pill.
- Invite member → full-height sheet; custom role editor → full-screen with grouped toggles; deactivate / remove at bottom in coral.

### P14. Activity — shared tree

- `ActivityTimeline` grouped by day; filter segmented (All / Bookings / Finance / Team…); infinite scroll; tap → detail sheet.

### P15. Announcements (list + `:announcementId`) — shared tree

- Summary cards → small pills in header; list rows with unread dot; detail = reader screen with large title.

### P16. Help & support (overview, docs, tickets) — shared tree

- Overview: grouped rows (FAQs, Guides, Tickets, Contact). FAQs as expandable rows. Guides as drill-in reader.
- Tickets: list with status pills; conversation as chat bubbles; New ticket → full sheet.

### P17. Settings (property) — split view (biggest form surface)

- Root = grouped list of sections with completeness indicator (Setup completeness → progress ring/pill in header), each row drills into its own screen: Basic information, Property details, Photos & videos, Description, Amenities, House rules, Guest form, Cancellation policy, Location, Socials, Reviews & vouchers, Payment, Building forms, Email automations, Integrations, AI features, Activity, Danger zone.
- Each section screen: grouped fields, booleans as `ToggleRow`, choices as drill-in → `MobileChoiceSheet`, `ContextualActionBar` Save, `useUnsavedChangesGuard` on every section (back gesture included).
- Active vs Archive state banner as a native notice row. Danger zone actions in coral with `AlertDialog`.
- Photos & videos: grid with long-press reorder and multi-select delete.

### P18. Plans (redirects to org plans) — see O6.

### P19. Staff, Operations

- Redirects to `notifications?module=…`. No UI; verify redirect + back behavior only.

### P20. AI assistant (bottom sheet + AI mode)

- Sheet = Ask Kame shot: header "Ask Kame" + AI mode pill, user bubbles dark, answer cards with source eyebrow ("From your Finance and Bookings"), inline mini chart, action chips ("Open Finance", "Export report"), entity rows for lists (bookings with status pills).
- Composer above keyboard; context picker as sheet. AI mode full page uses the same composition on phone. Coordinate with [`ai-chat-mode.md`](../in-progress/ai-chat-mode.md) so phone layout lands in its shared chat core, not a fork.

## 7. Org-level and parking pages

### Org (`/org/:orgSlug/…`)

| ID  | Page                                                                               | Phone composition                                                                                          |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| O1  | Dashboard                                                                          | Org eyebrow, metric tiles across listings, "Needs attention" section, listings as rows with occupancy pill |
| O2  | Bookings (cross-property)                                                          | Same as P2 with a property filter chip row                                                                 |
| O3  | Properties                                                                         | Rows/cards with photo lead, name, unit, status pill; image carousel only on detail; "+" add                |
| O4  | Parkings                                                                           | Same as O3                                                                                                 |
| O5  | Team                                                                               | Same as P13 plus listing assignment picker as sheet                                                        |
| O6  | Plans                                                                              | Current plan card, usage meters as rows, plan options as horizontally snapping cards, compare as drill-in  |
| O7  | Analytics                                                                          | Same as P7 at org scope                                                                                    |
| O8  | Activity                                                                           | Same as P14                                                                                                |
| O9  | Settings                                                                           | Same pattern as P17 (grouped root + section screens; verification, billing, AI card, branding)             |
| O10 | Help & support                                                                     | Same as P16                                                                                                |
| O11 | Inbox redirect                                                                     | Verify redirect only                                                                                       |
| O12 | Org selector `/org`                                                                | Large title "Your workspaces", rows with logo lead, role pill; create org as pill button                   |
| O13 | Onboarding `/onboarding`                                                           | One question per screen, progress bar top, `ContextualActionBar` Continue, back gesture safe               |
| O14 | Verification rejected                                                              | Status screen: icon tile, title, reason, pill CTA                                                          |
| O15 | Accept invite                                                                      | Invite card (org, role, inviter), Accept / Decline pill pair                                               |
| O16 | Setup guide                                                                        | Checklist of `TaskRow`s (auto-checked from data), progress pill in header                                  |
| O17 | Verification / Get verified modal, listing contract renewal, copy settings dialogs | Full sheets with grouped steps                                                                             |

### Parking (`/org/:orgSlug/parking/:parkingSlug/…`)

| ID  | Page                                      | Phone composition                                       |
| --- | ----------------------------------------- | ------------------------------------------------------- |
| K1  | Dashboard                                 | Same as P1, parking metrics (slots, occupancy, payouts) |
| K2  | Bookings + detail                         | Same patterns as P2 / P3 with parking stages            |
| K3  | Finance                                   | P5                                                      |
| K4  | Pricing                                   | P4 (rates + availability; no Airbnb sync)               |
| K5  | Notifications                             | P10                                                     |
| K6  | Settings                                  | P17 pattern                                             |
| K7  | Inbox                                     | P9                                                      |
| K8  | Team                                      | P13 (parking scope)                                     |
| K9  | Activity / Announcements / Help & support | P14 / P15 / P16                                         |

## 8. Phases (each independently shippable)

| Phase  | Scope                                                                                                                                                                                                                                                                                                              | Exit criteria                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **0a** | Decisions D1 to D8 answered. Spikes: iOS standalone edge-swipe back, custom PTR in standalone, View Transitions on iOS 18 Safari, framer-motion swipe vs vertical scroll conflict, keyboard + `visualViewport` with contextual bar. **Rules + skill** (section 9) written first so every later phase follows them. | Spike notes appended here; rule + skill merged                                     |
| **0b** | Tokens: palette v3 (if D2 yes), phone type scale, radius/hairline/surface tokens, pill tones, motion tokens, dark mode. `DESIGN.md` §8 rewritten.                                                                                                                                                                  | Tokens in `index.css` + `tailwind.config`; contrast checked (WCAG AA) light + dark |
| **1**  | Primitives (4a) + Vitest for pure logic + dev-only gallery route (`/dev/native-kit`, excluded from prod build) showing every primitive in light/dark at 375px.                                                                                                                                                     | Gallery renders; `ci:quality` green                                                |
| **2**  | Shell (4b): `AdminMobilePage` → `NativeScreen`, tab bar, More sheet, notifications sheet, tenant switcher, scroll restore, tab re-tap, transitions, keyboard handling. All pages now have the large-title header for free.                                                                                         | Every dashboard route loads at 375px with no regressions (screenshot sweep)        |
| **3**  | Daily core: P1 Dashboard, P2 Bookings, P3 Booking detail, P9 Inbox, P10 Notifications                                                                                                                                                                                                                              | Parity tables complete; gestures G1 to G7, G10 live on these pages                 |
| **4**  | Ops: P4 Pricing + Calendar, P5 Finance, P6 Maintenance, P13 Team, P14 Activity                                                                                                                                                                                                                                     | Same                                                                               |
| **5**  | Growth + AI: P7 Analytics, P8 Marketing landing/chrome, P11 Templates, P12 Public pages, P20 AI assistant                                                                                                                                                                                                          | Same                                                                               |
| **6**  | Settings + support: P17 Property settings (all sections), P15 Announcements, P16 Help & support, P19 redirects                                                                                                                                                                                                     | Unsaved guard verified on every settings section incl. back gesture                |
| **7**  | Org pages O1 to O11, O16, O17                                                                                                                                                                                                                                                                                      | Same                                                                               |
| **8**  | Parking pages K1 to K9                                                                                                                                                                                                                                                                                             | Same                                                                               |
| **9**  | Entry flows O12 to O15; super-admin native-lite (D7): shared header, grouped lists, sheets on all `/admin/*` routes                                                                                                                                                                                                | No centered dialogs / tables overflowing on `/admin/*` at 375px                    |
| **10** | Cleanup + QA: remove `MobileBrandHero`/sticky chrome code and CSS, dead density tokens, update for-testing doc; full device QA (section 10); finalize rules/skill; route guides                                                                                                                                    | Old hero code gone; QA checklist signed off; plan moved to `done/`                 |
| **P**  | Public pages follow-up (section 11) as its own plan                                                                                                                                                                                                                                                                | Separate plan file                                                                 |

Suggested order inside a phase: highest-traffic page first, ship each page behind no flag (phone-only change, desktop untouched), one PR per page or per two small pages.

## 9. Rules, skill and docs to create / update

| File                                                                  | Change                                                                                                                                                                                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **New** `.cursor/rules/mobile-native-v2.mdc` (glob `ui/src/**`)       | Native v2 spec: shot vocabulary, which primitive for which need, split-view rule (no data logic in `*Mobile`), parity table requirement, gesture rules (always mirrored in ··· / long-press), type scale, no-shadow cards      |
| `.cursor/rules/mobile-native-ui.mdc` (always-on gate)                 | Replace hero rows in the "Need → Use" table with `NativeScreen` / `LargeTitleHeader` / `ListSection` / `TaskRow` / `ToggleRow` / `SwipeableRow`; add parity + gesture checks to "Before claiming UI work done"                 |
| `.cursor/rules/mobile-responsive.mdc`                                 | §2 remove brand-hero/sticky-chrome bullets; §4 new type scale (D3); §11 checklist adds: gestures mirrored, PTR, scroll restore, dark mode, 430px                                                                               |
| `.agent/skills/mobile-responsive/SKILL.md` (+ synced copies)          | Same as above; add a "Compose a phone screen" recipe with a worked example (Maintenance) and the parity table template                                                                                                         |
| **New skill** `native-mobile-screens` (`.agent/skills/`, synced)      | Pattern catalogue mapping each shot in `marketing/social/src/features/*Screens.tsx` to primitives, plus a decision tree: list vs grouped settings vs detail vs composer vs chart page. Run `bun run setup:ai-tooling` to sync. |
| `DESIGN.md`                                                           | §4 components, §6 depth (no shadows on phone cards), §8 responsive behavior rewritten for v2                                                                                                                                   |
| `docs/architecture/overview.md` + `docs/PROJECT.md`                   | Mobile architecture section: split-view pattern, primitives directory, gestures                                                                                                                                                |
| **New** `docs/architecture/mobile-native.md`                          | Primitives API, gesture implementation, PTR/standalone rules, transitions, keyboard, testing approach                                                                                                                          |
| `docs/architecture/skeleton-loaders.md`                               | Native skeleton shapes                                                                                                                                                                                                         |
| Every touched `docs/guides/routes/**` page                            | "Mobile (`max-lg`)" section + parity table                                                                                                                                                                                     |
| `docs/workflow/for-testing/mobile-native-redesign.md`                 | Note which phases v2 supersedes (hero, density)                                                                                                                                                                                |
| `.claude/README.md`, `.cursor/rules/README.md`, `.opencode/README.md` | Index the new rule + skill                                                                                                                                                                                                     |

Cross-cutting gates per the repo rules: `human-copy` + `minimal-ui-copy` for every string, `unsaved-changes-guard` for every editor/settings section, `route-guides` for every page. **Plans and permissions:** N/A for new entitlements (no new capability), but every phone screen must render the existing plan-locked and no-permission states. **Activity log:** N/A (UI only); inline actions (complete reminder, mark paid, mark read) reuse existing mutations, verify each already logs.

## 10. Verification

- **Automated**
  - Vitest for swipe/PTR/collapse threshold math and any pure mapping helpers.
  - Playwright mocked E2E (`ui/e2e/features/`): add a `mobile-native` project at 390×844 (iPhone 15) with `hasTouch` + `isMobile`; one smoke spec per phase covering: page renders, primary action reachable, a swipe action, the ··· mirror of that swipe, sheet opens as bottom sheet, no horizontal overflow (`document.scrollingElement.scrollWidth <= innerWidth`).
  - Screenshot baselines per route at 390px light + dark (only if stable under mocks; otherwise manual).
  - `bun run ci:quality` green each PR.
- **Manual (each phase)**: iPhone (Safari tab + installed PWA), Android Chrome (tab + installed PWA), iPad portrait. Check: safe areas, keyboard over inputs, back gesture, PTR, haptics (Android), reduced motion, VoiceOver/TalkBack can reach every swiped action, 200% text size does not break rows.
- **Desktop regression**: open each changed page at 1280px and confirm no visual or behavioral change.
- **Parity audit**: before closing a page, walk its parity table on a phone.

## 11. Follow-up: public pages (separate plan, after Phase 10)

Create `docs/workflow/planned/public-mobile-native-v2.md` when dashboard Phase 6 ships. Task list to carry over:

1. **Booking site / property page** (`/properties/:slug`, showcase templates): Booking site shot: full-bleed photo with rounded bottom, title + type pill, guests / area / min-night meta row, inline month date picker card, price breakdown `KeyValueList`, sticky Reserve pill bar.
2. **Calendar + guest form** (`/properties/:slug/calendar`, `/form`): one step per screen, progress, `ContextualActionBar` Continue, native inputs (`inputMode`, `autoComplete`), document upload as camera/file sheet.
3. **Success + booking documents + SD form + guest review**: status screens with icon tile, key-value summary, single pill CTA.
4. **Pay parking flow**: P3-style summary, receipt screen in the Payment receipt shot style.
5. **Guest chat + voice receptionist** (`/properties/:slug/messages`): Receptionist shot layout (dark plane, waveform, bubbles, footer source chip).
6. **Stay guide**: grouped sections, tap-to-copy door code / Wi-Fi rows.
7. **Marketing site** (`/`, `/properties`, `/parkings`, `/developments`, `/for-hosts*`, search, legal, about, contact, support): listing cards with photo + price pill, filter sheet, map as sheet toggle; keep the marketing display type exception.
8. **Guest account** (`/account/*`): profile as grouped rows, stays as trip cards with status pills, vouchers as wallet-style cards, favorites grid, tickets as chat; keep the single top strip rule (no second bottom bar).
9. **Auth pages**: single-column native forms, social buttons as pill buttons, OTP input with one-time-code autofill.
10. Same rules: gestures mirrored, parity with desktop, light + dark, route guides updated.

## 12. Risks

| Risk                                                                 | Mitigation                                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Split views drift from desktop (feature added on desktop only)       | Shared hooks only; parity table in route guide; rule makes it a done-gate                                 |
| Gesture conflicts (row swipe vs pager vs sheet drag vs browser back) | G8 only on pages without swipe rows; horizontal intent threshold before claiming the gesture; spike in 0a |
| PTR fights browser pull-to-reload                                    | Standalone only (D5)                                                                                      |
| Big-bang regression across ~70 routes                                | Phase 2 gives every page the new header via `AdminMobilePage`; bespoke bodies land page by page           |
| Palette port changes desktop look                                    | D2 explicit; screenshot desktop before/after                                                              |
| Type scale increase overflows long names/amounts                     | Truncation rules in `ListRow`; test with longest real data and 200% text size                             |
| Overlap with `ai-chat-mode` and Marketing Studio mobile plans        | D8 + P20 ownership notes; coordinate before touching those surfaces                                       |

## 13. Critical files

- Shell: `ui/src/features/dashboard/bookings/components/AdminLayout.tsx`, `AdminPageHeader.tsx`, `ui/src/components/mobile/*` (`MobileBrandHero`, `BottomTabBar`, `ContextualActionBar`, `FloatingPanel`, `MobileStickyChrome`, `AdminListRefineSheet`, `ResponsiveOverflowMenu`)
- Sheets: `ui/src/components/ui/sheet.tsx`, `sheetDrag.ts`, `bottom-sheet.tsx`, `responsive-modal.tsx`
- Tokens: `ui/src/index.css`, `ui/tailwind.config.*`, `ui/src/lib/statusToneColors.ts`
- Hooks: `ui/src/hooks/useMediaQuery.ts`, `useMobileHeroCollapseProgress.ts`, `useMobileStickyChrome.ts`
- Reference shots: `marketing/social/src/features/{kit,opsScreens,growthScreens,bookingScreens,guestScreens}.tsx`, `marketing/social/src/theme.ts`
- Prior work: [`../for-testing/mobile-native-redesign.md`](../for-testing/mobile-native-redesign.md), [`./marketing-studio-mobile-and-dashboard-responsive.md`](./marketing-studio-mobile-and-dashboard-responsive.md)
