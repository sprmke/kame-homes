---
title: 'Marketing Studio mobile parity + dashboard responsive polish'
stage: planned
status: in progress
tags: [mobile-responsive, marketing, pricing, dashboard]
updated: 2026-09-02
kind: plan
---

> **Follow-up (2026-09-03, feedback round 3):** Design + Video tab polish, verified at
> 375px (type-check + build green; lint clean in touched files):
>
> - **Design rail** — the 56px Polotno icon rail clipped "Elements"/"Background" and
>   `overflow-y:auto` forced a stray horizontal scrollbar (the "overlapping element on
>   the bottom"). Now 68px, `overflow-x: hidden`, labels wrap-free at 9px. CSS in
>   `polotno-design-studio.css` `@media (max-width:1023px)`.
> - **Design undo/redo/reset** — dropped from the Blueprint toolbar via a new
>   `KamePolotnoEditor` `hideHistory` prop (`History: () => null`) and moved into the
>   `MarketingEditorMobileToolbar` ⋯ sheet, matching Calendar. The mobile toolbar CSS
>   collapses to `min-height:0` so it takes no space until an element is selected.
> - **Overflow-sheet tier badges** — `MarketingEditorMobileOverflowItem` gained a
>   `trailing` field and `MobileChoiceItem` a `trailing` prop; all three editors pass a
>   `TierBadge` on Generate-with-AI / Download / Publish so the required plan shows on
>   mobile like desktop.
> - **Video preview height** — the shell was over-reserved in round 2, and the
>   `min-h-[260px]`/`min-h-[220px]` floors + a tall playback-controls column pinned the
>   preview frame and forced the whole column to scroll. Shell trimmed to
>   `calc(100dvh − 20rem)` (ends ~at the editor-dock top); scrollport `pb` cut to a
>   small gutter; mobile min-height floors lowered to `180`/`150`;
>   `VideoPlaybackControls` compacted to one row (time readout hidden — redundant with
>   the scrubber + timeline); `VideoTimeline` drops its format/clip-count line and uses
>   smaller compact clip frames. Net at 375×667: the video frame grows from ~95px to
>   ~120px and the column fits with no scroll and no dead space; taller phones scale up
>   proportionally via `flex-1`.
>
> **Follow-up (2026-09-02, feedback round 2):** Three fixes to the Marketing Studio
> mobile shell, verified at 375px (type-check + lint + build green):
>
> 1. **Month navigator** — the cramped right-floated "Sep 2026" pill is replaced by a
>    full-width `‹ September 2026 ›` bar at the top of the Calendar canvas (full month
>    name, 44px arrows), via `MarketingPreviewHeader` `leading` on `max-lg`.
> 2. **App tab bar stays visible** — `MarketingEditorMobileToolbar` no longer mounts
>    through `ContextualActionBar` (which hid the tab bar). It now floats as its own pill
>    at `bottom: calc(4.75rem + safe-area)`, directly above the app tab bar. Clean stack
>    at 375×667: card (…515) → editor dock (525–591) → tab bar (599–667), no overlap, no
>    h-scroll. `MarketingStudioShell` height dropped to `calc(100dvh − 20.5rem)` to
>    reserve both docks; per-editor `pb` hacks + the Polotno mobile height offset removed
>    (the shell clips above the docks now). `PageEditorShell` (flex-fill, no explicit
>    height) uses the new `marketingEditorScrollClearanceClassName` export instead.
> 3. **Template select closes the sheet** — the apply handlers in all three editors
>    (Calendar preset/blank/custom, Design preset/saved/review, Video preset/saved/review)
>    call `closeMobilePanel()` so picking a template drops straight to the canvas;
>    "Customize" keeps the sheet open (switches to the settings view).
>
> **Progress (2026-09-02):** Phases 0–6 **implemented and verified** (type-check + lint +
> production build green). Interactive Playwright verification against the local stack
> (Supabase + edge functions up, session injected via `admin/generate_link` for
> `sprmke.dev@gmail.com` → `kame-home` / `monaco-2612`):
>
> - **390px & 768px** — Marketing Studio Calendar (full-bleed preview + dock + Templates
>   bottom sheet), Design/Polotno (56px icon rail + section panel docking as a bottom sheet +
>   dock), Video (Remotion player + compact timeline + dock); Pricing two-tap range select
>   end-to-end → date modal; Org Properties toolbar refine sheet replacing the `Select` strip.
> - **375px** — all three Studio editors: no horizontal overflow, editor dock 44px targets,
>   Templates panel opens as a full-width bottom-anchored sheet and closes; the `···` overflow
>   opens a `MobileChoiceSheet` with 52px rows (Undo/Redo/Fit/Fullscreen/Reset/AI/Download/
>   Publish). Studio card bottom clears the fixed dock (see the height fix below). Pricing at
>   375px: 2×2 KPI grid, 7-col calendar with compact (`min-h-[3.5rem]`) cells + price chips,
>   no overflow.
> - **Publish flow** — reachable on mobile via the overflow sheet and on desktop via the
>   builder-header button; on a Starter-plan property it opens the "Upgrade to Business" gate,
>   which renders as a full-width bottom sheet `<lg` and a centered `Dialog` at `lg+`, no
>   overflow either way.
> - **1024px & 1440px** — `MarketingEditorMobileToolbar` not rendered (`!isBelowLg` guard),
>   desktop fixed-height card active (`lg:h-[calc(100vh-120px)]`), Polotno desktop side-rail
>   at 72px (not the mobile 56px), no horizontal overflow. Desktop layout provably unchanged.
>
> Layout bugs found + fixed during QA: (1) the studio card needed `max-lg:flex-none` + an
> explicit viewport-derived height because a route wrapper breaks the `flex-1` fill chain —
> now `max-lg:h-[calc(100dvh-16rem)] max-lg:min-h-[24rem]` (the earlier `12rem` value let the
> fixed dock overlap the card bottom on a 375×667 viewport where the brand hero is ~176px);
> (2) builder-header / preview-header empty rows tightened so they don't reserve a full 44px
> band on mobile.
>
> Dev-env note: on data-backed admin pages the local stack throws sporadic `429`s from the
> edge runtime under reload load, and supabase-js's StrictMode double-mount can race the
> rotating refresh token into a transient sign-out + route remount. Both are dev-only
> artifacts (not code defects); a freshly minted session and an edge-runtime restart clear
> them for a clean pass.

# Mobile‑responsive overhaul — Marketing Studio + dashboard pages

## Context

The admin dashboard (`ui/`, Vite + React 18 SPA) is broadly mobile‑mature: org / property / parking
pages route through one shared `AdminLayout` shell with a floating `BottomTabBar`, and nearly every
list/settings page already uses the project's mobile primitives (`AdminMobilePage`, `FloatingToolbar`,
`AdminSectionNavLayout`, `AdminListRefineSheet`, `ResponsiveModal`, `MobileChoiceSheet`). This plan
extends [`../in-progress/mobile-native-redesign.md`](../in-progress/mobile-native-redesign.md) (admin
shell = done) into the two surfaces that still break on a 375px viewport, plus the leftover polish.

Two areas do **not** hold up at 375px:

1. **Marketing Studio** (`features/dashboard/marketing/`) — three heavy editors (calendar builder,
   Polotno design editor, Remotion video editor) live inside a single fixed‑height desktop card
   (`h-[calc(100vh-120px)]`). The only mobile handling is `MarketingEditorSidebar` collapsing to a
   full‑width block **stacked above** the canvas via `lg:flex-row`, giving sidebar and canvas ~50%
   each of a viewport‑height container — the canvas becomes unusable and the video timeline/controls
   overflow. Polotno ships fixed `72px + 350px` Blueprint chrome; the video preview has `min-h-[480px]`
   floors and fixed‑pixel timeline clips.
2. **Pricing calendar** (`features/dashboard/pricing/components/PricingCalendarGrid.tsx`, shared by
   parking + property pricing) — range selection is `onMouseDown`/`onMouseEnter` only, so bulk
   custom‑pricing / block is desktop‑only on touch; day cells are cramped at 375px.

Plus consistency nits (raw `Dialog` for long forms, list toolbars not using the refine sheet,
dashboard density on mobile).

**Goal:** every page in these tiers works at 375 / 390 / 768 / 1024 / 1440px with no horizontal
overflow, 44px touch targets, and native mobile patterns — and all three Marketing Studio editors are
**fully touch‑editable** on a phone.

Decisions locked with the user: **full editing parity for all three Studio editors on mobile**;
**scope = everything incl. polish** (Phases 1–6).

## Reusable infrastructure (do not reinvent)

| Need                                       | Use                                                                                                                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page shell + brand hero + sticky chrome    | `AdminMobilePage` (`components/mobile/MobileBrandHero.tsx`) — `heroTrailing`, `overlap`, `stickyPrimary`, `stickyMore`, `stickyMoreActiveCount`, `desktopActions`, `dense`             |
| Full‑height main column on mobile          | `useAdminLayoutFillMain(true)` / `useAdminLayoutIsFillMain()` (`bookings/components/AdminLayout.tsx`) + `bottomTabBarOffsetClassName()` on the **inner scrollport**                    |
| Bottom sheet / drawer for panels           | `ResponsiveModal` + `sheetLayout="split"` (`components/ui/responsive-modal.tsx`), or `BottomSheet*` (`components/ui/bottom-sheet.tsx`)                                                 |
| Filter/sort/settings drawer                | `AdminListRefineSheet` + `AdminListRefineSection` + `AdminMobileSearchFilterRow` (`components/mobile/AdminListRefineSheet.tsx`)                                                        |
| Option pickers on mobile                   | `MobileChoiceSheet` + `MobileChoiceItem` (`components/mobile/MobileChoiceSheet.tsx`)                                                                                                   |
| Multiple hero actions                      | `MobileHeroActionMenu` (1 item = icon, 2+ = `···` sheet)                                                                                                                               |
| Contextual Save/Cancel bar (hides tab bar) | `ContextualActionBar` + `useClaimBottomBarSlot()` (`components/mobile/ContextualActionBar.tsx`)                                                                                        |
| Breakpoint switch                          | `useIsBelowLg()` (`hooks/useMediaQuery.ts`) — admin mobile breakpoint (≤1023px)                                                                                                        |
| Card list instead of table                 | `AdminCardGrid` / `AdminCardRow` / `AdminCardState`; `useAdminMobileCardViewGuard`                                                                                                     |
| Reference implementations                  | `bookings/pages/BookingsListPage.tsx` + `BookingFilters.tsx`; `inbox/pages/InboxPage.tsx` (mobile master‑detail); `booking-detail/edit/BookingEditStickyBar.tsx` (ContextualActionBar) |

## Phase 0 — Studio mobile shell + shared editor layout primitive

- **`components/shared/MarketingStudioShell.tsx`** — replace `h-[calc(100vh-120px)] min-h-[520px]`
  with a flex‑fill layout below `lg`; `MarketingStudioPage` calls `useAdminLayoutFillMain(true)`; keep
  the fixed height for `lg+` only; mobile applies `bottomTabBarOffsetClassName()` on the inner scroll
  root.
- **`pages/MarketingStudioPage.tsx`** — surface each editor's Download / Publish / autosave actions
  (today injected into `MarketingBuilderHeader` via `useMarketingStudioHeaderActions`) into
  `AdminMobilePage` `desktopActions` (`lg+`) + `stickyPrimary` (Publish) / `stickyMore` (Download,
  Reset, autosave). Switch `MarketingStudioModeTabs` list `size` to `compact` (44px mobile targets).
- **New `components/shared/MarketingEditorMobilePanel.tsx` + `MarketingEditorMobileToolbar.tsx`** —
  one mobile model for all three editors: full‑bleed canvas; sidebar content shown in a bottom sheet
  (`BottomSheet` `side="bottom" showHandle`, `max-h-[72dvh]`, `layout="split"`) opened from a compact
  bottom toolbar (panel button + zoom/undo/redo + `···` overflow via `MobileHeroActionMenu`). Toolbar
  docks above `BottomTabBar` (safe‑area aware) or mounts through `ContextualActionBar`.
- **`components/shared/MarketingEditorSidebar.tsx`** — below `lg`, render `children`/`header`/`footer`
  into `MarketingEditorMobilePanel` instead of the stacked full‑width block. Desktop path unchanged.
- **`MarketingPreviewHeader.tsx` / `MarketingBuilderHeader.tsx`** — below `lg`, keep only zoom +
  month/scene nav visible; move history + secondary buttons into the toolbar `···` menu; stop header
  actions wrapping into a full‑width row.
- Touch‑scroll hygiene: studio fills the viewport (no page scroll behind canvas); `overscroll-contain`
  - `touch-action: none` on canvas surfaces below `lg`.

## Phase 1 — Calendar tab, full mobile

`components/calendar-builder/components/CalendarBuilder.tsx`.

- Mobile: full‑width `CalendarPreviewScaledFrame` fills the canvas; template list vs. the ~12 style
  panels render inside the Phase‑0 bottom sheet with an in‑sheet section switcher.
- Fullscreen overlay header (`CalendarBuilder.tsx` ~1283–1385) — the two bordered month/zoom pill
  clusters overflow at 375px; collapse into one row + `···` overflow menu.
- Template & format pickers → `MobileChoiceSheet` (`CalendarTemplateSidebar.tsx`,
  `CalendarFormatPicker.tsx`, `CalendarViewToggle.tsx`).
- Verify `CalendarPreviewScaledFrame` / `previewLayout` legible at 320–375px container width.

## Phase 2 — Design tab (Polotno), full mobile — highest risk

Files: `components/design-editor/PolotnoDesignStudio.tsx`, `polotno/KamePolotnoEditor.tsx`,
`polotno/KameSidePanelCollapse.tsx`, `polotno-design-studio.css`, `lib/polotno/*`.

**Spike first** — confirm the panel/canvas DOM can be re‑homed with CSS + `store.openSidePanel()`.

- CSS, new `@media (max-width: 1023px)` block: `.raeditor-panel-container.bp5-navbar` drops the
  `350px !important` sizing and becomes `position: fixed; inset-inline: 0; bottom: <toolbar+tabbar>;
max-height: 60dvh` slide‑up sheet (`.collapsed` translated off‑screen); `.raeditor-side-tabs-container`
  (72px rail) → horizontal `overflow-x-auto` strip or hidden (sections driven from our toolbar);
  `.raeditor-toolbar` wrapped in `overflow-x-auto`; `.raeditor-workspace-*` → `touch-action: none`,
  full size; Blueprint popovers clamped `max-width: calc(100vw - 24px)`.
- JS: below `lg` render `KamePolotnoEditor` full‑bleed (no sidebar column); open/close the Polotno
  side panel via `store.openSidePanel(section)` from `MarketingEditorMobileToolbar` section buttons
  (Text / Elements / Uploads / Background / Layers — `sections` array already at ~87–103); canvas tap
  / close → `store.openSidePanel('')`.
- Verify Konva touch move/resize/rotate + pinch‑zoom.
- **Fallback if the spike fails:** Polotno canvas full‑bleed + pan/zoom, panels as our own opaque
  overlay drawer driven by our toolbar — still full editing, our chrome around their panel.

## Phase 3 — Video tab (Remotion), full mobile

Files: `components/video-editor/VideoEditor.tsx`, `VideoPreviewWorkspace.tsx`, `VideoTimeline.tsx`,
`VideoTextPositionOverlay.tsx`, `VideoPlaybackControls.tsx`, `VideoEditorSettings.tsx` /
`VideoSceneSettings.tsx` / `VideoSceneElementsPanel.tsx` / `VideoTextStyleControls.tsx` /
`VideoMusicSettings.tsx`, `lib/video/videoFormatDimensions.ts`.

- `videoFormatDimensions.ts` — responsive min‑heights, e.g.
  `VIDEO_PREVIEW_CONTAINER_MIN_HEIGHT_CLASS = 'min-h-[260px] sm:min-h-[380px] lg:min-h-[540px]'`,
  `VIDEO_PREVIEW_SHELL_MIN_HEIGHT_CLASS = 'min-h-[220px] sm:min-h-[380px] lg:min-h-[440px] xl:min-h-[480px]'`.
- `VideoEditor.tsx` mobile — full‑width `VideoPreviewWorkspace` + `VideoTimeline` below; all
  settings/scene panels move into the Phase‑0 sheet with tabbed sections (Scene / Text / Elements /
  Music / Settings).
- `VideoPreviewWorkspace.tsx` — drop `previewMaxWidth` px caps below `lg`; custom pointer‑pan
  (~234–282) gets `touch-action: none` and is gated to `zoomFactor > 1` on mobile.
- `VideoTimeline.tsx` — `timelineClipFrameSize()` gains smaller mobile sizes via a `compact` prop
  (`useIsBelowLg()`); remove button shows only when the clip is selected (or moves into scene
  settings); keep existing `TouchSensor` (delay 180).
- `VideoTextPositionOverlay.tsx` — handle hit areas ≥44px, `touch-action: none`.
- `VideoPlaybackControls.tsx` — 44px targets, full‑width scrubber, no 375px overflow.

## Phase 4 — Pricing calendar grid (shared: parking + property)

`features/dashboard/pricing/components/PricingCalendarGrid.tsx`. No consumer changes.

- Touch range‑selection: tap‑start / tap‑end model below `lg` — first tap arms an anchor + shows a
  hint, second tap commits through the existing `onDateMouseDown` + `onDateMouseEnter` +
  `onSelectionEnd` handlers, tap‑outside / "Clear" resets. `lg+` mouse drag untouched. Wire
  `onTouchStart`/`onTouchEnd` on `PricingDayCell` (~343–384).
- Day cells `<sm`: `min-h-[4.5rem]` → `min-h-[3.5rem] sm:min-h-[4.5rem]`; keep 7‑col grid; price chip
  `text-[10px]` at smallest; keep arm/selected states visible.
- Fixed widths `min-w-[9.5rem]` / `11rem` / `8.75rem` (month label ~165, legend ~471, tooltips
  ~95/498/555) → `min-w-0 sm:min-w-[...]`.

## Phase 5 — Dashboard polish (P2 / P3)

- `parking/components/AdminParkingNewBookingModal.tsx` (~134) — `GuestDialogShell` → `ResponsiveModal`
  - `sheetLayout="split"`.
- `parking/pages/ParkingFinancePage.tsx` (~258–266) — wire `FinanceLedgerToolbar` into `AdminMobilePage`
  `stickyPrimary` / `stickyMore` refine sheet, matching `ParkingBookingsPage.tsx` (~346–349).
- `org/components/org-properties/OrgPropertiesToolbar.tsx` (~57–88) + `org-parkings/OrgParkingsToolbar.tsx`
  — radix `Select` → `MobileChoiceSheet` below `lg` (or whole strip → `AdminListRefineSheet`).
- `pricing/components/PricingSaveDialog.tsx` (~31) — raw `Dialog` → `ResponsiveModal`.

## Phase 6 — Dashboard polish (P4) + latent items

- `parking/components/ParkingDashboardCalendarSection.tsx` (~64, ~91) +
  `property/components/DashboardFinanceCalendarSection.tsx` — apply the `max-lg` density rule
  (title‑only header, hide icon well + description); confirm 3 stacked widgets read acceptably.
- Verify & fix or add a desktop‑fallback notice: `plans/pages/PropertyPlansPage.tsx` (tier tables),
  `page-editor/pages/PageEditorPage.tsx` (canvas editor), `inbox/components/InboxChannelsTab.tsx`
  (raw `Dialog`).

## Verification

Run after each phase; full sweep at the end.

1. `bun run lint && bun run type-check && bun run build` (+ `bun run check:filenames` for new files).
2. Playwright MCP at **375, 390, 768, 1024, 1440** (`verify` skill):
   - Studio: open each tab; open the mobile panel sheet; edit (calendar template + style panel;
     design add text + move/resize + color picker; video reorder clip + on‑canvas text + music +
     play); run Publish → `PublishDialog`. Assert no horizontal page scroll, canvas interactive,
     sheet rows ≥48px, sticky chrome actions reachable.
   - Pricing: parking + property — touch‑emulate tap‑start/tap‑end range select; open `PricingSaveDialog`.
   - Dashboard: org properties/parkings toolbars, parking finance toolbar,
     `AdminParkingNewBookingModal`, org/property/parking dashboards at 375px.
3. `mobile-responsive` skill §11 checklist for every touched screen.
4. Docs (same change): `route-guides` skill — Marketing Studio route guide + parking/property Pricing
   route guides + toolbar/dialog UX changes (`docs/guides/routes/**`); `documentation-maintenance`
   checklist; note the Studio mobile interaction model in `docs/PROJECT.md` if behavior‑relevant.
   No DB / edge‑function / env changes expected — mark those rows N/A.

## Risk / sequencing notes

- **Phase 2 (Polotno) is the main risk.** The spike decides native‑panel‑as‑sheet (preferred) vs.
  our‑chrome‑over‑their‑panel (fallback). Both deliver full editing.
- Phases 4–6 are independent of 0–3 and can be done first for a quick win.
- Keep every change behind `useIsBelowLg()` / `lg:` so desktop layout is provably unchanged.
