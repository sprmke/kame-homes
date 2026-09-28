# Skeleton loaders

Loading UI must mirror the **layout that appears after data loads**, on phone and desktop. Generic spinners and full-page swaps that hide chrome are reserved for pre-shell gates only.

## Invariants

1. **Chrome stays mounted.** Page hero (`AdminMobilePage` / `AdminPageHeader`), nav, sidebars, and marketing footer stay visible. Only the **data region** shows a skeleton.
2. **Shape matches content.** Reuse domain skeletons from `ui/src/components/skeletons/` (or add a sibling module). Do not reuse unrelated dashboards (e.g. property dashboard skeleton on org analytics).
3. **Default view.** The skeleton shows the page's default view: default tab (org Plans opens on **Billing**), default list mode (org listings follow `defaultOrgListingViewMode`: list under 5 items, table at 5+ on desktop, grid at 5+ below `lg`), bookings `?view=` (table on desktop, cards on phone).
4. **Route skeletons carry page chrome.** Page chrome is rendered by the lazy page, so an org `*RouteSkeleton` renders the same `AdminMobilePage` (title, subtitle, `titleId`, `dense`, `className`, date-filter overlap placeholder) as the loaded page. Without it the hero and header jump when the chunk resolves.

## Route registry

| Mechanism                                     | Role                                                                                                                                                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RouteSkeletonBoundary`                       | Wraps lazy route chunks + provides skeleton to `Suspense` and permission guards (`ui/src/components/skeletons/RouteSkeleton.tsx`).                                                                    |
| `propertyRoute` / `orgRoute` / `parkingRoute` | Third argument: eager skeleton node (`ui/src/features/dashboard/org/routes/guards.tsx`). `RouteSkeletonProvider` wraps the permission guards, so guard loading and the chunk `Suspense` both show it. |
| `RouteSkeletons.tsx`                          | Named `*RouteSkeleton` exports wired from dashboard route modules.                                                                                                                                    |
| `RouteGuardLoading`                           | In-shell guards: `useRouteSkeleton()` or fallback `RouteGuardSkeleton`.                                                                                                                               |
| `RouteGuardSkeleton`                          | **Pre-shell only** (auth, onboarding, org selector, accept invite).                                                                                                                                   |
| `MarketingRouteSuspenseFallback`              | Path-aware marketing `Suspense` fallback (`MarketingRouteFallback.tsx`).                                                                                                                              |
| `GuestAccountRouteSuspenseFallback`           | Account area `Suspense` fallback (sidebar stays mounted).                                                                                                                                             |
| `useOrgListingSkeletonView`                   | Default org listing view for skeletons from cached property / parking lists (read-only, never fetches).                                                                                               |

Super-admin lazy routes use `superAdminRoute(page, skeleton)` in `ui/src/features/dashboard/super-admin/routes/index.tsx`.

Nested layouts with lazy children keep their own `Suspense` around `<Outlet />` so switching sections does not unmount the layout (Help & Support: `HelpSupportSectionSkeleton`).

## Module map (eager skeletons)

| File                         | Domains                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `AdminSkeletons.tsx`         | Shared admin primitives, list toolbar, bookings, finance, settings nav, listings, marketing studio, org dashboard, plans |
| `OrgListingSkeleton.tsx`     | Org Properties / Parkings page body, org listing table / grid / list views (inventory + analytics variants)              |
| `AnalyticsSkeleton.tsx`      | Org + property analytics                                                                                                 |
| `AnnouncementsSkeleton.tsx`  | Host announcements list / detail body                                                                                    |
| `BookingsExtrasSkeleton.tsx` | Stage KPI strip, kanban                                                                                                  |
| `PricingSkeleton.tsx`        | Property/parking pricing body (stats + calendar + rates column)                                                          |
| `ParkingSkeleton.tsx`        | Parking dashboard, booking detail                                                                                        |
| `GuestMarketingSkeleton.tsx` | Development detail, browse grids, account gate, property chat                                                            |
| `HelpSupportSkeleton.tsx`    | Help & Support page (module nav, intro, FAQs / guides / tickets), documentation topics                                   |
| `SuperAdminSkeletons.tsx`    | List/overview/audit bodies                                                                                               |
| `AiAssistantSkeleton.tsx`    | AI assistant panel chunk                                                                                                 |
| `GuestPageSkeletons.tsx`     | Guest form page                                                                                                          |
| `GuestAccountSkeletons.tsx`  | Profile form, voucher wallet rows                                                                                        |
| `ImportWizardSkeleton.tsx`   | Import wizard commit step                                                                                                |

## Pre-shell and top-level fallbacks

| Surface               | Skeleton                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `RouteGuardSkeleton`  | Branded `AppLoader` when no route skeleton is registered (onboarding, org hub redirect, accept invite, admin auth) |
| `PageLoadingFallback` | Full-screen `AppLoader` before any app shell mounts (`App.tsx` lazy routes)                                        |

`AppSettingsCardSkeleton` remains for callers that do not yet mount their own page header; prefer `AppSettingsNavLayoutSkeleton` inside an existing `AdminMobilePage` / hub header.

## Adding a new dashboard route

1. Add or reuse a skeleton component that matches the loaded layout and default view (375px first).
2. Export a `*RouteSkeleton` from `RouteSkeletons.tsx` if the shape is route-specific. Wrap the body in the page's `AdminMobilePage` with the same props as the loaded page.
3. Pass it as the third argument to `propertyRoute` / `orgRoute` / `parkingRoute`, or wrap with `RouteSkeletonBoundary` (super-admin, guest shells).
4. Page-level `isLoading`: keep shell/header; swap **body** only (`SuperAdminPage` `loadingBody`, `AdminMobilePage` children).

## Verification

- 375 / 768 / 1024px: skeleton aligns with loaded UI; no horizontal scroll.
- Slow 3G: lazy routes show route skeleton, not `AppLoader`, once inside admin/marketing shell.
- No hero / header jump when the route chunk resolves.
