---
title: 'App-wide skeleton loader overhaul'
status: done
tags: [workflow, done, ux, perceived-performance]
updated: 2026-09-27
stage: done
kind: reference
---

# App-wide skeleton loader overhaul

Layout-matched loading for host dashboard, super-admin, and guest/marketing surfaces. Chrome stays mounted; data regions use domain skeletons from `ui/src/components/skeletons/`.

## Shipped

- **Route registry:** `RouteSkeletonBoundary`, optional third `skeleton` arg on `propertyRoute` / `orgRoute` / `parkingRoute`, `RouteSkeletons.tsx`, `RouteGuardLoading`, path-aware marketing/account Suspense fallbacks.
- **Dashboard:** Analytics, bookings (table/kanban/KPIs), pricing bodies, parking dashboard, maintenance reminders, settings cards (in-shell nav skeleton), marketing studio tab, AI assistant panel, import commit step, custom pages and route guards.
- **Super-admin:** `superAdminRoute()` + `SuperAdminPage` `loadingBody`; host/org hub shells use header + body skeleton (not full-page `RouteGuardLoading`).
- **Guest/public:** Development detail + browse grids, account gate/profile/vouchers, search suggestions + map overlay use shared `Skeleton` primitive.
- **Docs:** [`docs/architecture/skeleton-loaders.md`](../../architecture/skeleton-loaders.md); loading note in `.cursor/rules/mobile-native-ui.mdc`.

## Verification

- `bun run ci:quality` green after the overhaul slice.
- Playwright `@smoke` green (117 tests) in the implementing session.

## Known exceptions (not bugs)

| Area                      | Treatment                                                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SD form / payment wait    | Centered spinner while provider resolves                                                                                                                                                 |
| Button / mutation pending | Inline `Loader2` on the control                                                                                                                                                          |
| Some lazy chunks          | `Suspense fallback={null}` where chrome already covers the surface                                                                                                                       |
| `AdminSkeletons.tsx`      | Still monolithic; domain files added alongside, split deferred                                                                                                                           |
| Polotno / video editor    | Toolbar or canvas busy states, not full page skeletons                                                                                                                                   |
| Phase 7 checklist doc     | [`07-loading-skeletons.md`](../planned/production-readiness-checklist/07-loading-skeletons.md) tracks broader anti-flash inventory; this overhaul is the route-level + high-traffic pass |

## Reference

Architecture inventory and invariants: **`docs/architecture/skeleton-loaders.md`**.
