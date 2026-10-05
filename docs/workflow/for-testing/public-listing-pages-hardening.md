---
title: 'Public listing pages hardening (landing, developments, properties, parkings, search)'
status: active
tags: [planning, performance, search, marketing, pagination, caching, seo]
updated: 2026-10-04
stage: for-testing
kind: plan
---

# Public listing pages hardening

## Goal

Make `/`, `/developments*`, `/properties*`, `/parkings*` and `/search` correct at any catalog size, fast on mobile, and production-ready. That means server-side filtering/pagination in SQL, honest totals, no mock data in live paths, bounded image bandwidth, real caching with invalidation, and crawlable SEO metadata.

## Verdict

**Targeted re-architecture of the data layer, not a ground-up rewrite.** The UI shell, URL-state helpers (`listingQueryParams.ts`, `*Query.ts`), facet contract `{ data, total, facets, page, pageSize }`, place-group lazy rows, rate limiting, ILIKE escaping and explicit public-field allowlists are sound and should stay. Two layers need replacing:

1. **Edge list functions** load every ACTIVE row (with full `settings` JSONB) into Deno memory and filter, sort, facet and paginate in JS. That is the interim hybrid from [`../done/listing-search-pagination.md`](../done/listing-search-pagination.md) (Phase 1B "ideal path: RPC" was never built). Past `PUBLIC_LISTING_WORKING_SET_LIMIT = 20_000` ACTIVE rows every public page returns 500. It will not reach "thousands to millions".
2. **Several pages mix server pagination with client filtering**, or skip pagination entirely, so results past page 1 are unreachable.

## Findings (verified in code, 2026-10-04)

### P0: correctness bugs (users see wrong or missing data today)

| #   | Where                                                                                         | Bug                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `PropertiesListPage`, `DevelopmentsListPage`, `ParkingsListPage` (filtered grid + list views) | Fetch page 1 only (24) and render no pager. Toolbar says "300 results" but only 24 are reachable.                                                                                                                                                                                                                                                                                                                                         |
| 2   | `DevelopmentsLocationPage`                                                                    | `page: 1` hard-coded, `pageSize: 48`, no pager. Results 49+ are unreachable.                                                                                                                                                                                                                                                                                                                                                              |
| 3   | `DevelopmentPropertiesPage`                                                                   | No pager (24 cap). Filters, sort and view live in `useState`, so they're lost on back/refresh and can't be shared. A network error `<Navigate>`s to `/developments` instead of showing a retry.                                                                                                                                                                                                                                           |
| 4   | `ParkingsLocationPage`                                                                        | Server paginates (48/page) but filters + sort run **client-side on that one page**. Filtering on page 1 hides matches on pages 2+. The pager total ignores filters. Sort change doesn't reset page. The API already supports `location`, `towers`, `minPrice`, `maxPrice`.                                                                                                                                                                |
| 5   | `DevelopmentParkingListPage`                                                                  | Fetches 48 slots, then filters client-side. Slots past 48 are invisible; count is the client-filtered count of 48.                                                                                                                                                                                                                                                                                                                        |
| 6   | `_shared/publicListingFacets.ts#batchLoadReviewStats`                                         | Reads raw `guest_reviews` rows per 200-id chunk with no paging. `config.toml max_rows = 1000` silently truncates, so ratings, review counts and the default `recommended` sort are wrong once a chunk exceeds 1,000 reviews. Pricing/review errors are swallowed (`continue`) and fall back to default prices.                                                                                                                            |
| 7   | `list-public-properties` developments lookup                                                  | `.limit(500)`. Properties in developments past #500 lose `developmentSlug`, so the Development filter silently drops them.                                                                                                                                                                                                                                                                                                                |
| 8   | `list-public-developments` + `list-public-place-groups` property counts                       | Raw `.in('residence_name', names)` rows, truncated at 1,000. Also case-sensitive `IN`, while the rest of the pipeline matches lower-cased, so counts disagree with the Development filter.                                                                                                                                                                                                                                                |
| 9   | Mock data in live paths                                                                       | `DevelopmentHero` decides "has parking" from `mockParkingSlots`. `resolvePublicDevelopment` (used by `PropertyOverview`, `ParkingOverview`, `ParkingDetailPage`) links developments from `mockDevelopments`. `listingSearchDefaultLocation` (used by `MarketingLayoutShell`, every public page) resolves hero "Where" from mocks. Real developments get wrong or missing links/CTAs, and ~3k lines of mock data ship in the shell bundle. |

### P1: scale and performance

| #   | Area                   | Issue                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | Edge list architecture | O(catalog) per request: all rows plus `settings` JSONB, all pricing, and all reviews (default sort) on every call, including the landing carousel (`pageSize: 8`) and the facet-only call on grouped browse (`pageSize: 1`). Hard 500 above 20k rows. Same pattern in `search-listings` and `list-public-place-groups`. |
| 11  | No shared cache        | `Cache-Control: s-maxage` is set, but edge functions are called directly on `*.supabase.co` with no CDN in front, so nothing honours it. `_shared/queryCache.ts#readThrough` exists but no public endpoint uses it.                                                                                                     |
| 12  | Card images            | `PropertyCard` renders **every** gallery image as stacked `<img>`. `opacity-0` images in the viewport still load, so each visible card downloads its full gallery at original resolution. List payload sends uncapped `images[]`. `MarketingImage` ignores `sizes` and has no `srcset`/transform.                       |
| 13  | Request hygiene        | `publicListingFetch` / `publicSearchFetch` / place-groups don't pass React Query's `signal`, so superseded filter and suggestion requests keep running and burn the per-IP rate-limit budget.                                                                                                                           |
| 14  | Landing                | `HeroCanvas` rAF loop keeps running after the hero scrolls offscreen. Card entrance animations stagger by `index * 0.05s` (2.4s for the 48th card).                                                                                                                                                                     |
| 15  | Duplication            | `toPropertyCard` is duplicated in `PropertiesListPage`, `PropertiesLocationPage` and `propertiesQuery.ts`. Three location pages hand-roll their own pager instead of `PublicListingPagination`. `FeaturedDevelopments` is unused. `HeroSearch.tsx` is 1,313 lines.                                                      |

### P1: SEO and security

| #   | Issue                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | No `<meta name="description">`, Open Graph/Twitter tags, canonical, JSON-LD (`LodgingBusiness`/`Offer`), `robots.txt` or `sitemap.xml`. SPA-only rendering means shared links show no preview and listing pages are weakly indexable. |
| 17  | Public list items expose `tower` + `unitNumber` (exact unit) to anonymous users. Product decision: Airbnb-style "approximate until booked" is the safer default for host safety.                                                      |
| 18  | No max length on `where` / `q`, and no cap on CSV array params (`amenities`, `type`, `development`). Low risk given escaping and rate limits, but cheap to bound (e.g. 120 chars, 30 items).                                          |
| 19  | Listings filtered by `checkIn`/`checkOut` are served as `publicDynamic` (browser `max-age=60`). Acceptable for browse because booking re-validates, but date-filtered requests should use `publicAvailability`.                       |

### What's already solid (keep)

URL as the source of truth on the three index pages · defaults omitted from URLs · `keepPreviousData` · debounced suggestions (250 ms, min 2 chars) · `postgrestOrIlikeValue` escaping · trigram indexes on name/city/residence/tower · `servePublic` + per-IP durable rate limit · explicit field mapping (no raw `settings` passthrough) · fail-closed `private` default cache class · lazy route chunks · place-group "Show more places" pagination · facets computed on the full filtered set (disjunctive in map mode).

## Implementation status (2026-10-04)

All five phases are implemented and verified locally. Remaining: manual QA (below) and the production deploy.

**Phase 2: SQL index.** Migration `20261316126800_public_listing_search_index.sql` (index table, triggers on 6 source tables, `search_public_*` + `public_listing_place_groups` RPCs, catalog version). Edge functions `list-public-*`, `list-public-place-groups`, `search-listings` rewritten as thin RPC callers with shared card loaders (`_shared/publicListingCards.ts`) and request bounds (`_shared/publicListingSearch.ts`); the in-memory candidate loaders, facet helpers, and unpaged availability loaders were deleted. Verification:

- Endpoint parity: 69-case query matrix snapshotted before the rewrite and diffed after. With the old parking price source emulated, 67/69 match exactly (ids, order, totals, facets); the 2 differences are the intended literal-search match on parking city. Card fields match except intended changes (charged parking rate, 5-image cap, real ratings/prices in `/search` summaries).
- SQL ↔ TS parity + trigger sync + RPC behavior: `bun run test:edge:listing-search` (8 tests; a deliberately corrupted index row fails it).
- Benchmark (100,000 properties + 20,000 parkings, rolled back): every query shape 5 to 260 ms; concept search went 9.9 s → 225 ms after replacing the per-row token split with an inlined rank + single alternation regex prefilter.
- Bugs found and fixed on the way: availability loaders truncated at 1,000 bookings per 200 listings (booked listings could show as available); parking blocked dates ignored by public date search; parking list price (`rate_per_night`) disagreed with the detail page and checkout (`parking_settings`), and `create-parking` seeded every slot at ₱300 regardless of the host's rate.

**Phase 3: caching.** In-isolate LRU keyed by the per-family catalog version (≤5 s invalidation, in-flight dedupe, failed computes not cached, broken version read falls back to direct compute); date-filtered requests bypass it and send `publicAvailability`. Client prefetches the target page on pager hover / focus / touch; landing rail `staleTime` 5 min. **Decision:** no Vercel CDN in front of the functions; it cannot be purged on catalog changes and the version-keyed cache covers the hot paths. The DB `query_cache` table was not used for public listings (it adds a DB round trip per hit, which is what the RPC itself costs now).

**Phase 4: front end.** Gallery windowing (`useGalleryWindow`), capped entrance stagger, `MarketingImage` `srcset` (Storage transforms behind `VITE_SUPABASE_IMAGE_TRANSFORMS`, Unsplash `w=`) with fallback on error, lazy map chunk (`LazyListingMapView`), hero canvas pauses offscreen and reads theme colors every 60 frames instead of every frame, `HeroSearch` pure state + parts extracted (1,313 → 985 lines, tested), unused `FeaturedDevelopments` deleted.

**Phase 5: SEO + hardening.** `usePageMeta` on every public page (titles added to location and development sub-pages, which had none; `/search` is `noindex`), JSON-LD on detail pages (city-level address only), `ui/middleware.ts` (robots, sitemap proxy, crawler meta for listing detail URLs; fail-open, narrow matcher), `public-sitemap` edge function, static `robots.txt` fallback. Request bounds on all public list/search params. `DevelopmentDetailPage` shows retry instead of redirecting on a network error.

**Decisions to confirm with product**

- Unit numbers: list cards no longer receive `unitNumber`; the detail payload still does (the page derives "Floor N" from it and never displays the number). Hosts who name listings by unit (for example "Monaco 2612") still expose it through the name. Hiding it fully would need a naming guideline or a server-side floor field.
- Literal `/search` text now matches parking city.

**Manual QA**

1. `/properties?type=condo` → pager, Back returns to the previous page, select two types (both stay listed in the sidebar).
2. `/parkings/in/<city>` → tower + price filters change the total; dates hide booked / blocked slots.
3. `/developments/in/<city>` → 12 per page, rows show homes.
4. Edit a property price in the dashboard → public card updates within a few seconds.
5. Share a property URL in Messenger / Facebook debugger → title, description, photo preview.
6. `curl https://<host>/robots.txt` and `/sitemap.xml` on a deployment with `PUBLIC_GUEST_APP_ORIGIN` set.
7. Phone (375 px): pager tap targets, card swipe loads the next photo only after interaction.

## Plan

Each phase is shippable alone. Phase 1 needs no migration and fixes every user-visible bug.

### Phase 1: Correctness on the current backend (no migration) — **done 2026-10-04**

Shipped: pager on filtered index views + all location/development sub-pages (`ListingResultsPagination`); URL state for sub-pages (`useListingUrlQuery`); parking location + development parking pages send filters/dates to the API; filtered-empty no longer redirects away; paged review/count batch reads (`loadRowsByKeyChunks`) and fail-closed pricing/review batches; developments lookup paged; **disjunctive facets** on all three list endpoints (`filterRowsExcept`, found during implementation: selecting one type/tower/city hid the others); detail payloads return `development` (`publicDevelopmentLink.ts`) and mock catalogs are out of live paths; retry error states; abort `signal` in all public fetchers. Verified against the local stack (filtered page 2, facet sibling counts, development links, property counts).

Not done in Phase 1: `NotFoundPage` for unknown slugs (kept the documented redirect). `/developments/in/:location` previews are capped at 48 homes across the 12 developments on a page (Phase 2 per-group windows fix this).

1. Add the shared `PublicListingPagination` (URL `page`) to filtered grid and list views on the three index pages, `DevelopmentsLocationPage` and `DevelopmentPropertiesPage`. Scroll to the results top on page change.
2. Move location and development sub-pages to URL state (reuse `parse*/write*Query`), so filters, sort, view and page survive back/refresh/share. Reset `page` on any filter or sort change.
3. `ParkingsLocationPage` + `DevelopmentParkingListPage`: send filters/sort to `list-public-parkings` and drop client-side `filterParkingSlots`. Use server `total` and facets (towers from facets, not from the current page).
4. Fix truncation: aggregate reviews and property counts server-side, or page every `.in()` read through `loadPublicListingRows`. Remove the developments `.limit(500)`. Use case-insensitive matching for counts. Surface pricing/review batch errors instead of silently defaulting.
5. Remove mock data from live paths: `DevelopmentHero.hasParking` comes from the API (`usePublicParkings({developmentSlug, pageSize:1}).total`, already used on `DevelopmentPropertiesPage`). `resolvePublicDevelopment` uses `developmentSlug`/`developmentName` already on the API payloads. `listingSearchDefaultLocation` derives from route params + loaded data. Mocks stay only behind `explore-preview`/showcase.
6. Error states: replace `<Navigate>` on fetch error with a retry state, and use `NotFoundPage` for unknown slugs.
7. Pass `signal` through all public fetchers.

### Phase 2: SQL-backed listing (the scale fix)

1. Migration: a denormalized `public_listing_search` table per family (or one table with `family`), kept in sync by triggers on `properties`/`parkings`/`developments`/`app_settings`/`parking_settings`/`guest_reviews`. Columns: `id, family, slug, status, name, city, place_slug, type, price, bedrooms, max_guests, amenity_ids text[], development_id, rating, review_count, lat, lng, created_at, card jsonb` (cover + ≤5 images + card chrome).
   - Indexes: `(family, status, place_slug)`, `(family, status, price)`, GIN on `amenity_ids`, trigram on `name`/`city`, `(rating DESC, review_count DESC, id)` for sort, and lat/lng (btree box or PostGIS `geography` + GiST if available) for bbox/radius.
   - Coordinate with [`multi-residence-config-decoupling.md`](./multi-residence-config-decoupling.md), which adds a `development_id` FK. Join on it instead of `residence_name` text.
2. `SECURITY DEFINER` RPCs `search_public_<family>(filters jsonb, sort, limit, offset)` returning `{ rows, total }` and `public_<family>_facets(filters jsonb)` with `GROUP BY` counts. Availability becomes `NOT EXISTS` against the booking conflict index. Executable by `service_role` only.
3. Edge functions become thin: validate params → RPC → map. Delete in-memory filter/sort and the 20k ceiling. `search-listings` and `list-public-place-groups` (`GROUP BY place_slug` with window-limited previews) use the same RPCs.
4. Offset pagination is fine for UI pages (pageSize ≤ 48, page count bounded by the UI). Add a hard `page × pageSize ≤ 10_000` cap to block deep-offset scraping.
5. Verify with seeded volume (10k / 100k rows): p95 < 300 ms per call, `EXPLAIN ANALYZE` on every filter combination, and identical results to Phase 1 on the current seed.

### Phase 3: Caching and invalidation

1. Server cache: wrap the RPC result in `readThrough` (namespace per family, key = normalized params, `permissionScope: null` since public, TTL 60 s with jitter). Bypass when `checkIn`/`checkOut` is present, or use 15 s.
2. Invalidation: bump a `public_catalog_version` (single-row table or `platform_settings` key) from the same triggers as Phase 2.1, and fold the version into the cache key. Every listing/price/review/status change invalidates instantly with no per-key purge. The client stays at `staleTime` 30–60 s.
3. Optional CDN: route public GETs through a Vercel rewrite (`/api/public/*` → functions) so `s-maxage` + `stale-while-revalidate` actually cache at the edge. Needs `Vary` review and a check that no `Authorization`-dependent public response exists. Decide after Phase 2 metrics.
4. Prefetch: on pager hover/focus `queryClient.prefetchQuery` the next page. Landing carousels and featured rows use `staleTime: 5 min`.

### Phase 4: Front-end performance

1. Cards render the active image plus the next one only (lazy-mount on carousel interaction). Cap list payload `images` at 5.
2. `MarketingImage`: `srcset`/`sizes` via Supabase Storage image transforms (`/render/image/public/...?width=`) when available, with a plain URL fallback. `priority` on the first row only (LCP).
3. Pause `HeroCanvas` via `IntersectionObserver` when offscreen. Cap entrance stagger at about 8 items.
4. Lazy-load map components (`PropertiesMap`, `DevelopmentsMap`, `ListingMapView`) with `React.lazy` so grid/list visits don't ship map code.
5. Consolidate `toPropertyCard` and the hand-rolled pagers. Delete unused `FeaturedDevelopments`. Split `HeroSearch.tsx` into field components plus a `useHeroSearchState` hook (no behavior change).
6. Virtualize only if a single page grows past ~100 cards. Not needed at pageSize ≤ 48.

### Phase 5: SEO and hardening

1. `usePageMeta` (title, description, canonical, OG/Twitter image) on all public pages, and JSON-LD on property/parking/development detail pages.
2. `robots.txt` + `sitemap.xml` generated by an edge function from the Phase 2 table (cached `publicStatic`), linked from `robots.txt`.
3. Social previews + indexability: prerender public routes (e.g. a build-time or on-demand prerender for `/`, `/properties/:slug`, `/developments/:slug`, `/parkings/:slug`), or a Vercel middleware that injects meta for crawler user agents. Decide at phase start; the full SSR migration is out of scope.
4. Bound `where`/`q` (120 chars) and CSV params (30 items) in the edge param parsers. Use the `publicAvailability` cache class when dates are present.
5. Product decision on hiding `unitNumber` (and exact `tower`) from anonymous list/detail payloads.

### Tests (each phase)

- Vitest: query parse/write round-trips for location/development pages, page reset on filter change, card image windowing.
- Deno: RPC param validation, facet/total parity, review aggregation over 1k+ rows (regression for #6), cache key + version bump.
- Playwright (mocked, `ui/e2e/features/public/`): pager reachable on filtered properties, parking location filter across pages, back button restores filters, development parking CTA from API.

## Docs to update in the same changes

`docs/guides/routes/{index-landing,properties,developments,parkings,search}.md`, `docs/PROJECT.md` (API + new RPCs), `docs/architecture/overview.md` (public listing data flow + cache invalidation), `docs/archive/operations/migration-runbook.md` (Phase 2 backfill). `activity-log: N/A — read-only public endpoints`. Plans/RBAC: N/A (public, anonymous).
