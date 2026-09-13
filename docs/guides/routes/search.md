---
title: 'Search results — operator guide'
status: active
tags: [guides, routes, public, search]
updated: 2026-08-17
---

# Search results — operator guide

Route: `/search`

> **Status:** Documented — live typeahead + smart intents + page-aware category focus + `/search` results; **smart filters / sort / view mode** match browse listing chrome on category tabs.

## Progress overview

| Section          | E2E save | Validation | Docs       | Notes                                                     |
| ---------------- | -------- | ---------- | ---------- | --------------------------------------------------------- |
| Typeahead        | N/A      | Live       | Documented | Debounced `search-suggestions`; max 3/group + **See all** |
| Sample fixtures  | N/A      | Local      | Documented | Seed `azure` inventory — see testing guide                |
| Results page     | N/A      | Live       | Documented | Grouped All view; smart tabs (hide empty)                 |
| Page-aware bar   | N/A      | Live       | Documented | Category pages prefer that family via `focus`             |
| Smart intents    | N/A      | Live       | Documented | Nearby geo + concept expansion; AI fallback later         |
| Shareable URL    | N/A      | Live       | Documented | `where` + dates + guests + optional `lat`/`lng`/`focus`   |
| Category filters | N/A      | Live       | Documented | Facet sidebar via `list-public-*` on category tabs        |
| Sort / view      | N/A      | Live       | Documented | Toolbar: sort (category tabs) + grid/list (+ map props)   |

Manual scenario checklist: **[[guides/testing/smart-search-intents-manual]]**.

---

## Overview

Public guests search from the homepage hero (or compact header) and land on a dedicated `/search` page with properties, developments, and parkings. Date ranges exclude booked/blocked inventory. Guest capacity filters properties only.

The same search bar works on **every marketing page that shows it** (home, Properties, Developments, Parkings, Services, `/search`, location browse, development detail). Submit always goes to unified `/search` — never the old category shell query (`/properties?location=…`).

**Where prefill:** category indexes (`/developments`, `/properties`, `/parkings`, `/services`, `/search`) leave **Where** empty — never the nav label. Location browse prefills the city/place; development detail / nested property & parking pages prefill the development name (`listingSearchDefaultLocation.ts`).

**Where placeholder:** category trees use a family-specific hint — **Search developments** / **Search properties** / **Search parkings** / **Search services**; home and `/search` keep **Search destinations** (`listingSearchFields.ts`).

When the guest is already on a **categorized listing page**, search is **page-aware**: matching results still include all families, but the origin category is **prioritized** (typeahead section order + All-view sections/tabs). Choosing **Search all results for “…”** clears that preference and opens the unprioritized all-results view.

The search bar understands **intent**, not only exact text:

| Guest types…                                   | System does…                                                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Nearby** / near me / **Nearby developments** | Requests browser location; ranks listings by distance within ~120 km; category suffix (or page `focus`) scopes the results family |
| Common nouns (condo, beach, parking)           | Expands to type + related place/amenity terms                                                                                     |
| Specific names (Kame, Makati, Azure)           | Literal trigram / contains match                                                                                                  |
| Literal with 0 hits + a common token           | Soft **expanded** fallback once (deterministic synonyms — not LLM yet)                                                            |

---

## Host-facing knowledge

Guests can search by place name, city, listing title, **Nearby**, or everyday words like condo / beach. Nearby uses the guest’s phone location when they allow it. Specific names still match exact listings.

**Common host questions**

- Q: Will my listing show up in search?
  A: Yes when the listing is active and matches the guest’s place text (or Nearby distance / type concepts). If they pick dates that overlap an existing booking (or a blocked period on a property), it will be hidden for that search.
- Q: Do developments care about dates?
  A: No, developments are shown as catalog results regardless of dates. Individual units and parking slots still respect availability.
- Q: Does Nearby need my address on the listing?
  A: Map pin coordinates in property/parking settings (`latitude` / `longitude`) improve Nearby ranking. Azure North listings can fall back to the residence default pin when unset.

---

## Behavior

### Hero / compact search bar

- Works on homepage **and** every listing page that mounts the bar (`/properties`, `/developments`, `/parkings`, `/services`, `/search`, `/…/in/:location`, development detail / nested parking).
- Zero-state (under 2 characters): on home — suggested destinations (includes **Nearby**); on category pages — **Suggested developments / properties / parkings** with **Nearby {category}** first, then recommended listings from `list-public-*`.
- Choosing **Nearby** / **Nearby developments** (chip or typed phrase) requests geolocation, then opens `/search?where=Nearby%20developments&type=developments&focus=developments&lat=…&lng=…` (category pages scope to that family; home stays unscoped `where=Nearby`).
- Live typeahead (≥2 characters, 250ms debounce): Locations first, then listing families — only groups with hits. On a category page, that family is listed **immediately after Locations**. Each group shows at most **3** matches; when there are 3+, a header **See all** opens `/search?where=…&type=<category>&focus=<category>` (Locations → All without `type`). Nearby phrases return a single location chip labeled **Nearby** or **Nearby {category}**.
- **Concept nouns** (condo, beaches, mountain, parking, …): typeahead returns an **Ideas** chip (e.g. **Condos · Browse condo stays**) plus listing previews — hard property-type matches first, then synonym/place fill. Selecting the chip opens `/search?where=Condos` (concept mode). Never shows a false **No matches** when a concept is recognized.
- Entity suggestion → detail route (`/properties/:slug`, `/developments/:slug`, `/parkings/:slug`).
- Magnifying-glass Search (or Enter with no highlighted suggestion) → `/search?where=…` (+ dates/guests). From a category page, also sets `focus=<category>` so All view / tabs prioritize that family.
- **Search all results for “…”** (typeahead footer / empty state) → same `/search` URL **without** `focus` (true cross-category all results).
- Exception: pages that pass a local `onSearch` (e.g. development parking slot list) keep in-page filtering for the main Search button; **Search all results** still navigates to unified `/search`.
- Keyboard: Up/Down/Enter on live suggestions; Escape closes the panel.

### Page-aware category focus

| Origin page                                   | `focus` on Search submit | Typeahead / All order                                                                                             |
| --------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `/` (home), `/services`, `/search`            | omitted                  | Default: Locations → Developments → Properties → Parkings (typeahead); Properties → Developments → Parkings (All) |
| `/properties`, `/properties/in/…`             | `properties`             | Properties elevated after Locations                                                                               |
| `/developments`, `/developments/…`            | `developments`           | Developments elevated                                                                                             |
| `/parkings`, `/parkings/in/…`, nested parking | `parkings`               | Parkings elevated                                                                                                 |

`focus` **does not hide** other categories — it only reorders. Hard filter remains `type=properties|developments|parkings`.

Helpers: `listingSearchPreferType.ts`, `listingScrollSearchPaths.ts` (`resolveListingSearchPreferType`).

### `/search` results

- Hero search under the fixed marketing nav — same morph pattern as `/properties` (anchor spacer + portaled bar; no second sticky search chrome).
- **Grouped by category:** every result section shows its category label + count (e.g. **Properties 1** for “kame”) — including single-category searches. Empty categories stay hidden.
- On All: **See all** opens that category when there are more than the preview page.
- **Status banner:** when `focus` or smart intent applies, a short line explains it (e.g. “Developments shown first · Near you”) with **Show all equally** to clear `focus`.
- **Smart tabs:** only categories with `totals.* > 0` appear. **All** shows when 2+ categories match. A single matching category skips the tab strip but still shows the category heading above the cards. Tab counts always come from an **All-scoped** `search-listings` fetch so switching to Properties / Developments / Parkings (or opening Filters) does **not** hide sibling pills.
- **Toolbar** (always on when results exist, and always on in map view): result count, **Filters** toggle, **sort** (category tabs only), **view mode** (grid / list / **map** on Properties, Developments, and Parkings tabs — not on All). Map uses Google Maps with price/name pins; pan/zoom **automatically** scopes via `swLat`/`swLng`/`neLat`/`neLng` after the map settles (capped markers) — see **Map view** below. In map view, category-tab facets update from the **visible map pool** (before categorical filters). Sort is always visible (including mobile toolbar) and also in the mobile Filters & Sort sheet.
- **Mobile toolbar layout:** below `sm` the toolbar stacks into two rows — result count on top, sort + view-mode controls on a second right-aligned row — so the count is never clipped by the control cluster on narrow screens.
- **Mobile Filters & Sort sheet:** the bottom sheet is a flex column (`z-[100]`/`z-[101]`, above the scroll-morph search bar), with a fixed header and a fixed footer that holds **Show results** and **Clear all**; only the middle list scrolls, and the footer keeps a safe-area inset so it stays reachable on short viewports.
- **Sort fairness:** **Price: Low to High / High to Low are not offered** (removed to avoid race-to-bottom host pricing). Properties / Developments default to **Recommended**; budget guests use price-range filters. Full decision: **`docs/workflow/done/smart-filters.md`** § Sort fairness.
- **Smart filters:** on a Properties / Developments / Parkings tab, the same facet sidebar as `/properties`, `/developments`, `/parkings` — driven by `list-public-*` facets for the current search scope. Facets always describe the set the guest is actually looking at (on map view: what’s in the viewport). Filter params use `propertyType` / `devType` (not search `type`) plus `sort`, price, amenities, etc.
- **Nearby keeps its results in filters:** for a Nearby search the category request sends `lat`/`lng` and an **empty `where`** — "Nearby" is never passed as place text, which would ilike-match nothing and empty the tab. `searchFilterParams.ts` strips it; `list-public-*` scope by the same 120 km radius as `search-listings`, so tab totals match the All tab.
- **Concept nouns bridge the same way:** Condos / Houses / Hotels / Parking strip the concept label from `where` and apply a hard `type` filter (or parkings family) on `list-public-*`. Synonym-only concepts (Beaches, Mountains, Cities) stay on `search-listings` — bridging with an empty `where` would incorrectly list everything.
- **The phrase is the constraint:** `Nearby properties`, `Nearby developments`, and `Nearby parkings` infer their category on both the client URL parser and `search-listings`, even if a pasted URL omitted `type`. A scoped category remains selected when its count is zero; Cebu/Palawan therefore show a truthful empty state for that category instead of silently changing to All.
- **No stale empty flash:** previous-query placeholder data is treated as loading during a phrase/location/category change. It cannot rewrite the URL or briefly display old zero totals while the current geo request is still in flight.
- **Applied chips:** dismissible chips under the toolbar on category tabs; filtered empty state offers **Clear filters**.
- On **All** there is no shared sidebar (each category filters on its own schema), so the button **names the category it opens** — “Filter properties” — and switching is silent: the tab strip and sidebar are the feedback. **No toast.** Target is `focus` when populated, else the densest tab. Category tab changes push history so Back works. Opening Filters (or a category pill) keeps the **All / Properties / Developments / Parkings** strip visible so guests can toggle families without closing the sidebar.
- **Errors / empty:** failed fetch shows **Try again**; empty offers **Search nearby**, clear place, clear dates; wires expansion note when soft fallback was tried.
- Locations are a typeahead group only — on `/search` they become the `where` text filter, not a fourth card grid.
- Cards reuse Property / Development / Parking components; amenity chips show human labels (not raw ids).
- Pagination (`page` in URL) only on a single-category tab. All is a first-page preview per category.
- Compact Search control stays ≥ **44×44** touch target.

### Map view

Shared component: `features/guest/marketing/shared/components/ListingMapView.tsx`. Same contract on `/properties` and `/developments`.

- **The guest owns the viewport.** Bounds are written to the URL only after a guest gesture (drag, wheel, double-click, keyboard, zoom buttons) settles. Programmatic framing never writes bounds, so opening map view on a fresh search leaves the URL clean and one gesture produces exactly one refetch.
- **The map instance outlives every fetch.** It is created once per mount and reads live props through refs; a refetch, an empty result set, or a fetch error can never remount it. Loading shows as a spinner in the count badge, and an area with no matches shows an overlay card with **Reset area** — the map itself stays on screen with its tiles and camera intact. Unmounting it mid-interaction was the cause of the pan/zoom reset loop fixed on 2026-08-06.
- **Framing rules:** URL bounds win over the result set. With no bounds, the map fits all located markers (single marker or an over-tight fit falls back to zoom 15); with no located markers at all, it falls back to the Philippines overview rather than coordinates 0,0.
- **Deep links are clamped.** Bounds tighter than zoom **17** carry no map detail, so the map opens at 17 and publishes the corrected bounds once — the listing set and the visible area always describe the same place. A pasted link with a metre-wide box therefore renders a usable neighbourhood instead of blank canvas.
- **Pins:** clustering buckets markers into fixed screen-pixel cells using the zoom-independent world projection, so panning never reshuffles clusters — only a zoom change does. Pins render through a React portal into one `OverlayView` and move by transform, so a data change never tears down the pin DOM. A cluster click zooms to fit its listings; listings that **share an address** can never be separated by zoom, so those open as a scrollable list card instead of a dead zoom-in.
- **Reset area** (badge row, and in the empty-area overlay) drops the bounds params and re-frames on the full result set.

### Performance (Phase 1)

`search-listings` and `list-public-*` return **one page of card payloads**. Totals and facets still describe the **full filtered lean set**. Display-only enrichment (superhost, reviews when not sorting by rating, development `propertyCount`, property pricing on `search-listings`) loads for **page ids only**.

`search-listings` and the three `list-public-*` endpoints read lean candidates in deterministic 1,000-row PostgREST ranges, replacing the silent ~500/~2,000-row truncation. Each family fails closed above the documented **20,000-row safety ceiling** rather than return dishonest totals/facets. Scoped search pages and All previews therefore use exact family totals within that ceiling.

### Smart intents (v1 — deterministic)

Shared resolver: `_shared/searchIntents.ts` (UI mirror: `features/guest/search/lib/searchIntents.ts`).

1. **Nearby** — phrases like nearby, near me, around me, close by, in my area. Uses `lat`/`lng`. Ranks by haversine; default radius **120 km**. Response `meta.needsLocation` when coords missing.
2. **Concept** — condo/apartment → `CONDO` type + related terms; beach/beaches → beach destinations & coastal terms; house/villa; parking; hotel/resort; mountain; city/metro. Matched from whole query or short (≤3 word) queries.
3. **Literal** — everything else (specific names / places).
4. **Expanded fallback** — if literal returns 0 hits, try one concept token from the query; `meta.usedSmartFallback: true`, `meta.intent: 'expanded'`.

**Phase 2 (not shipped):** LLM / embedding rewrite when deterministic expansion still returns 0 — keep latency out of typeahead; only on `/search` submit.

### URL params

| Param                                 | Notes                                                                                                                                                                                                                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `where`                               | Free text (alias: legacy `location`)                                                                                                                                                                                                                                                         |
| `checkIn` / `checkOut`                | `YYYY-MM-DD`; both required for availability filter                                                                                                                                                                                                                                          |
| `adults` / `children` / `pets`        | Guest split for search (no infants — uncommon for listing search). Capacity uses adults+children. Legacy `infants` URL param is ignored.                                                                                                                                                     |
| `type`                                | `all` (default) \| `properties` \| `developments` \| `parkings`                                                                                                                                                                                                                              |
| `focus`                               | Optional origin preference: `properties` \| `developments` \| `parkings` — reorders All sections/tabs; omitted by “Search all results”                                                                                                                                                       |
| `page` / `pageSize`                   | Defaults 1 / 12                                                                                                                                                                                                                                                                              |
| `lat` / `lng`                         | Guest WGS84 coords for Nearby ranking; also forwarded to `list-public-*` on category tabs so their results and facets stay within the same radius                                                                                                                                            |
| `swLat` / `swLng` / `neLat` / `neLng` | Map viewport after a guest pan/zoom settles — `list-public-*` returns capped in-bounds markers (`mapMode`); classic `page` paused while set. **All four are required**; a partial, out-of-range, or zero-area box is ignored and the result set frames the map (`parseBboxFromSearchParams`) |
| `view`                                | Optional `list` \| `map` on `/properties` (and search toolbar state)                                                                                                                                                                                                                         |
| `propertyType` / `devType`            | Category-tab filters only (avoids colliding with search `type`)                                                                                                                                                                                                                              |
| `minPrice` / `maxPrice` / …           | Same facet filters as browse pages when a single category tab is active (`amenities`, `bedrooms`, `development`, `city`, `developer`, `location`, `towers`, `sort`)                                                                                                                          |

Defaults are omitted from the URL for clean sharing. `/properties` keeps its existing collapsed `guests` contract — do not mix the two.

---

## API / edge functions

| Function             | Role                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `search-suggestions` | Typeahead groups + Nearby chip + concept chips + per-IP rate limit |
| `search-listings`    | Paginated results + totals + availability + `meta` intent payload  |

Shared: `_shared/availabilityService.ts`, `_shared/publicSearch.ts`, `_shared/publicRateLimit.ts`, `_shared/searchIntents.ts`, `_shared/publicGeoScope.ts` (radius + map bbox scoping reused by `list-public-*`). List/search summaries include `latitude`/`longitude` for map pins.

`search-listings` response includes:

```ts
meta: {
  intent: 'nearby' | 'concept' | 'literal' | 'expanded',
  intentLabel: string | null,
  needsLocation: boolean,
  usedSmartFallback: boolean,
  conceptId: string | null,
}
```

---

## Data / indexes

Migration `20261005130000_search_indexes.sql`:

- `pg_trgm` + trigram indexes on searchable text columns
- `properties.city` column (backfill + trigger from `settings.city`)
- Partial indexes for batch conflict lookups

Nearby ranking reads `settings.latitude` / `settings.longitude` (Azure North default pin when residence matches and coords unset).

---

## Compatibility with smart-filters

`/search` category tabs reuse the same facet sidebars, `sort` URL param, and browse toolbar patterns via `list-public-*` + `searchFilterParams.ts`. All view stays on `search-listings` (preview + tabs); Filters from All switches to a category so facets have a real working set.

Both layers must agree on what the guest is looking at. Availability helpers are shared — do not reimplement conflict logic in `list-public-*`. The same rule holds for intents: Nearby travels as `lat`/`lng` through `_shared/publicGeoScope.ts`, never as `where` text; hard-type concepts (Condos / Houses / Hotels / Parking) strip the concept label and apply `type` (or parkings family) on `list-public-*`; synonym-only concepts stay on `search-listings` so an empty `where` cannot accidentally list everything.

---

## Implementation map

| Layer         | Path                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Page          | `ui/src/features/guest/search/pages/SearchResultsPage.tsx`                                                                           |
| Toolbar       | `ui/.../search/components/SearchResultsToolbar.tsx`                                                                                  |
| Grid/views    | `ui/.../search/components/SearchResultsGrid.tsx`                                                                                     |
| Filter bridge | `ui/.../search/lib/searchFilterParams.ts`                                                                                            |
| Intents       | `ui/.../search/lib/searchIntents.ts`, `geolocation.ts`                                                                               |
| Params        | `ui/.../search/lib/searchParams.ts` (`focus` + `buildSearchHref`)                                                                    |
| Page focus    | `ui/.../marketing/shared/lib/listingSearchPreferType.ts`, `listingScrollSearchPaths.ts`                                              |
| Hooks         | `ui/src/features/guest/search/hooks/useSearchSuggestions.ts`, `useSearchListings.ts` (All-scoped overview + optional category fetch) |
| Hero          | `ui/src/features/guest/marketing/guest-landing/components/HeroSearch.tsx`                                                            |
| Edge          | `supabase/functions/search-suggestions/`, `search-listings/`, `list-public-*`                                                        |
| Migration     | `supabase/migrations/20261005130000_search_indexes.sql`                                                                              |
| Manual QA     | `docs/guides/testing/smart-search-intents-manual.md`                                                                                 |

---

## Testing

| Layer | Path / spec                                                                      | Manual                                               |
| ----- | -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Unit  | `ui/src/features/guest/search/lib/searchIntents.test.ts`                         | —                                                    |
| E2E   | `ui/e2e/features/public/publicPagesSmoke.spec.ts` search page (`@smoke` / `@ci`) | Geolocation Nearby, full intent matrix               |
| N/A   | —                                                                                | `docs/guides/testing/smart-search-intents-manual.md` |
