---
stage: done
title: 'Smart Public Search Bar — Implementation Plan'
status: done
tags: [planning, planned-modules]
updated: 2026-08-05
---

# Smart Public Search Bar — Implementation Plan

## Implementation status (2026-08-05)

- [x] Migration `20261005130000_search_indexes.sql` (pg_trgm, `properties.city`, indexes, city sync trigger)
- [x] `_shared/availabilityService.ts`, `publicSearch.ts`, `publicRateLimit.ts`
- [x] `search-suggestions` + `search-listings` edge functions + `config.toml`
- [x] `features/guest/search/` module + `/search` route
- [x] HeroSearch live typeahead + `/search` param cutover (adults/children/infants/pets)
- [x] Local migration apply (`20261002120100` renamed from duplicate timestamp; orphan `20261003*` history cleared locally; `20261005130000_search_indexes` applied)
- [x] Type-check clean for search module (pre-existing unrelated TS errors remain elsewhere)
- [x] Smart intents v1: Nearby geo + concept/expanded fallback (`_shared/searchIntents.ts`)
- [x] Docs: route guide + `guides/testing/smart-search-intents-manual.md`
- [x] Page-aware search: category pages → `/search` + `focus`; typeahead/All reorder; “Search all results” clears focus
- [x] Harden pass: status banner, filter category switch (self-labelling button, no toast), error retry, empty recovery, 44px Search control
- [ ] Playwright walkthrough against live local functions + seeded data (manual QA remaining)
- [ ] Phase 2: LLM/embedding fallback when deterministic expansion returns 0

Compatible with `smart-filters.md`: shared availability helper, city column, filter-ready summary DTOs + totals.

---

## Context

The public marketing site already ships a polished, Airbnb-style "where / when / who" search bar (`HeroSearch.tsx`) with Framer Motion animation and a compact/docked "morph" mode reused across the homepage hero and listing-page headers. But it's a UI shell: "Where" only matches a static hardcoded list of destinations, there's no live typeahead, no real availability filtering for "when," and the listing pages it feeds (`/properties`, `/developments`, `/parkings`) render from **mock data** — there is no public, unauthenticated backend endpoint today that actually searches `properties`, `developments`, or `parkings`. The goal of this effort is to make the search bar **fully functional against real data**: smart live suggestions, real date-availability filtering, guest-capacity filtering, and an elegantly animated dedicated results page — comparable to how Airbnb/Booking.com search behaves.

This plan is scoped deliberately: it wires up **search only**. It does not migrate the existing mock-data listing pages (`/properties`, `/developments`, `/parkings`) to real data, does not add a `developments↔properties` foreign key, and does not add advanced filters (price/amenities/map). Those are explicitly out of scope to keep this shippable.

## Decisions made during brainstorming (do not re-litigate during implementation)

1. **Placement**: search bar lives in both the homepage hero AND a persistent/compact header — reusing the existing morph mechanism already built into `HeroSearch`/`ListingHeroSearch`.
2. **Results surface**: clicking Search navigates to a dedicated, shareable `/search?...` results page (not an in-place content swap).
3. **Availability**: "when" does **real** availability filtering — properties/parkings with a booking conflict in the selected date range are excluded from results, not just captured as a label.
4. **Developments**: first-class, independently searchable/filterable result type on `/search` (own tab + count), not just a typeahead suggestion.
5. **Typeahead suggestion clicks**: clicking a _specific_ property/development/parking suggestion deep-links straight to that item's detail page (`/properties/:slug`, `/developments/:slug`, `/parkings/:slug`). Clicking a plain location string (e.g. "Makati") routes through `/search?where=...`.
6. **Guest params**: `/search` tracks guests as four separate params — `adults`, `children`, `infants`, `pets` — rather than the collapsed single `guests` count `/properties?location=` uses today. This forks `HeroSearch`'s param-building logic based on destination route; the existing `/properties` contract is left untouched.
7. **Rate limiting**: add basic per-IP throttling on `search-suggestions` now (it's the first public endpoint that fires on every keystroke rather than on click), rather than deferring it.

## Current state (verified this session)

- **Frontend**: `ui/src/features/guest/marketing/guest-landing/components/HeroSearch.tsx` (1095 lines) — where/when/who segmented bar, Framer Motion panels, compact/docked morph mode via `morphProgress`/`scrollProgress`. Static destination list lives at the "where" panel (~L977-1018); `selectDestination()` (L705) and `handleSearch()` (L710-726) are the two functions a live-typeahead rework touches — `handleSearch` currently collapses guests into one `guests` param and defaults `redirectTo` to `/properties`. `ListingHeroSearch.tsx` + `ListingScrollSearchContext.tsx` already provide the sticky/compact scroll-morph behavior for listing-page headers — reusable as-is for `/search`. `listingSearchFields.ts` controls route-aware field visibility (e.g. hides "Who" on parking routes) and needs a `/search` case only if its default (`[...HERO_SEARCH_FIELDS]`, i.e. show everything) isn't already correct — it is, so no change needed there.
- **Data**: `properties` (status, max_guests, city only inside jsonb `settings`, no real `city` column today), `developments` (has real `name`/`city`/`location` columns, **no FK to properties/parkings** — grouping today is client-side mock-matching only), `parkings` (real `name`/`residence_name`/`tower`/`slot_label` columns). `guest_submissions` holds **both** property bookings (`property_id`, `check_in_date`/`check_out_date`) and parking bookings (`parking_id`, `parking_check_in_date`/`parking_check_out_date`) — confirmed parking is booked per physical slot nightly, so conflict-checking applies to both entity types via one table.
- **Backend**: only single-entity public detail endpoints exist (`get-public-property`, `get-public-parking`, `get-booked-dates` — single-property date-conflict lookup). No public list/search endpoint exists; the admin `list-properties`/`list-developments`/`list-parkings` are `serveAuthenticated`-gated and org-scoped — wrong tier/shape to reuse. No `pg_trgm` extension enabled anywhere yet. No rate limiting exists on any public function today.
- **Query/caching conventions**: single app-wide `QueryClient` (`ui/src/App.tsx`), per-hook `staleTime` overrides, guest hooks call `fetch()` directly with anon-key headers (`{success,data,error}` shape) — no shared public fetch wrapper exists yet. No `useDebounce` hook exists anywhere. Tailwind already has usable animation keyframes (`fade-in-up`, `scale-in`, `shimmer`) — no new animation dependency needed.

## Architecture

### 1. Data layer — new migration `supabase/migrations/<ts>_search_indexes.sql`

- `CREATE EXTENSION IF NOT EXISTS pg_trgm;` — verify availability on the hosted project via `mcp__supabase__list_extensions` before finalizing.
- Promote `properties.city` to a real column (backfilled from `settings->>'city'`) — the one field every "where" query needs; simpler than jsonb expression indexes. `developments`/`parkings` already have real text columns, no promotion needed there.
- GIN trigram indexes: `properties(name, city, residence_name)`, `developments(name, city, location)`, `parkings(name, residence_name, tower)`.
- Composite indexes on `guest_submissions(property_id, status)` and `guest_submissions(parking_id, status)` (partial, `WHERE ... IS NOT NULL`) to make batch conflict lookups fast.
- Check via `mcp__supabase__list_tables`/`get_advisors` for existing overlapping indexes before adding, and run `get_advisors` again after applying.

### 2. Backend — shared availability helper + two new public edge functions

- **`supabase/functions/_shared/availabilityService.ts`** (new): `loadConflictingPropertyIds()` and `loadConflictingParkingIds()` — batch query `guest_submissions` by an array of ids + date range, excluding `CANCELLED`, using standard half-open range overlap (`existing.checkIn < requested.checkOut && existing.checkOut > requested.checkIn`). Extends the date-parsing logic already in `get-booked-dates/index.ts` to multiple ids at once; `get-booked-dates` itself is left untouched to avoid regressions.
- **`supabase/functions/search-suggestions/index.ts`** (new, `servePublic`, GET): `?q=&limit=8`. Short-circuits empty for `q.length < 2`. Runs parallel `ilike`/`similarity()`-ranked queries (status `ACTIVE` only) across properties/developments/parkings plus a distinct-city "locations" group, each capped (~4 per group). Includes basic per-IP throttling (decision #7) — lightweight in-memory/edge-side limiter, first of its kind in this codebase, documented clearly since it's a new pattern.
- **`supabase/functions/search-listings/index.ts`** (new, `servePublic`, GET): params `where, checkIn, checkOut, adults, children, infants, pets, type(all|properties|developments|parkings), page, pageSize`. Per entity type: filter `status='ACTIVE'`, optional `where` text match, properties-only guest-capacity check (`adults+children ≤ max_guests`, falling back to `settings` maxAdults/maxChildren same as `publicPropertyService.ts` does), optional availability exclusion via `availabilityService` when both dates present (developments stay date-agnostic — they're a catalog, not directly bookable, consistent with no FK). Paginated (`pageSize=12` default) with `count:'exact'` per type for tab badges. Response DTOs are new lightweight _summary_ shapes (id/slug/name/city/coverImage/etc.), lighter than the full detail DTOs, modeled to map cleanly onto the existing `PropertyCard`/`DevelopmentCard`/parking card props.
- Both registered in `supabase/config.toml` with `verify_jwt = false`, following the existing `get-public-*` pattern exactly.

### 3. Frontend

- **`ui/src/hooks/useDebounce.ts`** (new) — generic debounce hook, replacing the only prior ad hoc precedent (inline setTimeout in an admin component).
- **`HeroSearch.tsx` "where" panel rework**: static list stays as the zero-state (before 2 chars typed, matching Airbnb's "recent/popular before typing" pattern); ≥2 chars swaps to live, debounced (250ms), sectioned results (Locations / Developments / Properties / Parkings) via a new `useSearchSuggestions` hook. Loading = skeleton rows (existing `shimmer` keyframe). Empty = "no matches, search anyway" affordance (free-text fallback, never hard-blocks). Keyboard nav (Up/Down/Enter) extends the existing `onKeyDown`. Selecting a specific entity deep-links (decision #5); selecting a plain location fills `where` and stays in the bar. This is a content-only change to the existing panel — the Framer Motion open/close mechanics are untouched.
- **New module `ui/src/features/guest/search/`** (per the standard `features/guest/{module}/` convention): `components/` (`SearchResultsHeader`, `SearchResultsTabs`, `SearchResultsGrid`, `SearchEmptyState`, `SearchResultsSkeleton`), `hooks/` (`useSearchSuggestions`, `useSearchListings` — TanStack Query, `keepPreviousData` for smooth pagination), `lib/` (`publicSearchFetch.ts` — small shared fetch+anon-key+unwrap helper local to this feature; `searchParams.ts` — typed URL param parse/build), `pages/SearchResultsPage.tsx`, `types/search.ts`.
- **New route** `/search` registered in `ui/src/features/guest/marketing/routes/index.tsx` alongside the existing `properties`/`developments`/`parkings` routes, param-driven (no `/search/in/:location` variant needed).
- **`SearchResultsPage`**: sticky compact search bar on top (reuse `ListingHeroSearch`), tabs with live per-type counts, animated staggered grid (Framer Motion, `useReducedMotion()`-gated) reusing the **existing** `PropertyCard`/`DevelopmentCard`/parking card components (map summary DTOs onto their existing props — no new card components), skeleton loading, empty state, classic pagination (not infinite scroll, so `page=` stays part of the shareable URL).
- **`HeroSearch` param cutover**: once `/search` is functional, change the default `redirectTo` from `/properties` to `/search`, and fork `buildSearchValues`/`handleSearch` to emit separate `adults/children/infants/pets` params specifically when targeting `/search` (decision #6) — `/properties`'s existing collapsed `guests` contract is left untouched.

## Phase breakdown

1. **Backend foundation** — migration (indexes/extension/city column), `availabilityService.ts`, both new edge functions + config.toml registration + per-IP throttle, manual `curl` verification via `bun run dev:api`.
2. **Live typeahead** — `useDebounce`, `useSearchSuggestions`, `HeroSearch` where-panel rework (sectioned results, keyboard nav, deep-link vs `/search` routing), verified in both hero and docked/compact variants.
3. **`/search` results page** — route + `features/guest/search/` module, `useSearchListings`, tabs/counts/animated grid/pagination reusing existing cards, then the `HeroSearch` `redirectTo`/param cutover.
4. **Polish** — empty/no-results copy, reduced-motion handling, edge cases (typo'd location, zero-availability date range, guest count exceeding all inventory), final advisor check, type-check/lint/build.

## Explicit non-goals

- No `developments ↔ properties/parkings` FK migration (string/slug matching stays as-is).
- No price/amenity advanced filters, no map view on `/search`.
- No admin-side changes.
- No migration of `/properties`, `/developments`, `/parkings` listing pages off mock data — only `/search` gets real data.
- No client-side fuzzy-search library (`fuse.js`/`cmdk`) — `pg_trgm` handles matching server-side.
- No infinite scroll (classic pagination keeps URLs shareable).
- No development-level date-availability (developments remain catalog-only/date-agnostic).

## Verification plan (no automated test suite exists in this repo)

1. `bun run dev:api` + `curl` both new endpoints directly: empty query, 2-char query, full where+when+who combo, a date range known to conflict with existing `guest_submissions` data — confirm DTO shapes, `ACTIVE`-only filtering, and that conflicting properties/parkings are actually excluded.
2. `bun run type-check`, `bun run lint`, `bun run build`.
3. Playwright MCP walkthrough (per the `verify` skill): homepage hero typeahead, docked/compact header typeahead (scroll to trigger morph), full search submission → `/search`, tab switching with counts, pagination, direct navigation to a `/search?where=...&checkIn=...` URL (confirms shareable-URL parity), empty state, `prefers-reduced-motion` emulation on the results grid.
4. `mcp__supabase__get_advisors` after applying the migration.

## Critical files

- `ui/src/features/guest/marketing/guest-landing/components/HeroSearch.tsx` — where-panel rework, `redirectTo`/param cutover
- `supabase/functions/_shared/availabilityService.ts` (new) — batch conflict-check helper
- `supabase/functions/search-suggestions/index.ts`, `supabase/functions/search-listings/index.ts` (new)
- `supabase/migrations/<timestamp>_search_indexes.sql` (new)
- `ui/src/features/guest/search/pages/SearchResultsPage.tsx` (new) — composes existing `PropertyCard`/`DevelopmentCard`/parking cards
- `ui/src/features/guest/marketing/shared/lib/listingSearchFields.ts` — confirm `/search` default field set needs no change
