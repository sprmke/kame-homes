---
title: Listing & search pagination at scale
status: done
stage: done
tags: [workflow, done, search, marketing, performance, pagination]
updated: 2026-08-06
---

# Listing & search pagination at scale

## Problem

Public listing and search APIs mostly **fetch a large working set then slice in Deno** (`list-public-*` up to ~2000 rows; `search-listings` up to ~500 per family). The UI already has classic `?page=` / `pageSize` and an All-view preview, but the server still pays full-set cost for filters, geo, availability, and facets. Browse-by-location rows (“Homes in San Fernando…”) group the **entire** client result set, which will not scale to many places.

## Decisions (approved)

1. **Outcome:** Scale readiness **and** clearer browse — Approach 1 (true server page + facet aggregates).
2. **Category navigation:** Classic pager (‹ 1 2 3 ›) on every flat single-family grid; shareable `page` in the URL.
3. **Phasing:** Phase 1 = flat grids (`/search` category tabs, filtered `/properties|developments|parkings`, location detail grids). Phase 2 = lazy-load location **groups** on index browse.
4. **No infinite scroll** on flat grids (filters + back/forward + share stay predictable).
5. **Preserve** current chrome and search behavior: All preview + See all, category tabs, facet sidebars, classic pager, existing page sizes (search default 12; browse default 24; max caps unchanged unless documented). **No layout or UX redesign** unless a scale fix forces a minimal change (document any exception in the plan).
6. **Priority:** optimize server/query path for thousands of rows; UI stays as-is.

**Implementation status (2026-08-06):** Phases 1–2 are complete. `list-public-*`, every `search-listings` family, and the place-group index read deterministic 1,000-row candidate ranges and fail closed above 20,000 rows. Unfiltered category indexes now request six location groups at a time with eight page-only enriched previews per row; **Show more places** appends the next group window. Exact totals, availability/Nearby correctness, classic pager URLs, location links, and desktop/mobile UI parity were verified locally.

**Implementation plan:** [`listing-search-pagination.md`](./listing-search-pagination.md)

## Job and audience

Guests browsing or searching stays / developments / parkings. Success = fast first paint with thousands of ACTIVE rows, honest totals, facets that match the filtered set, and no dumping the full catalog into the browser.

Visitor mode: **Operate** (task: find and open a listing) on listing/search surfaces.

## Phase 1 — Flat grids (ship first)

### UX (unchanged shape)

| Surface                                                         | Behavior                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/search` **All**                                               | First-page preview per family (~`pageSize`); **See all** → that category tab + pager. No pager on All. |
| `/search` **Properties / Developments / Parkings**              | Classic pager; `page` / `pageSize` in URL; tabs keep All-scoped totals (existing overview fetch).      |
| `/properties`, `/developments`, `/parkings` (filtered / sorted) | Same classic pager as today; data from true server pages.                                              |
| `/properties/in/:location` (and siblings)                       | Flat grid + pager — already the “view all for a place” drill-in.                                       |

Defaults stay: search `pageSize=12` (max 48); browse `pageSize=24` (existing caps). Changing a filter or sort resets `page=1`.

### Server contract

For `list-public-properties`, `list-public-developments`, `list-public-parkings`, and category-scoped `search-listings`:

1. Apply filters / intent / geo / availability in the **query path** (SQL or narrow PostgREST + targeted helpers), not “load N thousand then filter in memory” as the primary strategy.
2. Return **`data`** = one page only (`LIMIT` / range for `page` × `pageSize`).
3. Return **`total`** = count of the full filtered set (for pager + toolbar).
4. Return **`facets`** from **aggregations over the filtered set** (not over the current page only). Prefer SQL/`rpc` aggregates; if a temporary hybrid remains, document the row cap and treat it as tech debt with a hard ceiling.
5. Keep response envelope shape stable (`success`, `data`, `total`, `facets`, `page`, `pageSize`) so UI hooks stay thin.

`search-listings` when `type=all`: still return preview rows per family (page 1 only) + accurate per-family totals. When `type` is a single family: page that family; overview totals for the tab strip remain a separate All-scoped fetch (already in the UI).

### Availability & Nearby

Date conflicts and guest capacity must still exclude unavailable inventory from **both** page rows and `total` / facets. Nearby radius scoping stays shared (`publicGeoScope`). Do not reintroduce “Nearby” / concept labels as `where` text on `list-public-*`.

### Out of scope (Phase 1)

- Infinite scroll / cursor-only APIs for flat grids
- Changing card layout, filter IA, tab chrome, status banner, or search behavior
- Location-row lazy load (Phase 2)
- Fuzzy search / embedding rewrite
- Any UI diff that is not required to consume an unchanged API contract

## Phase 2 — Location-group browse (after Phase 1)

### Problem

`PropertiesByLocation` (and developments/parkings equivalents) builds every “Homes in …” row from the full in-memory list. Hundreds of places × many cards = heavy payload and DOM.

### UX

- Index browse (`/properties` unfiltered grouped mode, etc.): show the **first K place groups** (e.g. 5–8), each with a **small card preview** (existing row carousel) + **View all** → `/…/in/:slug` (Phase 1 paged grid).
- **More places** control or intersection-observer lazy load appends the next K groups (not individual cards inside a group beyond the preview).
- Do **not** put a classic pager inside each location row; drill-in owns paging.

### Server

`list-public-place-groups` accepts `family`, `groupOffset`, `groupLimit`, and `previewSize`. It returns bounded groups with `{ place, locationSlug, title, total, preview }`, plus `groupTotal`. The full lean ACTIVE family determines ordering/counts; only selected previews receive card enrichment.

### Out of scope (Phase 2)

- Redesigning location row visuals beyond lazy loading
- Virtualizing thousands of DOM rows without an API (client-only fake)

## Architecture sketch

```text
Guest UI (pager / All preview / tabs)
    │
    ├─ list-public-*     → page rows + total + facet aggregates
    ├─ search-listings   → All preview OR one family page + totals
    └─ (Phase 2) place-index → pages of location groups + previews
           │
           ▼
    Postgres (indexes already partly present for search/filters)
```

## Error / empty / loading

- Keep existing skeletons and empty states; pager hidden when `total ≤ pageSize`.
- Failed page fetch: existing error + retry; do not leave a blank grid without recovery.
- Changing filters mid-flight: reset to page 1; avoid flashing previous page’s cards (existing placeholder discipline).

## Testing

- Manual: large fixture or seed (≥ a few hundred ACTIVE properties) — confirm Network payload size stays ~one page; pager reaches last page; facets stay consistent when paging.
- Nearby + filters: totals and facets within radius.
- All → See all → page 2 shareable URL.
- Phase 2: many distinct cities — only K groups on first paint; More places loads more; View all lands on paged location page.

## Implementation map (indicative)

| Area | Paths                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------ |
| Edge | `list-public-*`, `search-listings`, shared filter/facet helpers, optional Phase 2 place-index                |
| UI   | Existing pagination components; hooks already pass `page`/`pageSize`; Phase 2: `PropertiesByLocation` et al. |
| Docs | `docs/guides/routes/search.md`, properties/developments/parkings guides, `docs/PROJECT.md` API notes         |
| QA   | Extend `docs/guides/testing/smart-search-intents-manual.md` or a short pagination checklist                  |

## Anti-goals

- Displaying all matching rows in one response “for simplicity”
- Infinite scroll as the only navigation on filtered grids
- Mixing listing-family tabs into the facet “Type” control (already rejected elsewhere)
- localStorage for page/focus state (URL remains source of truth)
