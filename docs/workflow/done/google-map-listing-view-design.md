---
title: Google Map listing view
status: done
stage: done
tags: [workflow, done, search, marketing, maps, performance]
updated: 2026-08-06
---

**Shipped (2026-08-06):** [`google-map-listing-view.md`](./google-map-listing-view.md). Viewport uses debounced idle → bbox in URL (no explicit “Search this area” button).

# Google Map listing view

## Problem _(historical — shipped 2026-08-06)_

Map toggles existed on `/properties` and `/search`, but the map was a **decorative placeholder** with mock coordinates. **Resolved:** shared `ListingMapView` + real coords from `list-public-*`. See [`google-map-listing-view.md`](./google-map-listing-view.md).

## Decisions (approved)

1. **Surfaces (v1):** **B** — public property lists (`/properties`, location/dev property grids) **and** `/search` for **properties, developments, and parkings** category tabs. Dedicated `/developments` / `/parkings` index map toggles can reuse the same component later; not required for v1 if search covers those families.
2. **Data model:** **A + C hybrid**
   - **Initial open:** pins = **current page** rows (same filters/sort/`page`/`pageSize` as grid/list).
   - **After pan/zoom + confirm:** **viewport (`bbox`) query** returns marker-lite rows for the visible bounds (capped), so map browse scales without loading every match.
3. **Pan behavior:** **A** — map takes over discovery. Toolbar count reflects **in-bounds** total after a viewport search. Classic `page` is paused while `bbox` is active; leaving map or clearing the area restores page-synced mode.
4. **Confirm control:** Explicit **Search this area** after the map moves (not refetch on every drag). Idle auto-search is out of scope for v1.
5. **Layout:** Full-bleed map under the existing toolbar (mock reference). No persistent split list panel in v1. Selection opens a **floating preview card** (existing `PropertiesMap` pattern, real data).
6. **Pagination alignment:** Respect [`listing-search-pagination-design.md`](./listing-search-pagination-design.md) — page mode returns one page; map bbox mode never returns the full catalog. Marker responses are **lite** (coords + label + price/slug + cover).
7. **Missing coordinates:** Omit from pins; badge may show “N with location” when some page rows lack coords. Do not invent random positions.
8. **URL:** Persist `view=map`. When viewport mode is active, persist `bbox` (or `swLat`/`swLng`/`neLat`/`neLng`). Clearing bbox restores page mode.

## Job and audience

Guests finding a stay / development / parking by place. Success = smooth map, honest counts, same filters as grid, no lag with large inventories.

Visitor mode: **Operate** (find and open a listing).

## Approaches considered

| Approach                   | Summary                                   | Trade-off                                             |
| -------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| **1. Page pins only**      | Map = current page markers                | Simple; useless for geographic browse beyond one page |
| **2. Viewport-only**       | Always bbox; ignore page                  | Strong map UX; weaker share of “page 2 of search”     |
| **3. Hybrid A+C (chosen)** | Page on open; bbox after Search this area | Matches grid contract + scales; one extra mental mode |

**Recommendation:** Approach **3**.

## Architecture

```text
Toolbar (grid | list | map) + filters + sort
        │
        ├─ view≠map → existing grid/list + classic pager
        │
        └─ view=map
              │
              ├─ no bbox → pins from current page rows (need lat/lng on list DTOs)
              │              fitBounds to pins; Show “Search this area” after move
              │
              └─ bbox set → GET list-public-* | search-listings
                             ?bbox=…&mode=map (or equivalent)
                             → { markers[], totalInBounds, pageSizeCap }
                             → cluster + price/name pins + preview card
```

### Server

1. **List/search DTOs:** Add `latitude` / `longitude` (nullable) on page rows for properties, developments, parkings (reuse `resolveListingCoords` / table columns).
2. **Bbox mode:** Accept `swLat`, `swLng`, `neLat`, `neLng` (or single `bbox`). Filter to markers inside bounds **after** the same filter/intent/availability pipeline used by list (or push into SQL when pagination work lands). Return:
   - `data` / `markers`: lite objects, **hard cap** (e.g. 200; prefer densest-first or rating-first within cap)
   - `total`: count in bounds (for badge; may exceed cap)
   - Skip heavy facets on map-only requests when possible; keep filter params applied.
3. **Geo scale path:** Prefer filtering by coords before full enrichment. Coordinate extraction stays shared (`publicGeoScope`). True PostGIS/GIST is a follow-up if JSONB settings remain the source of truth — until then, lean filter + bbox + cap is the production contract (paired with pagination Phase 1 enrich-page).

### Client

1. Shared **`ListingMapView`** (Google Maps JS via existing `useGoogleMapsLoader`):
   - Custom HTML price/name pins (AdvancedMarker or OverlayView)
   - Marker clustering when many pins / low zoom
   - Zoom controls; count badge; Search this area; selected preview card
   - Dynamic import so Maps JS is not on the critical path for grid mode
2. Wire **`PropertiesMap`** → real component (delete mock coords).
3. **`SearchResultsToolbar`:** expose map for developments + parkings (not only properties). `/search` All tab: map disabled or maps active category — **map only when a single family tab is selected**.
4. Performance: debounce move detection; cluster; lite payloads; unmount map when leaving view; respect `prefers-reduced-motion` on pin entrance only.

### Marker labels

| Family      | Pin label                                                 |
| ----------- | --------------------------------------------------------- |
| Property    | Short price (`₱3k`) when price known; else name truncated |
| Development | Min price or name                                         |
| Parking     | Rate per night or name                                    |

### Preview card

Tap pin → bottom/side card with cover, title, location, primary metric, link to detail. Close clears selection.

## Error / empty / loading

- No API key: short error in map well (existing loader message pattern); grid/list still work.
- Zero pins on page: empty map + fit PH default / last search center; keep filters.
- Bbox returns 0: empty state in badge (“0 in this area”); keep Search this area.
- Load failure: retry affordance; do not leave a broken map without message.

## Out of scope (v1)

- Split list+map desktop layout
- Auto-search on every pan without button
- Drawing tools / polygon search
- Directions / Street View
- Map on `/search` All tab (mixed families)
- Dedicated developments/parkings index map toggle (optional follow-up; shared component ready)
- PostGIS migration (follow-up if needed)

## Testing

- Manual: `/properties` map — real pins for seeded coords; click → detail.
- `/search?type=properties|developments|parkings` + map; filters still apply.
- Pan → Search this area → count updates; URL has bbox; clear/back to grid restores pager.
- Missing lat/lng rows omitted; no random scatter.
- 200+ markers: clustering, no multi-second jank on pan.
- Mobile 375px: floating card usable; 44px targets on controls.

## Implementation map (indicative)

| Area          | Paths                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Shared map UI | `ui/src/features/guest/marketing/shared/components/ListingMapView.tsx` (+ pin/cluster helpers) |
| Properties    | Replace `PropertiesMap.tsx`; list pages already toggle map                                     |
| Search        | `SearchResultsPage`, `SearchResultsToolbar`, grid map branch                                   |
| Edge          | `list-public-*`, `search-listings`, `_shared/publicGeoScope.ts` (bbox helpers)                 |
| Docs          | Route guides search/properties; `docs/PROJECT.md` query params                                 |

## Anti-goals

- Loading thousands of full card DTOs onto the map
- Refetching on every `idle` without user intent
- Fake coordinates for rows without location
- New map SDK (Mapbox) — use existing Google Maps stack
