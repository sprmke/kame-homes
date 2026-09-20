---
title: 'Loading skeletons'
status: active
tags: [workflow, planned, production-readiness, ux, perceived-performance]
updated: 2026-09-17
stage: planned
kind: plan
---

# 07 — Loading skeletons 💀

## Implementation status (2026-09-17)

**Confirmed clean:** grepped all of `ui/src` for `isFetching` gating a loading UI — **zero matches**. The doc's "single most common mistake" does not exist in this codebase; every audited consumer already keys off `isLoading`/`isPending`.

**Phase 7.2/7.3 (anti-flash primitive): shipped.**

- `ui/src/hooks/useDelayedLoading.ts` — new hook: does not show `true` until `isLoading` has held for `showAfterMs` (default 180ms), and once shown, holds `true` for at least `minVisibleMs` (default 300ms) even if `isLoading` flips back sooner. Implements both Phase 7.3 rules in one place instead of per-site `setTimeout`s.
- `ui/src/components/routing/RouteFallback.tsx` (`SectionLoadingFallback`, `PageLoadingFallback` — the Suspense fallbacks used by `App.tsx`, `AdminLayout.tsx`, `SetupGuideOverlay.tsx`, `MarketingLayoutShell.tsx`, `GuestAccountLayout.tsx`) now delay their first paint by 180ms and render `null` until then. **Note:** React unmounts a `Suspense` fallback the instant its child resolves — a fallback component cannot extend its own visibility past that point the way `useDelayedLoading`'s min-visible-duration can, so only the show-delay half of the anti-flash contract applies here; documented in-file. Also added `role="status"`/`aria-live="polite"` with an `aria-label`, and marked the skeleton blocks `aria-hidden`, per the Phase 7.6 accessibility requirement.
- Spot-checked the pattern on one data-driven consumer, `BookingTable.tsx` (bookings admin list) — gated its existing `BookingsTableSkeleton` behind `useDelayedLoading(isLoading)` instead of raw `isLoading`. Confirmed to already handle all four states (loading/error/empty/data) correctly before this change.

**Code review findings (2026-09-17):**

- **Fixed (reuse):** `RouteFallback.tsx` initially shipped its own local `useShowAfterDelay` hook duplicating `useDelayedLoading`'s show-delay logic in the same pass that added the shared hook. Consolidated: `RouteFallback.tsx` now calls `useDelayedLoading(true, { minVisibleMs: 0 })` — `isLoading: true` because a Suspense fallback has no loading state of its own to observe (its mount IS the loading state), `minVisibleMs: 0` because Suspense unmounts it immediately on resolve regardless, so the min-visible extension would never get a chance to apply. One implementation, not two.
- **Acknowledged trade-off, not changed:** on a genuinely slow initial load (slow network, cold cache, large lazy chunk — not the fast/cached case this feature targets), the 180ms show-delay means the user sees a blank screen for that window instead of the previous instant spinner/skeleton. This is the documented, intended behavior from Phase 7.3 ("do not render a skeleton for the first ~150-200ms") — 180ms is below the ~200-300ms threshold generally considered the point loading feedback needs to appear to avoid reading as unresponsive, so this is a deliberate, bounded trade-off rather than an oversight. Flagged here so it isn't mistaken for an accidental regression.
- **Verified, not a regression:** `BookingTable.tsx`'s use of `useDelayedLoading` was checked against pagination clicks specifically — it gates only on TanStack Query's `isLoading` (true-initial-load), not `isFetching`, so a "next page" click (which sets `isFetching` but not `isLoading` once data has loaded once) does not re-trigger the 180ms blank window; the table keeps showing current rows during a page transition, as intended.

**Not attempted this pass — stated explicitly rather than claimed:**

- **Full Phase 7.1 inventory/classification across every async surface** (guest form, calendar, parking, guest portal, finance, maintenance, pricing, inbox, marketing, team, org, analytics, notifications, plans, super-admin — ~2330 files). One pass cannot responsibly hand-classify every surface without risking speculative, unverified changes. The classification table (Surface type → Treatment) already lives in this doc (§Phase 7.1) as the living reference; adopting `useDelayedLoading` at the remaining consumers of `AdminSkeletons`/`GuestPageSkeletons`/`ListingGridSkeleton` is mechanical from here and left as a follow-up, not a defect — the shared hook exists and the one migrated consumer proves the pattern.
- **Playwright CLS/skeleton-appearance specs (Phase 7.6)** — needs a running browser session under throttling; not produced as a blind code change.
- **Empty/error/offline audit across all routes (Phase 7.5)** — spot-checked only via `BookingTable.tsx`; a full per-route audit is the same scope problem as Phase 7.1 above.

## Measured before / after

| Metric                         | Before                                 | After                                                    | Difference                                                         |
| ------------------------------ | -------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| Fast-load flash                | Suspense fallbacks painted immediately | `useDelayedLoading` 180 ms show-delay on `RouteFallback` | Cached/fast navigations show no skeleton                           |
| Bookings table first load      | Skeleton on raw `isLoading`            | Same skeleton, delayed                                   | Pagination still uses `isFetching` / `keepPreviousData` (no blank) |
| `isFetching` gating a skeleton | Feared as the common bug               | **Zero** matches in `ui/src`                             | Confirmed clean                                                    |
| Shared delay hook              | Per-site `setTimeout`s                 | `ui/src/hooks/useDelayedLoading.ts`                      | One implementation                                                 |
| Per-route four-state audit     | Uneven                                 | Only `BookingTable` + Suspense shells                    | Rest deferred                                                      |

## Remaining work to finalize

`useDelayedLoading` + `RouteFallback` + bookings-table delay are shipped. The rest of the app is not classified.

| #   | Work                                                                                                    | Blocker                  |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | Classify every async surface (page, sheet, list, form submit) as skeleton / spinner / inline / nothing. | Code audit               |
| 2   | Adopt the shared primitives on the classified surfaces (not only `BookingTable` + Suspense shells).     | Code                     |
| 3   | Prove the four states (empty, loading, error, ready) on the 9 baseline routes.                          | Display                  |
| 4   | Measure CLS / a11y on those routes and update route guides where loading UX changed.                    | Display + `route-guides` |

## Goal

Every asynchronous surface has a deliberate loading state that matches the final layout, causes no layout shift, and never flashes for fast responses. Consistency across guest, host, parking, and super-admin shells.

## Current state

170 of 2330 UI files reference `Skeleton`. Coverage exists but is uneven and unaudited: there is no rule saying which surfaces need one, no shared per-module skeleton set, and no guard against a new page shipping with a bare spinner or nothing at all.

Code splitting (doc 01) **increases** the need: every lazy boundary introduces a new loading moment that did not exist when everything was in one bundle. Suspense fallbacks and data skeletons are now both on the critical path.

## Phases

### Phase 7.1 — Inventory and classify

Enumerate every async surface and assign exactly one treatment:

| Surface type                       | Treatment                                                     | Rationale                                                                            |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Route-level Suspense (lazy chunk)  | Shell-shaped skeleton: nav + sidebar + content block          | The chrome is already known; only the content is pending                             |
| List/table first load              | Row skeletons matching real row height × expected page size   | Prevents the shift when rows arrive                                                  |
| List pagination / next page        | Keep previous data + subtle inline indicator, **no** skeleton | `placeholderData: keepPreviousData` is already used; a skeleton here is a regression |
| Detail page                        | Field-shaped skeleton mirroring the real layout               |                                                                                      |
| Card/stat tile                     | Tile-shaped skeleton with the same dimensions                 |                                                                                      |
| Chart                              | Fixed-height block, never a collapsing container              | Charts are the biggest CLS source                                                    |
| Image                              | Aspect-ratio box (doc 03)                                     |                                                                                      |
| Inline mutation (save, transition) | Button spinner + disabled, never a page skeleton              |                                                                                      |
| Background refetch                 | Nothing visible, or a top-line progress hint                  | Showing a skeleton on refetch makes a working app look broken                        |
| Optimistic mutation                | Render the optimistic result immediately                      | No loading state at all                                                              |

**The single most common mistake to prevent:** showing a skeleton on `isFetching` instead of `isLoading`/`isPending`. That makes every background refetch blank the screen. Audit all TanStack Query consumers for this.

### Phase 7.2 — Shared skeleton primitives

Build a small set in `ui/src/components/` so modules stop hand-rolling:

- `<SkeletonText lines={n} />`
- `<SkeletonTable rows={n} columns={ColumnSpec[]} />`
- `<SkeletonCardGrid count={n} />`
- `<SkeletonDetail sections={...} />`
- `<RouteSkeleton shell="guest" | "dashboard" | "parking" | "admin" />` for Suspense fallbacks

Each must read from the same design tokens as the real component so the skeleton and the content have identical geometry.

### Phase 7.3 — Anti-flash timing

Rules, applied in the primitives so every consumer inherits them:

- **Delay before showing**: do not render a skeleton for the first ~150–200 ms. A response that arrives in 80 ms should show no loading state at all; flashing one is worse than nothing.
- **Minimum visible duration**: once shown, keep it for ~300 ms so it does not strobe.
- Implement both in one `useDelayedLoading(isPending)` hook rather than per-site `setTimeout`s.

### Phase 7.4 — Coverage across every module

Apply to all of: guest form, calendar, listing pages, parking flows, guest portal, bookings, finance, maintenance, pricing, inbox, marketing, team, org, analytics, notifications, plans, super-admin console.

Every route guide under `docs/guides/routes/` must state what that page shows while loading — this is exactly the "per-route UX" content the `route-guides` skill requires.

### Phase 7.5 — Empty, error, and offline states

A loading state is one of four. Ship all four together or the page is not done:

| State   | Requirement                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------------- |
| Loading | Per above                                                                                            |
| Empty   | Explains what will appear and the action that creates it (copy per `human-copy` / `minimal-ui-copy`) |
| Error   | States what failed and offers retry; never a bare "Something went wrong" with no action              |
| Offline | PWA-aware; reconcile with `offlineQueryAllowlist.ts`                                                 |

### Phase 7.6 — Guard

- Playwright: for each of the 9 baseline routes, throttle the network and assert a skeleton appears and that CLS stays ≤ 0.1 through the transition.
- Add a review checklist item: any new `useQuery` consumer must handle all four states.

## Edge cases

- **Skeleton ≠ final geometry ⇒ CLS.** The skeleton must use the same row height, padding, and font metrics. A skeleton that shifts on load is worse than a spinner.
- **Nested Suspense waterfalls** — route skeleton, then section skeleton, then image placeholder, resolving in sequence, reads as three flashes. Co-locate data fetching so a route resolves in one wave.
- **Mobile bottom sheets** — a sheet that opens into a skeleton and then resizes fights the sheet's snap points. Fix the sheet height, then load inside it (coordinate with `mobile-responsive`).
- **Screen readers** — skeletons are decorative and must be `aria-hidden`, with the real status announced via a polite live region ("Loading bookings"). Otherwise a screen reader reads meaningless nodes. This is a WCAG concern; pair with the `accessibility` skill.
- **`prefers-reduced-motion`** — shimmer animations must stop; use a static tinted block.
- **Dark mode** — shimmer gradients tuned for light backgrounds look broken in dark. Token-drive both.
- **Suspense + error boundary** — a lazy chunk that fails to load leaves a skeleton forever unless an error boundary catches it (doc 01).

## Exit gate

- [ ] Every async surface classified; the classification table lives in the repo, not only in this plan.
- [ ] Shared skeleton primitives shipped and adopted; no new hand-rolled skeletons.
- [ ] No consumer keys a skeleton off `isFetching`.
- [ ] Delay + minimum-duration hook applied globally.
- [ ] All four states (loading/empty/error/offline) present on every route in the 9-route list.
- [ ] CLS ≤ 0.1 through loading transitions, verified under throttling.
- [ ] Skeletons `aria-hidden` with a live-region status; reduced-motion respected.
- [ ] Route guides updated (`route-guides` skill).

## Docs / Plans / activity-log

- **Docs:** `docs/guides/routes/*.md` (mandatory — invoke `route-guides`), `DESIGN.md` for the skeleton tokens, `mobile-responsive` skill for sheet behavior.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
