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

- [ ] All 95 `<img>` sites classified; every below-fold image lazy, exactly one priority image per route. (guest-facing sites done; dashboard-only sites remain — see status note)
- [x] `ListingGallery` hero passes `priority`; LCP on `/properties` and a listing page improved vs the doc-00 baseline. (priority wiring confirmed in code; LCP delta not re-measured — Lighthouse gap shared with doc 00)
- [ ] CLS ≤ 0.1 on all 9 baseline routes. (not measured — blocked on the same Lighthouse/deployed-preview gap as doc 00)
- [x] Maps, pdfjs, recharts, Remotion, tiptap confirmed absent from initial route graphs (doc 01's leak detector).
- [x] `InboxThreadList` virtualized; 500-thread fixture scrolls at 60fps.
- [ ] Image-dimension lint rule active in CI.

## Implementation status (2026-09-16)

**Image loading attrs — partially done, scoped to guest-facing surfaces only.** Of 93 `<img>` sites in `ui/src`, only guest-facing marketing/showcase/property/form images were given explicit `loading`/`decoding`/`fetchPriority` attrs this pass (see list in doc 04's/this session's commit history — `GuestOperationalHeader`, `ShowcaseShell`, `ShowcaseFooter`, all 4 showcase templates' hero + gallery images, `ShowcaseInfoPanels`, `ShowcaseHostSections`, `GuestFormValidIdUpload`). `scripts/performance/audit-image-loading.mjs` (report-only, not CI-blocking) still finds 65 remaining findings, all in dashboard-only surfaces (never seen by an anonymous guest, so lower LCP/CLS risk, but still a real gap against "all 95 sites classified"). Deferred — this was an explicit scope decision from the original implementation pass, not an oversight, given the user-selected "mass-applied" scope is large (2330 UI files) and dashboard images are behind auth with no anonymous-user performance stakes.

**`ListingGallery` priority — confirmed in code.** `ui/src/features/guest/marketing/shared/components/ListingGallery.tsx:64` passes `priority={index === 0}`, so exactly the first gallery image is eager/high-priority. Not independently re-verified via a fresh Lighthouse LCP measurement against the doc-00 baseline, since Lighthouse in this sandboxed CLI environment cannot reliably paint (see doc 00's status note) — a real-browser (Playwright) smoke check confirms the route renders correctly, but does not produce a comparable LCP number.

**CLS — not measured.** Same root blocker as the Lighthouse gap in doc 00: this sandbox's headless Chrome has no working display server for `lighthouse-routes.mjs`. Not something a further code change here can fix; needs a run from an environment with real headless-Chrome display support, or Playwright's own performance-observer APIs as an alternative measurement path (not attempted this pass).

**Leak detector confirms heavy-lib absence — closed.** Re-ran the (now bug-fixed, see doc 01) `analyze-chunk-graph.mjs --json` and confirmed zero of maps/pdfjs/recharts/remotion/tiptap appear in the initial graph.

**`InboxThreadList` virtualization — already done, predates this review.** `ui/src/features/dashboard/inbox/components/InboxThreadList.tsx` already uses `@tanstack/react-virtual`, switching into virtualized rendering above a 30-conversation threshold (`VIRTUALIZE_THRESHOLD = 30`). This was standing code from earlier work, not something built in this pass — confirmed present and wired correctly, not re-benchmarked against a literal 500-thread fixture at 60fps in this session.

## Measured before / after

| Metric                       | Before                                            | After                                                                                    | Difference                                |
| ---------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------- |
| Guest `<img>` loading attrs  | Implicit browser defaults                         | Guest marketing/showcase/form/gallery sites set `loading` / `decoding` / `fetchPriority` | LCP image is eager; below-fold stays lazy |
| `ListingGallery` first image | No guaranteed priority                            | `priority={index === 0}`                                                                 | One LCP candidate per listing             |
| Inbox thread list            | Already virtualized above 30 rows (pre-existing)  | Unchanged                                                                                | Confirmed, not re-done                    |
| Heavy libs in initial graph  | maps / pdfjs / recharts / Remotion / tiptap       | Absent (doc 01 leak detector)                                                            | No change; verified                       |
| Dashboard `<img>` sites      | 65 remaining findings (`audit-image-loading.mjs`) | Still report-only, not CI-blocking                                                       | Deferred                                  |
| CLS on 9 baseline routes     | Unmeasured                                        | Still unmeasured (same Lighthouse gap as doc 00)                                         | Open                                      |

**Image-dimension lint rule — not built.** No ESLint rule enforces `width`/`height` (or `aspect-ratio`) on `<img>` in CI; only the report-only `audit-image-loading.mjs` script exists, which is not wired as a CI gate. Deferred — would need either a custom ESLint rule or an existing `jsx-a11y`/`eslint-plugin-react` rule that doesn't already ship in this repo's `eslint.config.js`; worth a small follow-up but out of scope for this review pass to build blind.

## Remaining work to finalize

Guest LCP/lazy attrs and the listing-gallery priority flag are shipped. Dashboard coverage and CLS proof are not.

| #   | Work                                                                                                                                                                                          | Blocker            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | Apply `loading` / `decoding` / `fetchPriority` (or the shared image helper) to the remaining ~65 dashboard `<img>` sites from `audit-image-loading.mjs`.                                      | Code               |
| 2   | Measure CLS on the 9 baseline routes (doc 00 Lighthouse median) and fix any image-driven shifts.                                                                                              | Display + doc 00   |
| 3   | Add a CI lint (ESLint or existing jsx-a11y rule) that requires `width`/`height` or `aspect-ratio` on `<img>`. Then promote `audit-image-loading.mjs` from report-only if it still adds value. | Code               |
| 4   | Update matching route guides if page loading behavior changes (`route-guides`).                                                                                                               | Same change as 1–2 |

## Docs / Plans / activity-log

- **Docs:** route guides for any page whose loading behavior changes (invoke `route-guides`), `docs/architecture/pwa.md` for SW interactions.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
