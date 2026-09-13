---
title: 'Developments (guest marketing) — operator guide'
status: active
tags: [guides, routes, developments]
updated: 2026-08-27
---

# Developments (guest marketing) — operator guide

Routes:

- `/developments` — list (location-grouped carousels)
- `/developments/in/:location` — flat list for one place (city slug, e.g. `tagaytay`, `sta-rosa`)
- `/developments/:slug` — detail (hero, amenities, unit + parking previews)
- `/developments/:slug/properties` — all units in development
- `/developments/:slug/parking` — parking slot list
- `/developments/:slug/parking/category` · `…/parking/list` — legacy redirects → `…/parking`

> **Status:** Documented — list + filters live via `list-public-developments` (URL facets/sort, chips, mobile sheet sort). Location browse uses `locationSlug` on the same APIs.

## Progress overview

| Section            | E2E save | Validation | Docs       | Notes                                                                                          |
| ------------------ | -------- | ---------- | ---------- | ---------------------------------------------------------------------------------------------- |
| Developments list  | —        | —          | Documented | Live `list-public-developments`; URL-driven filters + facets                                   |
| Location browse    | —        | —          | Documented | Properties grouped by development                                                              |
| Development detail | —        | —          | Documented | Hero, amenities, unit + parking previews                                                       |
| Properties in dev  | —        | —          | Documented | Links to `/properties/:slug`                                                                   |
| Parking flow       | —        | —          | Documented | Slot list at `…/parking`; Reserve links to `/parkings/:slug` when `detailSlug` is set          |
| Mobile shell       | —        | —          | Documented | `MarketingLayoutShell` bottom tabs — see [index-landing.md](./index-landing.md) § Mobile shell |

---

## Overview

Condominium / building marketing pages (PMA `features/marketing/developments/**`). Used for multi-unit developments and shared parking listings.

**Unknown slug:** redirects to **`/developments`**.

---

## Host-facing knowledge

Development pages market a whole building or condominium, so guests can browse units, parking slots, and building amenities before opening an individual home listing.

**Common host questions**

- Q: When should I use a development page instead of a single property listing?
  A: Use it when you manage multiple units or shared parking in one building. Guests see the building first, then pick a unit or slot.
- Q: How do guests book parking from a development page?
  A: Parking slot cards link to `/parkings/:slug` when the slot is live. Guests reserve through the operational parking form at `/parkings/:slug/form`.

---

## List (`/developments`)

**`DevelopmentsListPage`** — **`list-public-developments`** edge function; URL params drive filters/sort; facets from API (types, cities, price, developers). Empty facet sections in the sidebar show **None**. Lean candidates load in deterministic 1,000-row ranges (20,000-row fail-closed ceiling); `propertyCount` on cards is loaded for the **current page only** (not used for facets/sort).

- **Grid view (default):** Airbnb-style rows grouped by **`city`** (`DevelopmentsByLocation` → `DevelopmentsLocationRow`). Unfiltered browse uses `list-public-place-groups?family=developments`, loading six groups with eight previews each; **Show more places** appends the next group window. Each row keeps its clickable title + chevron (**View all** → `/developments/in/:location`), horizontal compact cards, and desktop carousel chevrons. Filtered/list/map modes stay on `list-public-developments`.
- **List view:** flat **`DevelopmentsGrid`** (list layout).
- **Map view:** Google Map with price pins for geocoded developments; a guest pan/zoom **automatically** updates `swLat`/`swLng`/`neLat`/`neLng` in the URL after the map settles (same bbox contract as `/properties`), while programmatic framing does not — opening map view leaves the URL clean and **Reset area** clears the bounds. Full map contract: [`search.md`](./search.md) § Map view. Pin preview links to **`/developments/:slug`**. Requires `VITE_GOOGLE_MAPS_API_KEY`. View mode persists via `?view=map|list` (grid omits `view`). In map view, sidebar facets (types, cities, developers, price) are computed from the **visible map pool** before categorical filters, so options track what’s on screen.

On scroll, **`ListingHeroSearch`** morphs into the fixed header center (same behavior as `/properties`).

**Where field:** empty on `/developments` (category index — do not prefill the nav label); city name on `/developments/in/:location`; development name on `/developments/:slug`, `/developments/:slug/properties`, and `/developments/:slug/parking` (`listingSearchDefaultLocation.ts`). Placeholder: **Search developments** (`listingSearchFields.ts`). Parking routes omit the **Who** segment.

---

## Location browse (`/developments/in/:location`)

**`DevelopmentsLocationPage`** — live developments + properties for that place, **grouped by development** (Airbnb-style rows).

- **`:location`** — slugified city (`tagaytay`, `sta-rosa`, …) via shared **`normalizeCityPlace`** + **`toLocationSlug`** (trailing `City` stripped; matches place-groups).
- Loads **`list-public-developments?locationSlug=…`** and **`list-public-properties?locationSlug=…`**.
- **Grid (default):** **`PropertiesByDevelopment`** — one carousel row per development; title → **`/developments/:slug`**.
- **List:** flat property list for units matched in those developments (falls back to place-scoped properties).
- Toolbar count is **properties** (not developments). Below `sm` the `DevelopmentsToolbar` stacks: count on row one, sort + view-mode right-aligned on row two, so the count is never clipped.
- Mobile `DevelopmentsFilters` sheet: flex column (`z-[100]`/`z-[101]`, above the scroll-morph search bar), pinned header + **Show results** / **Clear all** footer with a safe-area inset, scrolling list between.
- Same scroll search morph as `/developments` (`listingScrollSearchPaths` matches `/developments/in/*`).
- Unknown / empty location → redirect to **`/developments`**. Error: **Try again**.

Route is registered **before** `/developments/:slug` so `in` is not treated as a development slug.

---

## Detail (`/developments/:slug`)

**`DevelopmentDetailPage`** — live `list-public-developments?slug=` (`usePublicDevelopment`; slug is applied on the candidate query, not after a full catalog load). Unknown slug → `/developments`. Search bar above compact hero carousel (**Where** = development name). Hero CTAs: **View Homes** → **`/developments/:slug/properties`**, **View Parking** → **`/developments/:slug/parking`** (when slots exist). **`DevelopmentAmenities`**, then **`DevelopmentAvailableSection`** — live `list-public-properties?development=` and `list-public-parkings?developmentSlug=` (waits for both queries; empty rows hidden; no mock fallback).

---

## Properties in development (`/developments/:slug/properties`)

**`DevelopmentPropertiesPage`** — live development + `list-public-properties?development=`. Same layout as **`/properties/in/:location`**: search bar, filter toolbar, **Homes in {development}** heading with **View Parking** → `…/parking` on the right when `list-public-parkings?developmentSlug=` has rows, then property grid/list/map. Cards link to **`/properties/:propertySlug`**. Unknown development → `/developments`.

---

## Parking

| Route                  | Page                         | Behavior                                                                                                                                                                                                                 |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.../parking`          | `DevelopmentParkingListPage` | Live `list-public-parkings?developmentSlug=`. Same layout as `…/properties`: hero search, collapsible **ParkingFilters** sidebar (location, tower, price), toolbar + sort, **Parking in {development}** + **View Homes** |
| `.../parking/category` | redirect                     | → `.../parking` (legacy)                                                                                                                                                                                                 |
| `.../parking/list`     | redirect                     | → `.../parking` (legacy)                                                                                                                                                                                                 |

**Search bar** — **`ListingHeroSearch`** / **`HeroSearch`**; **Where** = **`{development} Parking`**; **Who** hidden. Search updates `?location` / `?checkIn` / `?checkOut` (dates reserved for future availability checks). **ParkingFilters:** **Location** (Inside / Outside Tower), **Tower** (when Inside Tower selected), price. List shows **available slots only** (`isAvailable`).

Not connected to operational **`/bookings/:id/parking`** (admin/guest pay parking flow).

---

## Implementation map

| Concern    | Path                                                               |
| ---------- | ------------------------------------------------------------------ |
| Pages      | `ui/src/features/guest/marketing/pages/DevelopmentsListPage.tsx`   |
|            | `DevelopmentsLocationPage.tsx`                                     |
|            | `DevelopmentDetailPage.tsx`, `DevelopmentPropertiesPage.tsx`       |
|            | `DevelopmentParkingListPage.tsx`                                   |
| Components | `ui/src/features/guest/marketing/developments/components/**`       |
|            | `DevelopmentsByLocation.tsx`, `DevelopmentsLocationRow.tsx`        |
| Grouping   | `developments/lib/groupDevelopmentsByLocation.ts`                  |
| Place API  | `shared/hooks/usePublicPlaceGroups.ts`; `list-public-place-groups` |
|            | `properties/lib/groupPropertiesByDevelopment.ts`                   |
| Live APIs  | `usePublicDevelopment`, `usePublicProperties`, `usePublicParkings` |
| Mock data  | `developments/data/mockDevelopments.ts` (landing featured only)    |
| Routes     | `ui/src/features/guest/marketing/routes/index.tsx`                 |

---

## Testing

| Layer | Path / spec                                          | Manual |
| ----- | ---------------------------------------------------- | ------ |
| E2E   | `publicPagesSmoke.spec.ts` developments list (`@ci`) | —      |

---

## Related docs

- [Properties](./properties.md)
- [Route index](./README.md)

---

## Pending / follow-ups

- [ ] Public API for developments + parking inventory
- [ ] Link parking list to real slot booking / payment flow
