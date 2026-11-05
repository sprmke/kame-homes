---
title: 'Mobile app chrome: header and tab bar'
status: active
tags: [workflow, planned, mobile, ui, pwa]
updated: 2026-11-06
stage: planned
kind: plan
---

# Mobile app chrome: header and tab bar

Scope: the **shell chrome only** on phone/tablet (`max-lg`), for both the public site and the host dashboard. That means the top header (page name, tenant scope, actions) and the bottom bar (tab bar + contextual action bar). Per-page content redesign stays in [`dashboard-mobile-native-v2.md`](./dashboard-mobile-native-v2.md); this plan delivers the shell primitives that plan assumed (its `NativeTopBar`, `LargeTitleHeader`, `BottomTabBar` restyle, decisions D1 and D4) so v2's per-page phases can build on them.

No code has been written for this plan.

## 1. Review of what ships today

### 1a. Bottom bar (public + dashboard)

Files: `ui/src/components/mobile/BottomTabBar.tsx`, `ContextualActionBar.tsx`, `BottomBarSlot.tsx`, `ui/src/components/pwa/FloatingBottomOverlay.tsx`, `.mobile-floating-dock` in `ui/src/index.css`.

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Impact                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | The dock is a rounded pill inset `px-4` from the edges and lifted by `pb-[max(0.625rem,env(safe-area-inset-bottom))]`. The wrapper `nav` is transparent and `pointer-events-none`, so the **home-indicator strip (~34px on iPhone) and the side gutters show scrolling content**.                                                                                                                                                                                       | The complaint in the request. Content slides under and beside the bar; reads as unfinished on iPhone.                                |
| B2  | Dock surface is translucent (`bg-background/88`, `/72` with blur, `.mobile-floating-dock` sets `/0.92`). Three competing opacity values; text and images bleed through behind labels.                                                                                                                                                                                                                                                                                   | Low contrast for 10px labels over busy content (listing photos, charts).                                                             |
| B3  | In iOS 26 Safari (browser tab), Safari's own floating glass toolbar sits under our floating dock. Two stacked floating pills.                                                                                                                                                                                                                                                                                                                                           | Looks cluttered; eats ~130px of the screen.                                                                                          |
| B4  | Admin tabs = 3 routes + **Notifications** + **Assistant** + More = **6 items**, which trips `dense` mode: **9px labels**, zero gap. Notifications and Assistant are overlays, not destinations.                                                                                                                                                                                                                                                                         | Below readable size; tab bar mixes places with actions, so "where am I" is unclear when an overlay is the active tab.                |
| B5  | Clearance is hard-coded in several places: content `pb-[calc(7.75rem+safe)]`, toasts `bottom-[calc(5.25rem+safe)]`, `MarketingEditorMobileToolbar` and `VideoMobileActionBar` have their own offsets.                                                                                                                                                                                                                                                                   | Any bar height change breaks spacing across the app; the 7.75rem pad also leaves a big empty band at page bottom.                    |
| B6  | `ContextualActionBar` reuses the floating dock style, so wizard/PDP primary actions have the same bleed as B1.                                                                                                                                                                                                                                                                                                                                                          | Same issue on the screens where the action matters most (booking CTA, save).                                                         |
| B7  | Public "Explore" tab is a **mode switch** in host mode (calls `switchMode('guest')`) and a route in guest mode.                                                                                                                                                                                                                                                                                                                                                         | Same tab does two different things depending on context.                                                                             |
| B8  | No check for the on-screen keyboard: fixed tab bar can ride above the keyboard on Android (`interactive-widget=resizes-content`).                                                                                                                                                                                                                                                                                                                                       | Covers inputs on forms.                                                                                                              |
| B9  | **`ContextualActionBar` fully replaces the tab bar.** `BottomBarSlotProvider` renders the tab bar _or_ the contextual bar, never both. On the property PDP (`PropertyDetailPage`) and parking detail (`ParkingDetailPage`) the Reserve/Request bar claims the slot, so **the whole app nav disappears** — and the phone header is logo-only, so there is no back button either. The only way out is the browser back gesture, which does not exist in a standalone PWA. | **Dead end on the two highest-intent public screens.** Called out by the user. Same risk on any screen that mounts a contextual bar. |

### 1b. Dashboard header

Files: `ui/src/components/mobile/MobileBrandHero.tsx` (`MobileBrandHero`, `MobileHeroOverlap`, `AdminMobilePage`), `MobileStickyChrome.tsx`, `ui/src/hooks/useMobileHeroCollapseProgress.ts`, `useMobileStickyChrome`, `.mobile-brand-hero*` / `.mobile-sticky-*` CSS, fallback topbar in `AdminLayout.tsx` (~L852). Used by ~35 dashboard pages.

| #   | Finding                                                                                                                                                                                                                                                                                                    | Impact                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | Once pinned, `MobileStickyChrome` shows the tenant switcher + trailing actions + optional float, but **no page title**. After ~90px of scroll the user loses the page name.                                                                                                                                | Direct answer to "better ways to display the page name": today it disappears exactly when you need it.                                                                       |
| H2  | **Three header systems**: (a) teal hero that scrolls away with parallax, (b) a separate fixed framer-motion overlay that slides in when pinned, (c) the white fallback topbar for pages without a hero. Plus `MobileHeroOverlap` keeps an invisible copy of the float in flow while the pinned copy shows. | Inconsistent look page to page, duplicated DOM for controls, hard to reason about.                                                                                           |
| H3  | Parallax animates `max-height`, `padding-bottom`, `margin-top` via React state on every scroll frame (`setProgress` in rAF).                                                                                                                                                                               | Layout work + full hero re-render per frame; content under the hero shifts while scrolling (jank on mid iPhones).                                                            |
| H4  | Full-bleed teal band + teal sticky bar = brand color is the **largest surface on every screen**. Primary is also used for the active tab pill and primary buttons, so it stops signalling "action".                                                                                                        | Heavy, dated look; competes with content. Matches neither the marketing shots nor native iOS/Android.                                                                        |
| H5  | Hero tall bottom pad (2.5rem) exists only to seat the straddling float; `--flush` variant and the `:has([data-page-brand-hero])` rules were added to patch it.                                                                                                                                             | Fragile CSS; `:has()` rules in `index.css` override shell padding.                                                                                                           |
| H6  | `theme-color` is `#f5f6f8` (paper) while the hero is teal. In a browser tab the status-bar area and the header do not match. Needs verification on iOS 26 Safari, which changed how it tints.                                                                                                              | Visible seam at the top.                                                                                                                                                     |
| H7  | Dashboard root is `h-screen` (100vh) + `overflow-hidden`, and `main` is an inner `overflow-y-auto` scroller.                                                                                                                                                                                               | On iOS Safari 100vh is taller than the visible area, so the bottom can sit behind the toolbar; inner scroll also disables Safari toolbar collapse and status-bar tap-to-top. |
| H8  | Sticky chrome CSS reaches into child components (`.mobile-sticky-chrome-scope .size-11`, `button.h-auto`, `!important` resets on float bodies).                                                                                                                                                            | Any change to the tenant switcher or toolbar silently breaks the pinned bar.                                                                                                 |

### 1c. Public header

Files: `ui/src/features/guest/marketing/shared/components/MarketingNav.tsx`, `MarketingLayoutShell.tsx`, `MarketingBottomNav.tsx`, `MarketingMoreSheet.tsx`.

| #   | Finding                                                                                                                                   | Impact                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| P1  | On phone the header is **logo only** (links, theme toggle, CTA and account are `lg:` only). Transparent at top, blur + border after 10px. | 56px of fixed header with no function beyond going home.                     |
| P2  | Same header on every public route, including PDP, parking detail and `/account/*`. No back button, no page name.                          | Detail pages feel like a website, not an app; back relies on browser chrome. |
| P3  | Header bg `bg-background/80` + blur; on photo heroes the transparent state puts a dark-text logo over images.                             | Contrast depends on the photo.                                               |
| P4  | Listing search morph (`useListingNavMorph`) only applies at `lg`; on phone the search pill and the header are separate layers.            | Two stacked sticky layers on listing pages.                                  |
| P5  | `motion.header initial={{ y: -100 }}` slide-in and a non-passive scroll listener.                                                         | Minor: entrance motion on first load, scroll listener cost.                  |

## 2. Decisions (recommendation first)

| #   | Question                                  | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Alternative                                                                                                                                                                                         |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Floating dock vs docked tab bar           | **Docked, edge-to-edge bar** on both public and dashboard: full width, solid surface (`bg-background` at ~96% + blur), hairline top border, background extends through `env(safe-area-inset-bottom)`. Nothing scrolls visibly beneath it. Keep the brand sliding pill for the active tab. This is what iOS (tab bar) and Material 3 (navigation bar) both ship.                                                                                                                                                                                                                                        | Keep the floating pill but add an opaque fill strip from the pill to the screen edge (gradient scrim). Fixes the bleed, keeps the look, but still costs height and still stacks with Safari's pill. |
| C2  | Teal hero + parallax                      | **Retire both** (same as v2 D1). Neutral page surface, large title that scrolls with content, compact top bar that fades in the title when the large title leaves (iOS large-title pattern). No scroll-linked layout animation.                                                                                                                                                                                                                                                                                                                                                                        | Keep a slim teal top bar (no parallax) with the title always visible. Smaller change, keeps brand weight.                                                                                           |
| C3  | Where brand color lives                   | Active tab pill, primary buttons, the tenant chip's avatar, focus rings. Not full-width bands.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Brand-tinted top bar only on the dashboard root page.                                                                                                                                               |
| C4  | Admin tab set                             | **5 max**: Dashboard, Bookings, Inbox, Assistant, More. **Notifications moves to a bell in the top bar** with the unread badge (standard placement). If AI is off for the property, the 4th slot falls back to the next nav item.                                                                                                                                                                                                                                                                                                                                                                      | Keep Notifications as a tab and move Assistant to a top-bar sparkle button.                                                                                                                         |
| C5  | Tenant switcher placement                 | Small tappable eyebrow chip above the large title on root tab pages ("Skyline Suite 2604 ⌄"), opening the existing switcher in a bottom sheet. Detail pages show a back button instead (same as v2 D4). In the compact top bar, the chip collapses to just the avatar on the left.                                                                                                                                                                                                                                                                                                                     | Always show the chip in the compact bar.                                                                                                                                                            |
| C6  | Hide tab bar on scroll down               | **No.** Keep it fixed (native tab bars do not hide). Hide only while the keyboard is open or a `ContextualActionBar` owns the slot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Hide on scroll down, show on scroll up (Safari style). Saves space but makes navigation jumpy.                                                                                                      |
| C8  | Detail screens with a contextual bar (B9) | **Keep the contextual bar as the only bottom bar, and give the screen a real header back button.** A focused detail screen should not show tabs (Airbnb, Booking and native apps all drop them), but it must always offer a way out. PDP, parking detail and every `ContextualActionBar` screen get the Phase 4 detail header: circular glass back button over the photo hero, solid bar with title after scroll. Back uses history when there is one, else falls back to the parent list (`/properties`, `/parkings`), so a shared deep link never dead-ends. Add edge-swipe back for standalone PWA. | Stack the contextual bar above the tab bar. Keeps nav visible but costs ~120px of a phone screen and buries the primary CTA.                                                                        |
| C9  | Guard against future dead ends            | `ContextualActionBar` takes a **required** `back` contract (dev warning when a screen claims the slot without a header back affordance), plus a Playwright gate asserting every contextual-bar route exposes a back control.                                                                                                                                                                                                                                                                                                                                                                           | Document it in the rule only.                                                                                                                                                                       |
| C7  | Dashboard scroll model                    | **Spike in Phase 0**: document scroll (`body`) with `min-h-dvh` vs keeping the inner `main` scroller with `h-dvh`. Pick document scroll if fill-main pages (Inbox, Settings, Notifications, Templates) can keep their inner panes.                                                                                                                                                                                                                                                                                                                                                                     | Keep inner scroller, only swap `h-screen` for `h-dvh`.                                                                                                                                              |

## 3. Target design

### 3a. Bottom bar (`BottomTabBar`, `ContextualActionBar`)

- Full-width bar fixed to the bottom. Inner row height 56px (labels 10 to 11px, icons 22px). Below it, padding = `env(safe-area-inset-bottom)` painted with the same surface.
- Surface: solid paper/graphite token, `backdrop-blur` only as a polish layer, 1px hairline top border; soft shadow only when content is scrolled under it (optional).
- Tablet (768 to 1023px): same bar, items centered with `max-w-xl`.
- Active state: keep `SlidingActivePill` but sized to the icon+label column; badges keep the ring.
- Re-tap active tab scrolls to top (already in v2 G7, do it here since it is shell behavior).
- One CSS variable `--mobile-bottom-bar-h` (row + safe area) set on `:root` under `max-lg`; every consumer reads it.

### 3b. Dashboard header (`MobileTopBar` + `LargeTitle`)

- **Compact top bar**, sticky, 44 to 48px row + `env(safe-area-inset-top)`. Left: back button (detail pages) or tenant avatar (root pages). Center or left: page title, hidden until the large title scrolls out, then fades in (IntersectionObserver on the large title, CSS opacity transition; no per-frame state). Right: up to 2 icon actions (bell, page action, overflow).
- **Large title block** in content: tenant eyebrow chip, page title (28px per v2 D3), optional badge. Scrolls away normally.
- **Page toolbar row** (today's `overlap` float: date range, view toggles, filters) renders as a normal row under the large title; when it reaches the top it sticks under the compact bar (CSS `position: sticky`), so there is one copy of the controls, not two.
- Hairline under the top bar only when scrolled.
- `AdminMobilePage` keeps its current props (`title`, `badge`, `heroTrailing`, `overlap`, `stickyPrimary`, `stickyMore`, ...) so the ~35 pages migrate without edits; `stickyMore` still opens the More filters sheet.

### 3c. Public header

- **Root tab pages** (`/`, `/properties`, `/parkings`, `/account`): logo left, one right action (search on listings, or avatar). On listing pages the search pill **is** the header when scrolled (one sticky layer, not two).
- **Detail pages** (PDP, parking detail, `/account/*` subpages, `/for-hosts/*` subpages): back button left, compact title that fades in after the hero, share/save on the right. On photo heroes: transparent bar with circular glass buttons, turns solid after the hero (Airbnb pattern).
- Consistent solid surface + hairline once scrolled, matching the dashboard top bar.

## 4. Phases and tasks

### Phase 0: Baseline and spikes

- [ ] Capture before screenshots: iPhone 15/16 (Safari tab and standalone PWA), iPhone SE, Android Chrome, iPad portrait. Pages: `/`, `/properties`, PDP, `/account`, property Dashboard, Bookings, Booking detail, Inbox, Settings, Finance.
- [ ] Verify how iOS 26 Safari uses `theme-color` and fixed bottom elements (tab vs standalone); decide the `theme-color` per surface (H6).
- [ ] Spike C7 (scroll model) on Bookings (document page) and Inbox (fill-main page). Record result in this file.
- [ ] Confirm keyboard behavior with `visualViewport` on iOS and Android (B8).
- [ ] Inventory every bottom-offset consumer: `bottomTabBarOffsetClassName`, `aboveBottomTabBarOverlayClassName`, `MarketingEditorMobileToolbar`, `VideoMobileActionBar`, `FloatingBottomOverlay`, `OfflineBanner`, toasts, `GuestForm`, `SdFormPage`, `ParkingRegistrationForm`, `InboxPage`, `TicketsWorkspacePage`, `NotificationsActivityView`.

### Phase 1: Bottom bar fix — **done** (`9910a95fc`)

- [x] `--safe-*` and `--mobile-bottom-bar-h` tokens in `index.css` plus a `.mobile-bottom-bar` surface class.
- [x] `BottomTabBar` rebuilt as docked (C1): full width, opaque, safe-area fill, hairline, labels never below 10px.
- [x] `ContextualActionBar` on the same surface (B6).
- [x] All 17 offset consumers derive spacing from the token instead of hard-coded `7.75rem` / `5.25rem` (B5).
- [x] Bar hides while the on-screen keyboard is open (B8), via `useVirtualKeyboardOpen`.
- [x] `.mobile-floating-dock` removed; the three editor toolbars that stack **on** the bar keep a floating pill under the clearer name `mobileFloatingToolbarClassName`.
- [ ] Re-tap active tab scrolls to top. **Not done** — moved to Phase 2 with the tab-set change.
- [ ] Dark mode and reduced motion spot-check on a real device. **Not done** — headless only so far.

### Phase 1b: Public detail back control — **done** (`0e15fc997`, covers B9 / C8)

- [x] `useMobileBack(fallback)` — pops history when there is one, else goes to the parent list.
- [x] `getPublicBackTarget(pathname)` + unit tests: root destinations get no back control, every other public route gets a labelled parent.
- [x] `MarketingNav` shows the back control in place of the wordmark on phone for non-root routes, so PDP, parking detail and the guest flows all gain an exit.
- [x] Gates in `mobileBottomChrome.spec.ts`: docked/opaque/untruncated bar, and a deep-linked detail screen that still lands on the parent list.
- [ ] Per-page back affordance for dashboard detail routes and wizards. **Not done** — needs the Phase 3 header.
- [ ] Edge-swipe back in standalone PWA. **Not done.**

### Phase 2: Admin tab set

- [ ] `adminBottomNav.ts`: cap at 5 (C4); drop Notifications from tabs; Assistant tab when available, else next nav item.
- [ ] Add notifications bell (with unread badge) to the dashboard top bar trailing slot; it opens the existing notifications sheet.
- [ ] Update `adminBottomNav.test.ts` (tab count, active-key rules, fallback when AI is off).
- [ ] Super-admin (`/admin/*`) tab set check.
- [ ] Parking scope (`/org/:orgSlug/parking/:parkingSlug/*`) tab set check.

### Phase 3: Dashboard header

- [ ] New primitives in `ui/src/components/mobile/`: `MobileTopBar`, `MobileLargeTitle`, `MobilePageToolbar` (sticky row), `useLargeTitleVisible` (IntersectionObserver).
- [ ] Re-implement `AdminMobilePage` internals on the new primitives with the same props.
- [ ] Tenant eyebrow chip (C5) reusing `SidebarTenantScope` in a bottom sheet; give the switcher a `variant` for the chip instead of CSS overrides (H8).
- [ ] Back button + title for detail routes (`BookingDetailPage` renders `MobileBrandHero` directly; migrate it).
- [ ] Replace the fallback topbar in `AdminLayout.tsx` with `MobileTopBar` so pages without `AdminMobilePage` match.
- [ ] Swap `h-screen` for `h-dvh` (or document scroll per C7) in `AdminLayout` (H7).
- [ ] Update route skeletons that render the hero so loading states match (no layout shift).
- [ ] Walk all ~35 `AdminMobilePage` callers at 375 / 768 px: title, badge, trailing actions, overlap toolbar, `stickyMore` sheet.
- [ ] AI mode: confirm the composer dock still replaces the tab bar and the top bar shows the chat title.

### Phase 4: Public header

- [ ] Split `MarketingNav` phone rendering into root vs detail variants (3c); keep desktop untouched.
- [ ] Detail variant: back button (history back, fallback to the parent list), compact title on scroll, transparent-over-photo state with glass buttons.
- [ ] Listing pages: merge the scroll search pill into the header on phone (P4).
- [ ] `/account/*`: back + title, matching dashboard top bar style.
- [ ] Decide B7: Explore tab always navigates to `/`; mode switch lives in More and the host page CTA.
- [ ] Remove the `y: -100` entrance, make the scroll listener passive (P5).

**B9 / C8 — detail screens must never dead-end (user-reported):**

- [ ] `useMobileBackTarget(fallback)` hook: `history.state.idx > 0` → `navigate(-1)`, else `navigate(fallback, { replace: true })`.
- [ ] `PropertyDetailPage`: back button (fallback `/properties`) + share/save, glass over the photo hero, solid after scroll. Reserve bar stays the only bottom bar.
- [ ] `ParkingDetailPage`: same, fallback `/parkings`.
- [ ] Audit every other `ContextualActionBar` caller for the same dead end: `GuestForm`, `SdFormPage`, `ParkingRegistrationForm`, booking wizard steps. Wizards get a back/close in their own header; confirm none rely on browser back.
- [ ] `ContextualActionBar` gets the C9 `back` contract + dev-time console warning when a screen claims the slot and no `[data-mobile-back]` control is in the DOM.
- [ ] Edge-swipe back on detail routes in standalone PWA (`display-mode: standalone`), only when history exists.
- [ ] Playwright gate: for each contextual-bar route, a back control is visible and lands on the parent list when opened as a deep link (no history).

### Phase 5: Cleanup, tests, docs

- [ ] Delete `MobileBrandHero`, `MobileHeroOverlap`, `MobileStickyChrome`, `useMobileHeroCollapseProgress`, `useMobileStickyChrome`, `.mobile-brand-hero*`, `.mobile-sticky-*`, the `:has([data-page-brand-hero])` rules.
- [ ] Playwright mobile spec under `ui/e2e/features/` for: tab bar visible and opaque at bottom, tab count ≤ 5, title visible after scroll on Bookings, back button on Booking detail and PDP.
- [ ] `bun run ci:quality` and `bun run build` (PWA precache budget, see memory note on chunk renames).
- [ ] Docs: `.cursor/rules/mobile-native-ui.mdc` + `mobile-responsive.mdc` (shell section, title scale), `docs/architecture/overview.md` (mobile shell), `docs/architecture/pwa.md` (safe areas, theme-color), `dashboard-mobile-native-v2.md` (point 4a/4b and D1/D4 to this plan).
- [ ] Route guides: dashboard page guides that mention the teal header or notifications tab.
- [ ] Support content: FAQ "Where are notifications on my phone?" (bell, top right) + Host-facing knowledge; run `check:support-content` and `check:ai-knowledge-coverage`.
- [ ] After screenshots for the same device matrix as Phase 0.

## 4b. How this ships (isolation, revert, screenshots)

**Isolation.** All work happens in the worktree `.claude/worktrees/mobile-app-chrome` on branch `worktree-mobile-app-chrome`, based on `origin/develop`. The main checkout keeps its own branch and uncommitted work untouched, so parallel sessions cannot conflict with this.

**Revert.** Every phase is one commit with the phase number in the subject, so any slice can be undone on its own:

| To undo                  | How                                                        |
| ------------------------ | ---------------------------------------------------------- |
| One phase                | `revert` that phase's commit                               |
| Everything               | hard-reset the worktree branch back to `origin/develop`    |
| Throw the whole lot away | `ExitWorktree` with `remove` (deletes worktree and branch) |

Legacy chrome (`MobileBrandHero`, `MobileStickyChrome`, `useMobileHeroCollapseProgress`, the `.mobile-brand-hero*` CSS) **stays in the tree until the new chrome is approved**. The Phase 5 deletion only runs on a yes. Nothing merges to `develop` without review.

**Screenshots.** `ui/e2e/features/responsive/mobileChromeScreens.spec.ts` captures 13 routes (5 public, 8 dashboard) at iPhone 393x852 and tablet 768x1024, each at top of page and scrolled, driven by the existing mocked `propertyTeamRbacHarness` so runs are repeatable:

```bash
PLAYWRIGHT_CAPTURE_SCREENS=1 MOBILE_CHROME_LABEL=before \
  ./node_modules/.bin/playwright test ui/e2e/features/responsive/mobileChromeScreens.spec.ts --project=chromium
```

Output lands in `ui/e2e/artifacts/mobile-chrome/<label>/<viewport>/`. Re-run with `MOBILE_CHROME_LABEL=after` to diff. `SAFE_AREA=1` emulates iPhone insets (47px top, 34px bottom) through the `--safe-top` / `--safe-bottom` tokens added in Phase 1 — Chromium cannot emulate `env(safe-area-inset-*)`, which is exactly why those tokens are worth having.

## 5. Not in scope

- Per-page content layouts (lists, cards, forms): `dashboard-mobile-native-v2.md`.
- Desktop (`lg+`) header and sidebar.
- Marketing Studio editor internals.
- Palette change (v2 D2); this plan uses current tokens.

## 6. Cross-cutting

- Plans/RBAC: N/A, no gated capability changes; tab set still derives from permission-filtered nav.
- activity-log: N/A, no mutations.
- Unsaved changes: N/A, no forms.
- Accessibility: top bar title is not a second `h1` (large title keeps `h1`, compact title `aria-hidden`); tab bar keeps `aria-current`; 44px targets.
