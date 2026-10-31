---
stage: done
title: 'Listing & search pagination at scale — Implementation Plan'
status: done
tags: [planning, search, marketing, performance, pagination]
updated: 2026-08-06
---

# Listing & search pagination at scale — Implementation Plan

> **For agentic workers:** Implement task-by-task. Prefer `/workflow-start` then a focused implementation session. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make public listing and search APIs scale to thousands of ACTIVE rows by returning **one page of enriched results** plus accurate totals/facets — without changing guest-visible search/listing layout or behavior unless a scale fix forces a minimal, documented exception.

**Architecture:** Keep existing URL `page` / `pageSize`, classic pager, All-view preview + See all, and facet sidebars. Replace fetch-then-slice-of-fully-enriched-rows with (1) lean filter → page → enrich page only, then (2) push filters/counts/facets toward SQL where geo/availability allow. Phase 2 adds a place-group index for browse-by-location rows.

**Tech stack:** Supabase Edge Functions (Deno), PostgREST/Postgres, existing UI hooks (`usePublicProperties`, `useSearchListings`, etc.).

**Spec:** [`listing-search-pagination-design.md`](./listing-search-pagination-design.md)

**Progress:** **Shipped** (Phases 1–2 + acceptance). Moved to [`../done/`](../done/).

## Global constraints

- **No UX/layout redesign** of `/search` or public listing pages (tabs, filters chrome, card grids, pager UI, All preview) unless required for correctness — prefer server-only changes.
- Preserve response envelopes: `{ data, total, facets, page, pageSize }` for `list-public-*`; search-listings totals + meta unchanged for the client.
- Preserve Nearby / concept `where` stripping and geo radius behavior.
- Availability + guest capacity must still exclude conflicts from **page rows and totals**.
- Local verification only (`./dev.sh`, curl local functions). No prod deploy without `kamewave`.
- No Vitest suite yet — verify with curl + Network tab + seeded volume; do not invent a full test harness unless asked.
- Docs in the same change: `docs/guides/routes/search.md` (+ properties/developments/parkings as needed), `docs/PROJECT.md` API notes.

---

## File map

| Path                                                       | Role                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `supabase/functions/list-public-properties/index.ts`       | Property browse/filter — primary hot path                           |
| `supabase/functions/list-public-developments/index.ts`     | Developments browse                                                 |
| `supabase/functions/list-public-parkings/index.ts`         | Parkings browse                                                     |
| `supabase/functions/list-public-place-groups/index.ts`     | Bounded location groups + page-only previews                        |
| `supabase/functions/search-listings/index.ts`              | Unified search (All preview + category page)                        |
| `supabase/functions/_shared/publicListingFacets.ts`        | Facet helpers (reuse / extend)                                      |
| `supabase/functions/_shared/publicGeoScope.ts`             | Radius scoping (keep)                                               |
| `supabase/functions/_shared/availabilityService.ts`        | Conflict sets (keep)                                                |
| `supabase/migrations/*`                                    | Only if new indexes / RPC for counts or facets                      |
| `ui/.../search/*`, `ui/.../marketing/*/hooks/*`            | Prefer **no** UI changes; only if API contract needs a thin adapter |
| Phase 2: new edge function + `PropertiesByLocation` et al. | Place-group lazy load                                               |

---

## Phase 1A — Enrich only the current page (quick win, no UI change)

**Notes (Task 1–3):** Pricing stays on the full candidate set for price filter + facets. Reviews load on the full set only when sort is rating/reviews; nearest/newest + superhost defer to page ids. Developments defer `propertyCount` to page names. Parkings had no separate enrich batch. `search-listings` already paginated before pricing/count queries.

### Task 1: Properties — lean filter, then enrich page

**Files:**

- Modify: `supabase/functions/list-public-properties/index.ts`
- Possibly touch: batch helpers used for pricing/reviews (call sites only)

**Interfaces:**

- Consumes: existing query params, `scopeRowsToRadius`, `loadConflictingPropertyIds`, facet helpers
- Produces: same JSON shape; Network shows pricing/media only for `pageSize` rows

- [x] **Step 1:** Trace current pipeline; list which fields are needed for filter/sort/facets vs card payload.
- [x] **Step 2:** After building the filtered/sorted `working` id list (lean rows), compute `total = working.length`, facets from lean attributes, then `pageRows = working.slice(start, start + pageSize)`.
- [x] **Step 3:** Run `batchLoadPropertyPricing` / reviews / images / amenity enrichment **only** on `pageRows` ids.
- [x] **Step 4:** Curl local: `list-public-properties?page=1&pageSize=24` and `page=2` — totals stable; page 2 ids differ; response time drops on large seed.
- [x] **Step 5:** Confirm UI `/properties` and `/search?type=properties` unchanged visually.

### Task 2: Developments + parkings — same enrich-page pattern

**Files:**

- Modify: `list-public-developments/index.ts`, `list-public-parkings/index.ts`

- [x] **Step 1:** Mirror Task 1 — facets/total from full filtered lean set; enrich only the page.
- [x] **Step 2:** Curl both endpoints page 1/2; smoke `/developments` and `/parkings`.

### Task 3: search-listings — enrich page only per family

**Files:**

- Modify: `supabase/functions/search-listings/index.ts`

- [x] **Step 1:** For each family, after ranking/filtering, paginate **before** heavy mapping that loads images/amenities when those are separate queries.
- [x] **Step 2:** `type=all` still returns preview pageSize per family; `type=properties|…` paginates that family only.
- [x] **Step 3:** Curl Condos / Nearby / literal; confirm overview + category tabs still match.

### Task 4: Docs + manual QA checklist (Phase 1A)

**Files:**

- Modify: `docs/guides/routes/search.md` (performance note: server pages enriched rows only)
- Modify or add: short section in `docs/guides/testing/smart-search-intents-manual.md` or a `listing-pagination-manual.md`

- [x] **Step 1:** Document that payloads are one page of cards; totals/facets still full filtered set.
- [x] **Step 2:** Seed or use fixtures with ≥100+ properties if available; verify Network size.

---

## Phase 1B — Raise / remove the hard 2000–500 fetch caps safely

Lean filtering still loads up to `limit(2000)` / `limit(500)`. At thousands of ACTIVE rows, results beyond the cap are invisible.

### Task 5: Strategy choice (implement one; document)

**Implemented pragmatic path:** deterministic PostgREST range reads (1,000 rows/request) for lean candidates, with a **20,000-row fail-closed safety ceiling**. The API never silently returns capped totals/facets: catalogs over the ceiling return an error until the SQL/RPC path replaces the hybrid.

**Ideal path:** Postgres RPC / views that return `{ ids, total }` for the filter set, then enrich page ids in the edge function.

**Files:**

- Modify: `list-public-*`, possibly new `supabase/migrations/YYYYMMDDHHMMSS_public_listing_page_rpc.sql`
- Modify: `docs/PROJECT.md` API notes

- [x] **Step 1:** Measure local ACTIVE counts; decide interim ceiling vs RPC for properties first.
- [x] **Step 2:** Implement properties path; prove totals can exceed previous 2000 when seed is larger.
- [x] **Step 3:** Port developments/parkings.
- [x] **Step 4:** Update route guides: remove “working set capped at N” if no longer true, or document new ceiling honestly.

**Verification:** temporary local seed raised ACTIVE properties from 6 → **2,107**. Page 88 returned 19 rows with `total: 2107` in ~0.19s; filtered Scale Test returned `total: 2101` with matching type/price facets. Fixtures were removed afterward.

### Task 6: Facets stay correct at scale

**Files:**

- Modify: `publicListingFacets.ts` and/or SQL aggregates in migration/RPC

- [x] **Step 1:** Ensure facets are computed on the **full filtered lean set** (or SQL `GROUP BY`), never on the current page alone.
- [x] **Step 2:** Spot-check: filter type=condo, page through results — facet counts unchanged across pages.

### Task 7: Availability / geo correctness under paging

- [x] **Step 1:** With dates set, confirm conflicting ids excluded from total and from every page.
- [x] **Step 2:** Nearby + `list-public-*`: radius filter applies before page slice; distances only needed for sort/display on page rows when sorting by distance.

**Verification:** one temporary blocked property reduced filtered total/facet count from 2,101 → **2,100**. Nearby returned 6/6 rows with coordinates; farthest was 19.89 km inside the 120 km radius.

---

## Phase 1C — search-listings parity + index hygiene

### Task 8: Align search-listings caps with list-public strategy

**Files:**

- Modify: `search-listings/index.ts`
- Review: `supabase/migrations/20261005130000_search_indexes.sql`, `20261006120000_public_listing_filter_indexes.sql`

- [x] **Step 1:** Same lean → page → enrich pattern; remove silent 500-row truncation or document replacement ceiling/RPC.
- [x] **Step 2:** Add indexes only if `EXPLAIN` on local shows sequential scans on hot filters (new migration; do not edit shipped migrations).

**Verification:** temporary local seed added 601 rows per family. `type=all` returned exact totals `{ properties: 601, developments: 601, parkings: 601, all: 1803 }` with 12-card previews; page 51 returned the final row for each scoped family. Literal, Condo concept, Nearby, and availability exclusion passed. Selective text-filter plans completed in 0.66–0.90 ms on the scale seed; existing trigram/status indexes were sufficient, so no migration was added.

### Task 9: Phase 1 acceptance

- [x] **Step 1:** UI smoke: `/search` All, category tabs, Filters, pager; `/properties` filters + pager; location page `/properties/in/…`.
- [x] **Step 2:** Confirm **no** intentional layout/CSS/component structure changes in the UI (diff should be empty or docs-only on `ui/` unless a bugfix was required).
- [x] **Step 3:** Update `docs/PROJECT.md` edge inventory one-liners if behavior of caps changed.

**UI acceptance:** desktop All/category/filter layouts and the 375 px mobile sheet/tab layout were unchanged. A 25-row temporary seed showed `1 / 3`; Next produced shareable `?page=2`, rendered 12 different cards, and showed `2 / 3`. Browser console had no errors (only existing React Router v7 future-flag warnings).

---

## Phase 2 — Location-group lazy load (after Phase 1)

Do **not** start until Phase 1 acceptance passes. Still no redesign of row chrome — only load fewer groups.

### Task 10: Place-index API

**Files:**

- Create: e.g. `supabase/functions/list-public-property-places/index.ts` (name finalized at implement time)
- Register: `supabase/config.toml` JWT/public policy like other list-public functions

**Contract (draft):**

- Query: existing browse filters that apply to the index + `groupOffset` / `groupLimit` (default K=6–8)
- Response: `{ groups: [{ place, locationSlug, title, total, preview: PropertyCard[] }], groupTotal, groupOffset, groupLimit }`
- Preview length: small (e.g. 8–12) matching current row carousel capacity

- [x] **Step 1:** Implement properties place-index; curl first/next group pages.
- [x] **Step 2:** Mirror developments/parkings if those indexes use the same ByLocation pattern.

**Implemented contract:** `list-public-place-groups?family=properties|developments|parkings&groupOffset=&groupLimit=&previewSize=`. Defaults are six groups and eight preview cards; limits are bounded at 12. Group counts come from the full lean ACTIVE family (shared 20,000-row fail-closed ceiling), while pricing/reviews/property counts/development chrome are loaded only for selected preview rows.

### Task 11: Wire UI without redesign

**Files:**

- Modify: `PropertiesByLocation.tsx` (+ developments/parkings equivalents)
- Modify: list page that currently passes full `properties` into grouping

- [x] **Step 1:** Fetch place-index instead of grouping full catalog client-side when on unfiltered (or lightly filtered) index browse.
- [x] **Step 2:** Append groups on “More places” or intersection observer — **no** change to card component or row title styling beyond loading affordance if required.
- [x] **Step 3:** View all navigates to `/properties|developments|parkings/in/:slug` live paged grids via `locationSlug` (same place resolver as place-groups).
- [x] **Step 4:** Docs: properties/developments/parkings route guides + design spec Phase 2 “shipped” note when done.
- [x] **Production harden (pre-done):** shared `listingPlace` parity (BGC / City strip / settings.city); initial place-groups error + retry (no silent client fallback); default browse uses `pageSize=1` facet fetch; footer `aria-busy` + live region.

**Verification:** local endpoint smoke returned first/next one-group windows with distinct slugs for all families (`san-fernando → azure-north-residences`, `san-fernando → paranaque`, `other → san-fernando`). Properties, developments, and parkings rendered the existing location row/card chrome with zero browser-console errors. A 375 px properties smoke had no document-width overflow. Filtered `/properties?type=condo` called only `list-public-properties`, confirming filtered/list/map behavior still uses the Phase 1 path. Unicode place slugs are normalized (`Parañaque` → `paranaque`). `locationSlug=san-fernando` on list-public-\* returns matching place totals.

---

## Explicit non-goals

- Infinite scroll as primary navigation on flat grids
- Changing SearchStatusBanner / focus / concept suggestion behavior
- Moving family tabs into sidebar “Type”
- Production deploy in this plan
- Full client-side virtualization of thousands of location rows without an API

---

## Suggested commit slices

1. list-public-properties enrich-page-only
2. list-public-developments + parkings enrich-page-only
3. search-listings enrich-page-only + docs
4. Cap/RPC raise for properties (+ indexes if any)
5. Cap/RPC for developments/parkings + search-listings
6. Phase 2 place-index + UI wire (separate PR/session)

---

## Handoff

After this plan is accepted: `/workflow-start` → move or copy into `docs/workflow/in-progress/` per workflow skill, then implement Phase 1A first in a **new** session if context is large.
