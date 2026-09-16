---
title: 'Add lazy loading'
status: active
tags: [workflow, planned, production-readiness, performance, images]
updated: 2026-09-16
stage: planned
kind: plan
---

# 03 — Add lazy loading

Three distinct kinds of lazy loading, often conflated. This doc covers all three.

1. **Route/component lazy** — mostly shipped (doc 01).
2. **Image/media lazy** — partially covered, with an LCP bug.
3. **Data lazy** — deferred queries, infinite scroll, on-demand panels.

## Goal

Nothing below the fold, off-screen, or behind an interaction costs anything on first paint — and the one element that _is_ the LCP loads eagerly with correct priority.

## Prior art — do not redo

| Shipped                                                         | Where                                                                                                                                                                                                 |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 123 route/component lazy boundaries                             | `ui/src`                                                                                                                                                                                              |
| `MarketingImage` wrapper with lazy default + `priority` opt-out | `ui/src/features/guest/marketing/shared/components/MarketingImage.tsx`                                                                                                                                |
| Lazy image optimizer, CI-asserted                               | `scripts/media/assert-lazy-optimizer.mjs`                                                                                                                                                             |
| Virtualized activity feed                                       | `ActivityFeedList.tsx` via `@tanstack/react-virtual`                                                                                                                                                  |
| Known LCP bug already filed                                     | [`performance-optimization-production-readiness.md`](../../for-testing/performance-optimization-production-readiness.md) §D.2 — `ListingGallery.tsx:73-134` never passes `priority` to the hero image |

## Current state

- 95 `<img` occurrences in `ui/src`; 58 sites reference an explicit `loading` attribute. The remainder either use `MarketingImage` (correct by default) or are raw `<img>` with **no** loading attribute — browser default is `eager`, so each is a candidate regression.
- `@tanstack/react-virtual` is a dependency but is used in only a small number of lists; `InboxThreadList.tsx` is already flagged as unvirtualized.

## Phases

### Phase 3.1 — Image audit across every surface

Enumerate all 95 `<img>` sites and classify:

| Class                                                                                 | Correct treatment                                                                                                                               |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| LCP candidate (hero, first gallery image, above-fold listing card on a landing route) | `loading="eager"` + `fetchpriority="high"` + `decoding="sync"`, **and** a `<link rel="preload" as="image">` where the URL is known at HTML time |
| Below-fold content image                                                              | `loading="lazy"` + `decoding="async"` + explicit `width`/`height` or `aspect-ratio`                                                             |
| Avatar / icon / small chrome                                                          | `loading="lazy"`, but inline SVG is better than an `<img>` for icons                                                                            |
| Background via CSS                                                                    | Not lazy by default; needs `content-visibility` or an IntersectionObserver                                                                      |

Fix the known `ListingGallery` hero bug here rather than leaving it in the sibling plan — it is the single highest-value LCP fix on the public site.

**Rule to enforce:** exactly **one** eager, high-priority image per route. Two "priority" images compete and neither wins.

### Phase 3.2 — Prevent layout shift (CLS)

Every lazy image must reserve space. Without `width`/`height` or `aspect-ratio`, lazy loading _causes_ CLS — trading one metric for another.

Add an ESLint rule (or a `check:images.mjs` script) that fails on an `<img>` with neither dimension attributes nor an `aspect-ratio` class.

### Phase 3.3 — Lazy the non-image heavies

| Surface                                   | Load trigger                                                                                                                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Maps (`@googlemaps/js-api-loader`) | On viewport intersection or an explicit "Show map" tap — never on page load. Also a **cost** item: Maps bills per load ([`super-admin-service-cost-monitoring.md`](../super-admin-service-cost-monitoring.md)) |
| `pdfjs-dist` viewer                       | On opening a document preview                                                                                                                                                                                  |
| `recharts`                                | On the analytics/finance panel becoming visible                                                                                                                                                                |
| Remotion player                           | On entering the video editor                                                                                                                                                                                   |
| Rich-text editor (`@tiptap/*`)            | On focusing the editor field, with a plain `<textarea>`/read-only render until then                                                                                                                            |
| Embla carousel                            | Fine eagerly (small), but its images follow 3.1                                                                                                                                                                |

### Phase 3.4 — List virtualization

Virtualize any list that can exceed ~100 rows:

- `InboxThreadList.tsx` (known gap)
- Bookings table at large page sizes
- Finance line items
- Activity log (already done — use as the reference)
- Notification center
- Super-admin cross-org listings

**Edge case:** virtualization breaks `Ctrl+F`, screen-reader row counts, and print. Set `aria-rowcount`/`aria-rowindex` on virtualized grids and offer a non-virtualized print/export path (the finance PDF export already provides this).

### Phase 3.5 — Data lazy

- Tab panels must not run their queries until the tab is selected (`enabled:` in TanStack Query), but should prefetch on tab hover.
- Modal/sheet contents must not query until open.
- Audit for queries that run on mount in a collapsed accordion.

## Edge cases

- **Lazy above the fold is a regression.** `loading="lazy"` on an in-viewport image delays it by a network round-trip. Only below-fold images get it.
- **Skeleton + lazy image = double shift** if the skeleton's box differs from the final image box. Match dimensions exactly (see doc 07).
- **IntersectionObserver in a scroll container** — a `root` other than the viewport is required when lazy content lives inside a scrollable sheet, which is common in this app's mobile bottom sheets. The default `root: null` never fires there.
- **Print / PDF export** — lazy images are blank in a print view. Force-load before `window.print()` or before html2canvas capture in Marketing Studio.
- **Playwright flake** — lazy content makes E2E assertions racy. Tests must wait on the element, not a timeout; add `scrollIntoViewIfNeeded` in helpers.
- **PWA offline** — a lazily fetched chunk or image that was never cached fails offline. Reconcile with `offlineQueryAllowlist.ts` and the SW strategy.

## Exit gate

- [ ] All 95 `<img>` sites classified; every below-fold image lazy, exactly one priority image per route.
- [ ] `ListingGallery` hero passes `priority`; LCP on `/properties` and a listing page improved vs the doc-00 baseline.
- [ ] CLS ≤ 0.1 on all 9 baseline routes.
- [ ] Maps, pdfjs, recharts, Remotion, tiptap confirmed absent from initial route graphs (doc 01's leak detector).
- [ ] `InboxThreadList` virtualized; 500-thread fixture scrolls at 60fps.
- [ ] Image-dimension lint rule active in CI.

## Docs / Plans / activity-log

- **Docs:** route guides for any page whose loading behavior changes (invoke `route-guides`), `docs/architecture/pwa.md` for SW interactions.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
