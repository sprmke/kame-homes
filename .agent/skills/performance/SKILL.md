---
name: performance
description: Vite bundle and runtime performance — code splitting, query caching, heavy deps (pdf, charts). Use when optimizing load time or list refetch behavior.
---

# Performance (GFM)

## Vite

- **Every route-level page is `React.lazy()`** (established 2026-09-14, see `docs/workflow/for-testing/performance-optimization-production-readiness.md`) — new routes must follow the pattern already in every `ui/src/features/{dashboard,guest}/*/routes/*.tsx`: `const XPage = lazy(() => import('.../pages/XPage').then((m) => ({ default: m.XPage })));`. Never add a static `import { XPage } from '.../pages/XPage'` for a route element.
- Shells stay eager (`OrgAdminShell`/`PropertyAdminShell`/`ParkingAdminShell`/`MarketingLayoutShell`/`GuestAccountLayout`/`AuthLayout`) — only their `pages/` children are lazy. Each shell wraps its `<Outlet />` in `<Suspense fallback={<SectionLoadingFallback />}>` (`@/components/routing/RouteFallback`) so navigation only re-renders the content area. There's also one global `<Suspense fallback={<PageLoadingFallback />}>` around `<AppRoutes />` in `App.tsx` as a safety net for anything not under a shell.
- **A shell being eager doesn't mean everything it renders should be.** Any modal/panel/widget an eager shell mounts unconditionally (even if visually gated by an `open` prop) drags its whole import chain into the main bundle. Found via a bundle-visualizer pass, not obvious from reading one file at a time: `AdminLayout` alone was leaking `pdfjs-dist` (645 KB) through 3 separate sidebar CTAs/providers (`GetVerifiedModal`, `ListingVerificationSidebarCta`, `ListingContractRenewalProvider`) and `pdf-lib`+triplicated `pako` (~330 KB) through `SetupGuideOverlay`; `AuthLayout` was leaking `remotion`+`@remotion/player` (546 KB) through `HostWorkspaceSidePanel`. Fix is always the same: `const Heavy = lazy(() => import(...).then((m) => ({ default: m.Heavy })))` at the exact render site, `<Suspense fallback={null}>` around it — the AI Assistant chat panel (`AiAssistantLauncherButton.tsx`) is the reference pattern (defers the import until first opened via a `hasOpenedOnce` flag, not just on mount).
- Heavy libs: `pdfjs-dist`, `jspdf`, `recharts` — no separate action needed once the page (or the specific modal, per above) that uses them is lazy; Rollup already puts them in that chunk. Only add a component-level `lazy()` for a heavy widget mounted unconditionally by a shell or a component used across many pages.
- Check chunk warnings on `bun run build` — consider `import()` for admin-only PDF preview modals. For a deeper look at what's actually in a chunk, `npx vite-bundle-visualizer -t raw-data -o stats.json` works without touching `package.json`/`vite.config.ts` — but its per-chunk size attribution double-counts modules shared across entry points (its own "total" can run ~2x the real file size), so treat it as a lead to investigate, not a number to trust; confirm any fix by `grep`-ing the actual built chunk for a library-specific symbol (e.g. `PDFDocumentProxy` for pdfjs-dist) before and after.
- **Lighthouse/CLS measurement trap**: a previously-registered service worker will keep serving an old bundle from cache across `vite build` reruns even though the files on disk changed, making a before/after comparison look like nothing changed. Before re-measuring, run `(await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister())` and clear `caches` in the test browser, or use a fresh incognito Chrome profile (`--chrome-flags="--incognito"` for the Lighthouse CLI).
- **A `<Suspense>` boundary can itself cause a CLS regression** if something renders as an eager sibling of it rather than inside it. `MarketingLayoutShell` had `<MarketingFooter />` outside the route's `Suspense`, so on first load the footer painted right below the tiny loading skeleton, then got shoved ~1500px down once the real (much taller) page content resolved — a large, highly-visible shift of an already-painted element (CLS 0.502 on its own). Fix: put anything that should visually appear _with_ the resolved content (not before it) inside the same `Suspense` boundary, even if that means it "pops in" together with the content on first load instead of appearing instantly.

## TanStack Query

- `staleTime` on stable lists (bookings 30s+); for data that only changes through a mutation which already invalidates its exact key (org/property lists, settings, team/permissions), a much longer `staleTime` (60s-5min) is safe — check the mutation's `invalidateQueries` call before assuming a short default is needed.
- `keepPreviousData` for pagination
- **Narrow `invalidateQueries`** — never invalidate a bare top-level key (e.g. `['bookings']`, `['finance-line-items']`) from a mutation; scope it to the current org/property/scopeKey so you don't refetch every cached filter/page/tenant combo on one edit. `useBookings.ts` exports `invalidateBookingsListForProperty(qc, propertyId)` and `patchBookingsListRow(qc, propertyId, bookingId, patch)` — reuse these (or the same `predicate`-on-`queryKey` pattern) for any new booking-list mutation instead of writing a fresh bare invalidation.
- For a high-frequency mutation (status changes, quick toggles), add an optimistic `onMutate` + snapshot/rollback `onError` — see `useTransitionBooking.ts` for the reference pattern (patches both the detail cache and every matching list-page row).

## Images

- Explicit dimensions / `aspect-*` on media
- Property gallery: `PropertyMediaUpload` patterns
- Any section that renders nothing (or just a heading) while its query is loading, then expands once data arrives, is a CLS bug — give it a skeleton sized to match the loaded content's real footprint (see `FeaturedPropertyCardSkeleton` in `FeaturedProperties.tsx`: `aspect-[4/3]` image + text-line skeletons matching the real card). Don't `return null` while `isLoading` is true just because there's no data yet.
- The first/hero image in any above-the-fold gallery must pass `priority` through to `MarketingImage` (sets `loading="eager"` + `fetchPriority="high"`) — everything else stays lazy. See `ListingGallery.tsx`.

## Edge

- Batch DB reads in services; avoid N+1 in list endpoints
- Gmail listener: incremental history — do not full-scan inbox each poll
- Independent async operations (e.g. two PDF generations, two independent uploads, a batch of independent per-row sends in a cron) should run via `Promise.all`/`Promise.allSettled`, not a sequential loop — see `workflowOrchestrator.ts`'s GAF/pet PDF generation and `parkingReminderCron.ts`'s send loop.
- Before pushing a JS-side filter into a SQL `.eq()`/`.neq()`, confirm it's a plain equality/status check — anything touching `MM-DD-YYYY` text date fields (`check_in_date`, `check_out_date`) sorts wrong under a plain SQL comparison and needs a schema migration (generated ISO column + index) to do safely, not a quick query tweak. See `financeService.ts`'s `fetchAllBookingsForFinance` for the boundary between what's safe to push down and what isn't.

## Mobile

- Table horizontal scroll containers — not page-level overflow
- Avoid huge re-renders on filter keystroke — debounce search where already established

## Don'ts

- Premature `useMemo` everywhere — profile first
- Loading entire booking PDFs on list page

## Build check

```bash
bun run build
bun run type-check
```
