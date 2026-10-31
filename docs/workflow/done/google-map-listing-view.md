---
stage: done
title: 'Google Map listing view — Implementation Plan'
status: done
tags: [planning, search, marketing, maps]
updated: 2026-08-06
---

# Google Map listing view — Implementation Plan

> **Spec:** [`google-map-listing-view-design.md`](./google-map-listing-view-design.md). Aligns with [`listing-search-pagination-design.md`](./listing-search-pagination-design.md) page/bbox contract.

**Status (2026-08-06):** **Shipped (v1).** Shared `ListingMapView` + real Google Maps pins on property/development list pages and `/search` category tabs (properties, developments, parkings). Map mode uses `list-public-*` with `readMapBbox` / capped in-bounds markers. Route guides updated (`search.md`, `properties.md`, `developments.md`).

**Implementation notes vs spec:**

- Viewport refetch uses **debounced map idle → auto bbox in URL** (not an explicit “Search this area” button). Route guides document this behavior.
- Category-tab map on `/search` calls **`list-public-*`** (not `search-listings` bbox params) — same filters/facets as grid mode.
- **`/parkings` index** has no map toggle (optional follow-up per spec); parkings map works on `/search?type=parkings`.

**Post-ship hardening (2026-08-06)** — map view on `/search` reset itself on every pan/zoom and eventually stopped rendering. Two independent defects:

1. **Remount loop.** `SearchResultsPage` mounted the map only inside its `showResults` branch, so a gesture → bounds in URL → refetch → skeleton/empty state tore the map down and a fresh instance came back at the default camera, which framed and refetched again. Fixed by keeping the map mounted across every fetch state (spinner in the count badge, overlay card for an empty area) and by making the map instance create-once, reading live props through refs.
2. **Null island.** `parseBboxFromSearchParams` read absent params with `Number(sp.get(…))`, and `Number(null)` is `0` — so a URL with no bounds parsed as a valid zero-area box at 0,0 and the camera flew to the Gulf of Guinea. Now all four params must be present, in range, and describe a non-empty box; `ListingMapView` also refuses to fit an empty `LatLngBounds`.

Also landed with the fix: bounds are published only after a real guest gesture (never for programmatic framing), deep-linked bounds tighter than zoom 17 are clamped and rebroadcast once, and pins that share an address open as a list card instead of an endless zoom-in. Behavior is documented in `docs/guides/routes/search.md` § Map view.

**Goal:** Replace the mock map with production Google Maps pins on property lists and `/search` category tabs, with page-synced pins plus bbox for scale.

**Architecture:** Shared `ListingMapView` (Google Maps JS + clustering + preview card). List APIs expose lat/lng on page rows and accept bbox for marker-lite responses (hard cap). URL `view=map` + optional bbox params.

---

## Task 1: Geo bbox helpers + lat/lng on list responses

- [x] Add `readMapBbox(sp)` and bbox filter helpers in `publicGeoScope.ts`
- [x] Include `latitude`/`longitude` on mapped page rows for all three `list-public-*`
- [x] When bbox present: return marker-lite page (cap 200), `total` = in-bounds count; map-mode facets from visible pool
- [x] Local curl verified with and without bbox

## Task 2: search-listings parity

- [x] Category-tab map uses `list-public-*` with search-scoped filters (not `search-listings` bbox — acceptable v1 shortcut)
- [ ] Optional follow-up: `search-listings` native bbox when type is single family

## Task 3: ListingMapView UI

- [x] Build shared map: load Maps, pins, cluster, preview card, empty/error, count badge
- [x] Replace mock `PropertiesMap` → thin wrapper over `ListingMapView`
- [x] Wire property + development list pages (`view=map` in URL)

## Task 4: Search page wiring

- [x] Enable map mode for developments + parkings in search toolbar
- [x] Persist `view` + bbox in search URL; pager paused when bbox set
- [x] Map skeleton / empty states

## Task 5: Docs + smoke

- [x] Update `docs/guides/routes/search.md`, properties guide, developments guide
- [x] Manual smoke: page pins, idle bbox refetch, missing coords omitted, mobile preview card

---

## Anti-goals (unchanged)

- Full card DTOs for thousands of markers
- Map on `/search` All tab
