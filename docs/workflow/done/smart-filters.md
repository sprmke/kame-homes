---
stage: done
title: 'Smart Public Filter Sidebar & Sort — Implementation Plan'
status: done
tags: [planning, planned-modules]
updated: 2026-08-05
---

# Smart Public Filter Sidebar & Sort — Implementation Plan

## Implementation status (2026-08-05)

- [x] Migration `20261006120000_public_listing_filter_indexes.sql`
- [x] `_shared/publicListingFacets.ts` batch helpers
- [x] `list-public-properties`, `list-public-developments`, `list-public-parkings` + `config.toml`
- [x] `listingQueryParams.ts` + per-vertical query modules (`propertiesQuery`, `developmentsQuery`, `parkingsQuery`)
- [x] `usePublicProperties`, `usePublicDevelopments`, `usePublicParkings`
- [x] Properties / Developments / Parkings list pages wired to URL-backed filters + server facets/sort
- [x] Phase 4: `/search` category tabs reuse vertical filter sidebars + `list-public-*` (All view stays `search-listings`)
- [x] Phase 4 polish: `/search` toolbar with sort + grid/list/map view; Filters from All switches to the preferred category (button names it; Nearby scope carried as `lat`/`lng`)
- [x] Harden: mobile sheet sort, dismissible filter chips, filtered empty + Clear filters, a11y (dialog/aria-pressed/44px/reduced-motion/token colors)
- [x] Product decision: **remove** price L↔H sorts (race-to-bottom risk); budget via price-range filters only; see § Sort fairness
- [x] Route guides + edge-functions API table updated
- [ ] Playwright walkthrough + manual curl verification per vertical
- [ ] Retire remaining mock imports on non-list marketing pages (detail/location — out of list-page scope)

Sibling dependency **`smart-search-bar.md`** is largely shipped (typeahead + `/search` + smart intents); browse-page filters no longer blocked on it.

## Sort fairness — product decision (2026-08-05, revised)

**Question:** Does offering **Price: Low to High** / **High to Low** unfairly push guests to the cheapest listing and hurt hosts?

**Assessment:** Even as an opt-in, price-asc browse trains guests to shop cheapest-first and pressures hosts into a race to the bottom over time. Budget intent is better served by **price-range filters** (results stay on Recommended / quality order inside the band).

**Decision (shipped — do not re-add without explicit product revisit):**

| Surface                               | Default sort  | Price L→H / H→L | Budget path                        |
| ------------------------------------- | ------------- | --------------- | ---------------------------------- |
| Properties / Developments / `/search` | `recommended` | **Removed**     | Price-range filter chips / presets |
| Parkings                              | `tower`       | **Removed**     | Price-range filter                 |

**Shipped sorts:**

- Properties / `/search` properties: `recommended` \| `rating` \| `reviews` \| `newest`
- Developments / `/search` developments: `recommended` \| `newest`
- Parkings: `tower` only (sort control hidden when a single option remains)

Legacy URL values (`price-low`, `price-high`, `price_asc`, `price_desc`) fall back to the vertical default via the sort allowlist.

**Invariants:**

1. Do **not** ship `price-low` / `price-high` / `price_asc` / `price_desc` as public sort options.
2. Default homes/developments to `recommended`; parkings to `tower`.
3. Teach budget shopping via **price filters**, not price sort.

## Context

The public browse pages (`/properties`, `/developments`, `/parkings`) already ship polished filter sidebars (`PropertiesFilters.tsx`, `DevelopmentsFilters.tsx`, `ParkingFilters.tsx`) and sort dropdowns (`PropertiesToolbar.tsx`, `DevelopmentsToolbar.tsx`, `ParkingToolbar.tsx`), but they are decorative: filter selections are local component state that is **never read by the list page** — `PropertiesListPage.tsx` renders `<PropertiesFilters isOpen={filtersOpen} onClose={...} isMobile={false} />` with no `value`/`onChange` props at all, and sorts a hardcoded `mockProperties` array client-side, including a fake `newest` sort keyed off a mock `isNew` boolean instead of a real timestamp. There is no public bulk-list backend at all today — only single-slug detail lookups (`get-public-property`, `get-public-parking`) exist. The goal of this effort is to make the filter sidebar and sort options **actually filter and sort real data**, end to end, on every public browse page — smartly suggested filter options (driven by what's actually in the dataset, not hardcoded lists) and sort fields that are all genuinely backed by real data.

This plan is a continuation of `docs/workflow/in-progress/smart-search-bar.md`. It reuses, rather than duplicates, the shared infrastructure that plan introduces:

- `properties.city` (real column, promoted from `settings->>'city'` by that plan's migration)
- `_shared/availabilityService.ts` (`loadConflictingPropertyIds`/`loadConflictingParkingIds`) for date-availability exclusion
- once `/search` exists, this plan's filter/sort primitives get layered onto it, superseding that plan's "no advanced filters" non-goal (decision made during this plan's brainstorming, not re-litigated here)

## Decisions made during brainstorming (do not re-litigate during implementation)

1. **Scope**: only the multi-item browse/listing pages — `/properties`, `/developments`, `/parkings` — plus the future `/search` results page. The single-property operational flows (calendar, sd-form, pay-parking, stay-guide) are explicitly **out of scope**: a guest reaches those via a direct link to one specific property with no listing to filter, so "filters" don't structurally apply there.
2. **`/search`**: once it ships (per the sibling plan), it becomes just another results listing and gets the same filter sidebar + sort as the browse pages, reusing one shared implementation rather than a bespoke fourth one.
3. **Sequencing**: build the **Properties** vertical fully end-to-end first — it has the richest existing filter UI and the richest data model (`publicPropertyService.ts` already assembles price/amenities/rating per-slug) — proving the pattern, then mechanically replicate to Developments and Parking.
4. **Dependency**: builds on smart-search-bar shared infra (`properties.city`, `availabilityService.ts`) — shipped; `/search` filter extension (Phase 4) waits on both plans' core surfaces.

## Current state (verified this session)

- **Filters are fully disconnected today**: `PropertiesFilters`/`DevelopmentsFilters`/`ParkingFilters` hold `useState` internally and never call back up to their list page. `PropertiesListPage.tsx` (L59-69) confirms this directly — `PropertiesFilters` receives only `isOpen`/`onClose`/`isMobile`, no `value`/`onChange`. This must be redesigned as controlled components driven by URL state, not just "wired up."
- **`newest` sort is fake**: `PropertiesListPage.tsx`'s `newest` case sorts by `(b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)` — a boolean mock flag, not a real timestamp. `properties`, `developments`, and `parkings` tables all have real `created_at TIMESTAMPTZ` columns (`20260629180000_multi_tenancy_foundation.sql`, `20260719100000_developments.sql`, `20260918120000_parkings.sql`), so a real `newest` sort is fully backed once wired to `ORDER BY created_at DESC`.
- **Pricing lives in `app_settings`** (one row per `property_id`, added by `20260910130000_property_pricing.sql`: `weekday_nightly_rate`, `weekend_nightly_rate`, `default_down_payment`, `default_security_deposit`, `default_pet_fee`), loaded today via `_shared/propertyPricing.ts#loadPropertyPricing(propertyId)`. Parking pricing is analogous (`loadParkingPricing`, per `parkingScope.ts`).
- **Perf/side-effect trap for a list endpoint**: `loadPropertyPricing()` calls `ensurePropertySettings(propertyId)` first, which **upserts** a row if missing — fine for a single-slug detail fetch, but an N+1-query-and-N-write footgun if looped for a list of 20+ properties. Same shape risk with per-property review queries. A list endpoint must use **batched** reads (`app_settings`/`guest_reviews` queried once with `.in('property_id', ids)`), not loop the existing per-slug helpers.
- **Amenity id→label catalog already exists**: `_shared/publicPropertyAmenities.ts` (`resolveAmenityLabels`/`AMENITY_LABELS`) maps raw `settings.enabledAmenities` ids to display labels. Facets must reuse this catalog rather than re-deriving amenity display names.
- **Sort dropdowns already enumerate the target field sets**, useful as the literal starting menu to re-ground in real data:
  - Properties (`PropertiesToolbar.tsx`): `recommended | price-low | price-high | rating | reviews | newest`.
  - Developments (`DevelopmentsToolbar.tsx`): `recommended | rating | price-low | price-high | newest` — but developments have **no rating column and are never reviewed directly** (`guest_reviews.property_id` only), so `rating` has no real backing and must be dropped, not shipped as a no-op.
  - Parking (`ParkingToolbar.tsx`, backed by `parkingSlotFilters.ts`): `price_asc | price_desc | tower` — already realistic; `parking_type`/`residence_name`/`tower`/`level`/`rate_per_night` are all real columns, so parking needs the least rework.
- **Reusable admin primitives are already generic**, not property-specific despite the "Admin" prefix: `ui/src/components/navigation/AdminMultiSelectFilter.tsx`, `AdminSingleSelectFilter.tsx`, `AdminSortMenu.tsx`, `AdminViewToggle.tsx` are all `<T extends string>` generics with `options/value/onChange` props — directly usable (or trivially wrapped) by the public pages.
- **URL-state pattern to mirror**: `BookingsListPage.tsx`'s `parseQueryFromParams(sp)`/`writeQueryToParams(q, cur)` pair, `DEFAULT_BOOKINGS_QUERY` (params omitted from the URL when they equal the default, keeping URLs clean), and `useBookings.ts`'s `useQuery`+`keepPreviousData`+hand-built `URLSearchParams` fetch against an edge function returning `{ success, data, total }`. `list-bookings/index.ts` is the best precedent for a scoped, paginated list edge function shape — the new `list-public-*` functions follow the same response contract but via `servePublic`, with no auth/scope resolution (public, `status='ACTIVE'` only, no org/property scoping since these are cross-tenant public catalogs).

## Architecture

### 1. Data layer

No new tables are required — everything needed already exists as real columns or `settings`/`app_settings` fields once the smart-search-bar plan's `properties.city` promotion lands. What's needed:

- **Indexes only** (new migration `supabase/migrations/<ts>_public_listing_filter_indexes.sql`): `properties(status, type)`, `properties(status, created_at DESC)` (for `newest`), `app_settings(property_id, weekday_nightly_rate)` (price sort/range facets), `parkings(status, parking_type)`, `parkings(status, tower)`, `developments(status, type)`, `developments(status, created_at DESC)`. Check `mcp__supabase__list_tables`/`get_advisors` for overlapping indexes before adding.
- No FK additions — development price-range facets/sort are computed by joining on `properties.residence_name = developments.name` (the same string-match convention the search-bar plan already uses), not a foreign key, consistent with that plan's explicit non-goal.

### 2. Backend — three new public list edge functions + one shared facet/filter service

- **`supabase/functions/_shared/publicListingFacets.ts`** (new, shared across all three functions): batch-oriented helpers —
  - `batchLoadPropertyPricing(propertyIds)` — single `app_settings.select(...).in('property_id', ids)` query, no `ensurePropertySettings` side effect; properties missing a row fall back to the same defaults `propertyPricing.ts` uses.
  - `batchLoadReviewStats(propertyIds)` — single `guest_reviews` aggregate query (avg rating, count), merged with `app_settings.external_reviews` the same way `publicPropertyService.ts` does per-slug, but batched.
  - `computeAmenityFacet(rows)` — tally raw `settings.enabledAmenities` ids across the filtered working set, mapped through `publicPropertyAmenities.ts`, returning `{ id, label, count }[]`.
  - `computePriceFacet(prices)` → `{ min, max }` over the filtered (not just paginated) working set.
  - These are generic tally/aggregate utilities, reused by `list-public-parkings`/`list-public-developments` with their own field readers.
- **`supabase/functions/list-public-properties/index.ts`** (new, `servePublic`, GET): params `type[], minPrice, maxPrice, bedrooms, amenities[], development, checkIn, checkOut, adults, children, sort, page, pageSize`. Steps: base query (`status='ACTIVE'` + simple column filters) → batch-load pricing + review stats for the candidate set → apply price/bedroom/amenity filters in-memory (these live in `settings`/`app_settings`, not indexable relational columns) → if `checkIn`+`checkOut` present, exclude ids via `availabilityService.ts#loadConflictingPropertyIds()` (reuse, not reimplement) → compute facets over the full filtered set → sort → paginate → return `{ success, data, total, facets }`.
- **`supabase/functions/list-public-developments/index.ts`** (new, `servePublic`, GET): params `type[], city[], minPrice, maxPrice, developer, sort, page, pageSize`. Price range from `settings.priceRangeMin/Max`. No availability filtering (developments stay date-agnostic, per the search-bar plan's non-goal).
- **`supabase/functions/list-public-parkings/index.ts`** (new, `servePublic`, GET): params `locations[] (inside_tower|outside_tower|motorcycle), towers[], minPrice, maxPrice, checkIn, checkOut, sort, page, pageSize`. Mirrors `filterParkingSlots`/`sortParkingSlots` from `parkingSlotFilters.ts` but server-side against the real `parkings` table + `loadParkingPricing`; availability filtering via `availabilityService.ts#loadConflictingParkingIds()`.
- All three registered in `supabase/config.toml` with `verify_jwt = false`, following the `get-public-property`/`get-public-parking` pattern exactly.
- Response DTOs are new lightweight list-item shapes (id/slug/name/type/city/coverImage/price/bedrooms/rating/reviewCount/amenities…) sized to drop directly into the existing `PropertyCard`/`DevelopmentCard`/parking card props — card components need no changes, only their data source does.

### 3. Frontend

- **`ui/src/features/guest/marketing/shared/lib/listingQueryParams.ts`** (new, Phase 0) — generic `parseListingQuery`/`writeListingQueryParams` pair, factored out of the `BookingsListPage.tsx` pattern but vertical-agnostic (each vertical supplies its own typed filter shape + default query + valid-sort allowlist).
- **Per-vertical typed query modules** (Phase 0/1): `properties/lib/propertiesQuery.ts`, `developments/lib/developmentsQuery.ts`, and an extension (not rewrite) of `developments/lib/parkingSlotFilters.ts` (already has `ParkingFilterState`/`DEFAULT_PARKING_FILTERS`/`countActiveParkingFilters`) with a URL-param bridge added.
- **New TanStack Query hooks**: `usePublicProperties.ts` (Phase 1), `usePublicDevelopments.ts` (Phase 2), `usePublicParkings.ts` (Phase 3) — each follows `useBookings.ts`'s shape (`useQuery`+`keepPreviousData`, `URLSearchParams`, `{success,data,total,facets}` unwrap) but with a public anon-key fetch (no JWT/session lookup, no PostgREST fallback branch — that only exists in `useBookings` for the admin-auth failure mode).
- **Filter components become controlled**: `PropertiesFilters.tsx`/`DevelopmentsFilters.tsx`/`ParkingFilters.tsx` drop their internal `useState` and take `value`/`onChange` from the page (sourced from the URL-parsed query). Facet-driven option lists (amenities, price bounds, bedroom counts, cities, developers, towers) come from the `facets` field of the query response instead of the current hardcoded arrays — those constants are deleted outright, not fallback-guarded, per this repo's "no compat shims" convention.
- **Toolbars stay mostly as-is structurally** (native `<select>` sort dropdown, view toggle) but `sortOptions` arrays are trimmed to only fields with real backing (see tables below), and `onSortChange` writes to the URL via the query hook's patch-equivalent instead of local state.
- **List pages** (`PropertiesListPage.tsx`, `DevelopmentsListPage.tsx`, `ParkingsListPage.tsx`) switch from `useState`+client `.sort()` over mock arrays to `useSearchParams()`+the query hook, passing `data`/`facets`/`total`/`isLoading` down; `totalResults` in the toolbar comes from the server `total`, not `array.length`.

## Facet & sort field definitions per vertical

### Properties

| Filter        | Facet shape                               | Backing data                                                         |
| ------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| Property type | `{ type: string; count: number }[]`       | `properties.type`                                                    |
| Price range   | `{ min: number; max: number }`            | `app_settings.weekday_nightly_rate` (batch-loaded)                   |
| Bedrooms      | `{ value: number; count: number }[]`      | `settings.bedrooms`                                                  |
| Amenities     | `{ id: string; label: string; count }[]`  | `settings.enabledAmenities`, mapped via `publicPropertyAmenities.ts` |
| Development   | `{ slug: string; name: string; count }[]` | `properties.residence_name` joined to `developments.name`            |

Sort: `recommended` (default — rating desc, ties by review count), `rating`, `reviews`, `newest` (`properties.created_at DESC`). **No `price-low` / `price-high`** — see § Sort fairness.

**Fairness:** Price sorts were removed so hosts are not pushed into cheapest-first competition. Budget discovery = price-range **filters** only.

### Developments

| Filter           | Facet shape                 | Backing data                      |
| ---------------- | --------------------------- | --------------------------------- |
| Development type | `{ type: string; count }[]` | `developments.type`               |
| City             | `{ city: string; count }[]` | `developments.city` (real column) |
| Price range      | `{ min, max }`              | `settings.priceRangeMin/Max`      |
| Developer        | `{ name: string; count }[]` | `developments.developer_name`     |

Sort: `recommended` (default, `created_at DESC` as the neutral default), `newest`. **`rating` is dropped** — no development-level reviews. **No price sorts** — see § Sort fairness.

### Parking

| Filter                          | Facet shape                                                            | Backing data                                     |
| ------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| Location (inside/outside tower) | `{ location: 'inside_tower'\|'outside_tower'\|'motorcycle'; count }[]` | `parkings.parking_type`                          |
| Tower                           | `{ tower: string; count }[]` (shown only when `inside_tower` selected) | `parkings.tower`                                 |
| Price range                     | `{ min, max }`                                                         | `parkings.rate_per_night` / `loadParkingPricing` |

Sort: `tower` only (default). Price L↔H sorts removed; budget via price-range filter.

## URL param schema

Shareable/bookmarkable, mirroring `BookingsQuery` — defaults are omitted from the URL to keep links clean.

- `/properties?type=&minPrice=&maxPrice=&bedrooms=&amenities=&development=&checkIn=&checkOut=&adults=&children=&sort=&page=&pageSize=` — keeps the existing collapsed `guests`/`adults`+`children` contract `/properties?location=` already uses today, distinct from `/search`'s four-way `adults/children/infants/pets` split.
- `/developments?type=&city=&minPrice=&maxPrice=&developer=&sort=&page=&pageSize=`
- `/parkings?location=&towers=&minPrice=&maxPrice=&checkIn=&checkOut=&sort=&page=&pageSize=` — `location` replaces the legacy single `type` param via a permanent `locationsFromLegacyTypeParam()`-style resolver (kept permanently, not as a shim, since old bookmarked links must keep resolving).

## Phase breakdown

0. **Shared foundation** — `listingQueryParams.ts` (generic URL parse/write helper), confirm/adapt `AdminMultiSelectFilter`/`AdminSingleSelectFilter`/`AdminSortMenu`/`AdminViewToggle` for public styling, `_shared/publicListingFacets.ts` batch-aggregate helpers.
1. **Properties vertical, end-to-end** — index migration, `list-public-properties/index.ts` + `config.toml` registration, `usePublicProperties.ts`, wire `PropertiesFilters.tsx`/`PropertiesToolbar.tsx`/`PropertiesListPage.tsx` to URL state + real facets/sort, delete `mockProperties.ts` usage from the list page (remove the file itself once nothing else imports it).
2. **Developments vertical** — mechanical replication: `list-public-developments/index.ts`, `usePublicDevelopments.ts`, wire `DevelopmentsFilters.tsx`/`DevelopmentsToolbar.tsx`/`DevelopmentsListPage.tsx`, retire `mockDevelopments.ts` (note: `PropertiesFilters.tsx` also currently imports `mockDevelopments` for its "Development" filter option list — that import moves to the facets response instead).
3. **Parking vertical** — `list-public-parkings/index.ts` reusing `filterParkingSlots`/`sortParkingSlots` logic server-side, `usePublicParkings.ts`, wire `ParkingFilters.tsx`/`ParkingToolbar.tsx`/`ParkingsListPage.tsx`, retire `mockParkingSlots.ts`.
4. **`/search` extension** — once the smart-search-bar plan's `/search` route + `search-listings` function exist, layer the same filter/sort URL-param + facet pattern onto `SearchResultsPage.tsx`, reusing Phase 0's shared components and ideally the same per-vertical query/filter modules rather than a fourth bespoke implementation.

## Mock data retirement

Per vertical, once its edge function + wiring lands in that phase, all imports of `mockProperties.ts`/`mockDevelopments.ts`/`mockParkingSlots.ts` from list/toolbar/filter components in that vertical are removed outright — no feature flag, no fallback-to-mock-on-error — consistent with this repo's "no half-finished implementations" convention. Mock files themselves are deleted once nothing imports them (grep for remaining references first, since detail pages or other consumers not in this plan's scope may still use them).

## Explicit non-goals

- No `rating` sort for developments (no backing data).
- No advanced text/location search filter on the browse pages themselves (that's `/search`'s job per the sibling plan — these three pages keep their existing structured filters only).
- No new `developments↔properties` FK.
- No map-view backend changes (view toggle stays client-side).
- No changes to `/search`'s guest-count param convention (`adults/children/infants/pets`) leaking into `/properties`'s existing collapsed `guests`/`adults`+`children` contract.

## Verification plan (no automated test suite exists in this repo)

1. `bun run dev:api` + `curl` each new `list-public-*` function directly per phase: no filters, each filter individually, combined filters, each sort value, a date range known to conflict with existing `guest_submissions` data (confirms exclusion), page 2.
2. `bun run type-check`, `bun run lint`, `bun run build` after each phase.
3. Playwright MCP walkthrough (per the `verify` skill): open sidebar, toggle each filter type, confirm result count updates and URL reflects state, reload the URL directly (bookmark parity), change sort, paginate, mobile bottom-sheet filter flow, empty-result state.
4. `mcp__supabase__get_advisors` after applying the indexes migration.

## Critical files

- `supabase/functions/_shared/availabilityService.ts` — dependency from the search-bar plan; reuse point for date-availability exclusion, do not reimplement conflict logic.
- `supabase/functions/_shared/propertyPricing.ts` — `loadPropertyPricing`'s `ensurePropertySettings` side effect must not be looped per-row in a list endpoint; a new batched `app_settings` read is required (see `_shared/publicListingFacets.ts`, new).
- `ui/src/features/dashboard/bookings/pages/BookingsListPage.tsx` — the `parseQueryFromParams`/`writeQueryToParams`/patch pattern to replicate generically for public listing URL state.
- `ui/src/features/guest/marketing/properties/components/PropertiesFilters.tsx` and `PropertiesToolbar.tsx` — currently fully disconnected from any list state; Phase 1's core wiring target.
- `ui/src/features/guest/marketing/pages/PropertiesListPage.tsx` — currently sorts `mockProperties` client-side with a fake `isNew`-based "newest"; Phase 1's page-level rewrite target and the template for Phases 2-3's `DevelopmentsListPage.tsx`/`ParkingsListPage.tsx`.
