---
title: 'Smart search intents — manual test flows'
status: active
tags: [guides, testing, search]
updated: 2026-08-05
---

# Smart search intents — step-by-step manual testing

Manual E2E for **Nearby**, **common-noun concepts**, and **literal / expanded** search on the public marketing site.

**Behavior spec:** [`docs/guides/routes/search.md`](../routes/search.md)  
**Timezone:** Asia/Manila for dates only (geo is WGS84).

### Local fixtures (typeahead See all)

Live `/search` reads **ACTIVE** DB rows (not UI mocks). Seed Azure inventory so each category has ≥3–4 hits:

```bash
docker exec -i supabase_db_guest-form-management psql -U postgres < scripts/dev/seed-search-fixtures.sql
```

Also applied on `supabase db reset` via `supabase/seed.sql`. Marketing mocks (`mockDevelopments` / `mockProperties` / `mockParkingSlots`) include matching Azure names for browse-page demos.

| Sample string | Expect in typeahead                                                     | Verify                                                                                   |
| ------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **`azure`**   | Developments ≥3, Properties ≥3, Parkings ≥3 → **See all** on each group | Click **See all** on Properties → `/search?where=azure&type=properties&focus=properties` |
| **`monaco`**  | Properties + Parkings (tower/slot names)                                | Entity click deep-links; See all when ≥3                                                 |
| **`kame`**    | Properties → Kame Home (often single-category)                          | Category heading still shown on `/search`                                                |
| **`condo`**   | Concept expansion                                                       | Properties-heavy results                                                                 |
| **`nearby`**  | Single “Uses your location” chip                                        | Not a multi-category See all case                                                        |

---

## 0. What you are proving

| #   | Capability                 | Pass criteria                                                                                                                          |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Nearby chip / phrase       | Requests location; `/search?where=Nearby&lat=&lng=` when allowed                                                                       |
| 2   | Nearby denied              | Results page shows **Use my location**; granting coords loads ranked listings                                                          |
| 3   | Nearby ranking             | Closer listings (with map pins) appear before farther ones                                                                             |
| 4   | Concept: Condo             | `where=Condo` returns CONDO-type / condo-related listings with **Properties**                                                          |
| 5   | Concept: Beach             | `where=Beaches` returns coastal / beach-term related inventory when present                                                            |
| 6   | Concept: Parking           | Prefers parking inventory                                                                                                              |
| 7   | Literal specific           | `where=kame` → Kame Home under **Properties N**                                                                                        |
| 8   | Expanded fallback          | Odd phrasing with a concept token + 0 literal hits soft-expands once                                                                   |
| 9   | Category headings          | Single-category results still show Properties / Developments / Parkings                                                                |
| 10  | Typeahead Nearby           | Typing “nearby” shows “Uses your location” chip                                                                                        |
| 10b | Typeahead concept          | Typing “Condo” shows Ideas chip + condo listings — **not** “No matches”                                                                |
| 11  | Mobile 375px               | Nearby permission CTA + results usable at iPhone SE width                                                                              |
| 12  | Page-aware `/developments` | Search “kame” → `/search?…&focus=developments`; Developments section/tabs first                                                        |
| 13  | Search all results         | From `/properties` typeahead footer → `/search` **without** `focus`                                                                    |
| 14  | Category bar submit        | Magnifying glass on `/parkings` lands on `/search` (not `/parkings?location=`)                                                         |
| 15  | Typeahead See all          | ≥3 Properties hits → **See all** → `/search?where=…&type=properties`                                                                   |
| 16  | Filters on Nearby          | Category tab keeps the All-view count, facets populated, **no toast**; **pills stay** so you can toggle families with the sidebar open |
| 17  | Filters on Condos          | Properties tab / Filters: condo listings + facets (empty `where`, `type=condo`)                                                        |
| 18  | Filters on Beaches         | Stays on `search-listings` (no false “all properties” from empty where)                                                                |

---

## 1. Prerequisites

```bash
./dev.sh   # or UI + local functions already running
```

- At least one ACTIVE property with `settings.latitude` / `longitude` (or Azure North residence for default pin).
- Browser that supports Geolocation (Chrome / Safari). Use https or `localhost`.
- Optional: second listing farther away to verify sort order.

---

## 2. Nearby

### 2.1 Allow location

1. Open homepage → Where → tap **Nearby** (or type `Nearby` → Search).
2. Accept the browser location prompt.
3. Expect URL like `/search?where=Nearby&lat=…&lng=…`.
4. Expect category sections with listings near the pin (not “No matches” for the string Nearby).

### 2.2 Deny location

1. Block location for the site (or dismiss the prompt).
2. Search Nearby.
3. Expect empty state **Location needed** + **Use my location**.
4. Allow location from the CTA → results load without leaving `/search`.

### 2.3 Typeahead

1. Type `ne` / `nearby` (≥2 chars).
2. Expect a Locations row: **Nearby** · Uses your location.
3. Selecting it runs the same geo flow as the chip.

### 2.4 Filters on a Nearby search

1. From a Nearby result set on **All**, note the tab counts (e.g. Properties 6 · Developments 1 · Parkings 5).
2. Press the filters button. It reads **Filter properties** (whichever category it will open) — **no toast should appear**.
3. Expect the Properties tab with the **same count** as its All-view tab, never “No matches”.
4. Expect the sidebar facets to describe that set (property type, price band, bedrooms, amenities, development) rather than empty **None** groups.
5. Expect the **All / Properties / Developments / Parkings** pill strip to **remain visible** while Filters are open — toggle Developments without closing the sidebar.
6. Repeat on the Developments and Parkings tabs; counts must keep matching All.
7. Paste `/search?where=Nearby%20developments&lat=15.1696&lng=120.5598` without `type`; expect it to infer Developments and show Azure North.
8. Repeat `Nearby properties` from Cebu (`10.3157, 123.8854`) and `Nearby developments` from Palawan (`9.8349, 118.7384`); expect a stable, category-specific empty state. The URL/category must not fall back to All.
9. Switch quickly between the three phrases; loading may show a skeleton, but must never flash the previous category’s empty result or rewrite to a stale tab.

### 2.5 Filters on a concept search

1. Typeahead **Condo** → Ideas chip → `/search?where=Condos` with condo results on All.
2. Open **Filters** / Properties tab — expect condo listings + facets (bridge: empty `where`, `type=condo`), not “No matches”.
3. Repeat with **Beaches**: empty inventory is OK; Filters must **not** suddenly list every property.

---

## 3. Concepts (common nouns)

| Query      | Expect                                                                |
| ---------- | --------------------------------------------------------------------- |
| `Condo`    | Properties (and related) matching CONDO / condo terms; category label |
| `Beaches`  | Coastal / beach-term matches when inventory exists                    |
| `Parking`  | Parking category populated when slots exist                           |
| `Mountain` | Baguio / highland-related terms when present                          |

If local DB has no beach inventory, empty is OK — confirm `meta.intent` is `concept` via Network tab on `search-listings`.

---

## 4. Literal + expanded

| Query                              | Expect                                             |
| ---------------------------------- | -------------------------------------------------- |
| `kame`                             | Kame Home under **Properties** with count          |
| `Makati`                           | City / listing contains matches; not forced Nearby |
| `Azure`                            | Development / residence matches                    |
| Rare typo-only with zero inventory | Empty; no hallucinated AI results (v1)             |

Expanded: craft a query that fails literal match but contains `condo` as a token (e.g. nonsense + condo) only if useful — confirm `meta.usedSmartFallback` / `intent: expanded` in the JSON response.

---

## 5. Regression smoke

- Dates still hide conflicting properties/parkings.
- Guest counts still filter properties by capacity.
- Smart tabs still hide empty categories; All only when 2+ types match.
- Category headings always visible for non-empty sections.

---

## 5b. Page-aware search bar

1. Open `/developments`, type a query that hits multiple families, press Search.
2. URL includes `focus=developments`; All view lists **Developments** before Properties / Parkings; typeahead showed Developments right after Locations.
3. Repeat from `/properties` → `focus=properties`; from `/parkings` → `focus=parkings`.
4. From `/developments` typeahead, click **Search all results for “…”** → `/search` **without** `focus`.
5. Confirm homepage Search still omits `focus`.

---

## 6. Network checks (optional)

`GET /functions/v1/search-listings?where=Nearby&lat=15.17&lng=120.56`

- `meta.intent === "nearby"`
- `meta.needsLocation === false`
- `totals.all >= 0`

`GET ...?where=Nearby` (no lat/lng)

- `meta.needsLocation === true`
- `totals.all === 0`

---

## 7. Pagination smoke (Phase 1)

Local only (`./dev.sh`). Confirm page slice + stable totals (no UI change expected).

```bash
# pageSize=2 so page 2 differs with small seed
curl -sS -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  "http://127.0.0.1:54321/functions/v1/list-public-properties?page=1&pageSize=2"
curl -sS -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  "http://127.0.0.1:54321/functions/v1/list-public-properties?page=2&pageSize=2"
```

Pass when:

| Check        | Expect                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Totals       | Same `total` on page 1 and 2                                                                              |
| Ids          | First ids on page 2 ≠ page 1                                                                              |
| Developments | `list-public-developments` page 1/2 same pattern; `propertyCount` only needed on returned rows            |
| Search       | `search-listings?type=properties&page=1&pageSize=12` returns ≤12 cards                                    |
| Scale        | With >2,000 local ACTIVE rows, `list-public-properties` reports the exact total and reaches the last page |

UI: `/properties` and `/search?type=properties` pager still works; Network payload size stays ~page-sized.

Recorded Phase 1B smoke used 2,107 temporary local properties: page 88 (`pageSize=24`) returned 19 rows with `total: 2107`; one blocked property reduced both total and facet count by one. Temporary rows were removed after the check.

Recorded Phase 1C smoke used 601 temporary rows per search family. All returned exact totals (`1803` combined), and page 51 returned the final row for Properties, Developments, and Parkings. A 25-property browser smoke confirmed the existing classic pager updates the URL to `page=2` and preserves filters/tabs on desktop and mobile.

## 8. Location-group lazy loading (Phase 2)

For each `family=properties|developments|parkings`, call `list-public-place-groups` with `groupLimit=1&previewSize=2`, then repeat with `groupOffset=1`.

Pass when:

- first and second responses have different `locationSlug` values;
- each response contains at most one group and two preview cards;
- `groupTotal` is stable across offsets;
- default `/properties`, `/developments`, and `/parkings` keep the existing row/card chrome;
- **Show more places** appends later groups when more than six locations exist;
- **View all** still opens `/…/in/:location`;
- filtered/list/map modes continue to call the existing `list-public-*` endpoint;
- 375 px has no document-level horizontal overflow.

Recorded local smoke returned distinct first/next slugs for every family and normalized `Parañaque` to `paranaque`. Browser checks passed with zero console errors; filtered `/properties?type=condo` made no place-group request.
