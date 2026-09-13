---
title: 'Properties (guest marketing) — operator guide'
status: active
tags: [guides, routes, properties]
updated: 2026-08-21
---

# Properties (guest marketing) — operator guide

Routes:

- `/properties` — list (location-grouped carousels)
- `/properties/in/:location` — flat list for one place (e.g. `tagaytay`, `makati`)
- `/properties/:propertySlug` — detail
- `/hosts/:orgSlug` — public org/host profile + listings
- `/properties/:propertySlug/calendar` — property-scoped calendar UI
- `/properties/:propertySlug/messages` — guest ↔ host web chat (see [chat.md](./properties/chat.md))

> **Status:** Documented — **Phase 2a (detail API)** for `/properties/:propertySlug`; **list + filters** live via `list-public-properties` (URL-backed facets/sort). Location/development sub-browse pages still mock.

## Progress overview

| Section           | E2E save | Validation | Docs       | Notes                                                               |
| ----------------- | -------- | ---------- | ---------- | ------------------------------------------------------------------- |
| List + filters    | —        | Live       | Documented | URL state + `list-public-properties` facets/sort                    |
| Location browse   | —        | —          | Documented | `/properties/in/:location` (live via `locationSlug`)                |
| Detail page       | —        | —          | Documented | Live API + mock fallback; see below                                 |
| Property calendar | —        | —          | Documented | Live `get-booked-dates` via `PublicPropertyCalendar`                |
| Mobile shell      | —        | —          | Documented | `MarketingLayoutShell` bottom tabs; Reserve → `ContextualActionBar` |

---

## Overview

Browse and view rental listings. Ported from PMA `features/marketing/properties/**`. Uses **`MarketingLayoutShell`**.

**Reserve / booking:** `BookingCard` and mobile sticky **Reserve** call **`usePropertyReserve`**. With check-in and check-out selected, **Reserve** runs **`requireGuestAuth`** when anonymous (same as Contact host), then opens **`GuestBookingFormModal`** on the listing — the same reusable **`GuestForm`** as `/properties/:propertySlug/form`, seeded with the selected dates (no page navigation). OAuth return uses `?reserveForm=open` (+ dates/guests). Without dates, opens the booking calendar modal first (desktop + mobile). After a full range is selected in **`BookingCalendarModal`**, **Continue** closes the calendar and opens the guest form modal (same auth/resume path as **Reserve**). Listing modals (calendar, guest form, house rules, amenities) share **`GuestDialogShell`** (header + optional action footer with separators). Direct `/form` links and calendar **Book Now** navigate to the standalone form page, which opens **`GuestAuthModal`** on entry when anonymous (same as **`/messages`**).

**Contact host:** **`ListingHostCard`** → auth if needed → **`ContactHostSheet`** centered modal (text thread + **Talk to receptionist** when enabled). See **[chat.md](./properties/chat.md)**.

**Save / wishlist:** Heart on **`PropertyCard`** (grid + carousel), **`PropertyListItem`**, and detail **`PropertyGallery`** uses **`usePropertySave`** → **`requireGuestAuth`** when anonymous, then persists to **`guest_saved_properties`** (shared TanStack Query cache). OAuth return resumes via **`save_property`** intent in **`guestAuthResume.ts`**.

**Host profile link:** Org name on the property detail host card links to **`/hosts/:orgSlug`** (e.g. `/hosts/kame-homes`). Public page clears the fixed marketing nav (`pt-20` / `lg:pt-24`), applies org **brand color** (`GuestPublicBrandShell`), circular org logo, name → hosted-by → tagline → description → circular social icons, then **Homes** / **Parkings** tabs (when both exist) with paginated grids of **ACTIVE** listings. Admin dashboard uses **`/org/:orgSlug`** — public guest URLs use **`/hosts/`** to avoid confusion. API: **`get-public-host?org=`** (batched pricing reads; missing settings rows fall back to platform defaults, no seed on read).

**Unknown slug:** detail redirects to **`/properties`**.

---

## Host-facing knowledge

This is where guests browse homes, open a listing, save favorites, contact the host, and start a booking. Each live listing can also link to a public host profile page that shows everything that host currently offers.

**Common host questions**

- Q: Where do guests see my organization name and other listings?
  A: On each property page, your name links to your public host page. There guests see your logo, description, social links, and all active homes and parking you list.
- Q: What's the difference between the booking form and a custom form link on my listing?
  A: The main booking flow uses the standard reservation form after guests pick dates. Separate form links are for custom questionnaires or previews, and they don't replace the official booking form yet.
- Q: Why doesn't my inactive property show on my public host page?
  A: Only active listings appear there; archived or draft units stay out of public view until you publish them again.
- Q: Will cheaper listings bury mine in search?
  A: Guests cannot sort by lowest price. The default is **Recommended** (ratings / reviews). Budget guests use price-range filters instead, and those still keep Recommended order inside their budget.
- Q: How do I change photos, amenities, or which sections show on my listing?
  A: In the dashboard, open **Public Pages → Property → Edit**. That editor updates the live listing guests see.

---

## Sort options (list + `/search` properties tab)

| Sort                         | Default? | Role                  |
| ---------------------------- | -------- | --------------------- |
| Recommended                  | Yes      | Quality-first landing |
| Highest Rated / Most Reviews | No       | Social proof          |
| Newest                       | No       | Fresh inventory       |

**Price: Low to High / High to Low are not offered** — prevents race-to-bottom pricing pressure on hosts. Budget shopping uses price-range filters. Rationale: **`docs/workflow/done/smart-filters.md`** § Sort fairness.
---

## Public host profile (`/hosts/:orgSlug`)

**`HostPublicPage`** — guest-facing org brochure (distinct from the signed-in dashboard at **`/org/:orgSlug`**).

- Loads org branding, tagline, description, and social links via **`get-public-host`** (batched pricing reads; missing settings rows fall back to platform defaults)
- Grids of **ACTIVE** properties and **ACTIVE** parkings when the org has either
- When the org has **both** homes and parkings, **`HostPublicListingsTabs`** (pill tabs + counts, same pattern as `/search`) switches between the two listing types — one grid at a time instead of stacked sections. Tab row: tabs left, inline pagination right. When only one type exists, a single section header + grid (no tabs).
- Each grid paginates client-side to **four visible rows** (`HOST_LISTING_MAX_ROWS` in `hostListingGrid.ts`) — page size = column count × 4, derived from the live grid width via `useHostListingPageSize`. Changing tab or page scrolls the listings panel back into view.
- Org name on **`ListingHostCard`** (property + parking detail) links here
- **Verified** badge when enhanced verification is approved (see [onboarding.md](./onboarding.md))

---

## List (`/properties`)

| UI           | Component / data                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Search       | `ListingHeroSearch` (`HeroSearch`), `PropertiesToolbar`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Scroll dock  | On scroll, search morphs into header center (Airbnb-style); nav links slide up and fade via `useListingNavMorph`                                                                                                                                                                                                                                                                                                                                                                           |
| Where field  | Empty on `/properties`; `Tagaytay` on `/properties/in/tagaytay` (`listingSearchDefaultLocation.ts`). Placeholder: **Search properties** (`listingSearchFields.ts`)                                                                                                                                                                                                                                                                                                                         |
| Grid         | **`PropertiesByLocation`** — rows by place (`Homes in {place}`), carousel cards, title → View all. Default unfiltered browse loads six groups at a time from `list-public-place-groups`; **Show more places** appends the next window.                                                                                                                                                                                                                                                     |
| List / map   | Flat `PropertyListItem` / real Google Maps `PropertiesMap` → shared `ListingMapView`. Opening map view frames the results without writing bounds; a guest pan/zoom writes `swLat`/`swLng`/`neLat`/`neLng` once it settles, and **Reset area** drops them again. In map view, sidebar facets come from the **visible map pool** (before type/price/bedroom/amenity/development filters), so options update as the viewport moves. Full map contract: [`search.md`](./search.md) § Map view. |
| Sort / view  | URL `sort` + toolbar grid/list/map; sort also in mobile Filters & Sort sheet. Below `sm` the toolbar stacks: result count on the first row, sort + view-mode controls right-aligned on the second, so the count is never clipped                                                                                                                                                                                                                                                           |
| Applied      | Dismissible filter chips under toolbar; filtered empty state with **Clear filters**; empty facet sections show **None**                                                                                                                                                                                                                                                                                                                                                                    |
| Mobile sheet | `PropertiesFilters` bottom sheet is a flex column (`z-[100]`/`z-[101]`, above the scroll-morph search bar): pinned header + **Show results** / **Clear all** footer with a safe-area inset, scrolling option list between                                                                                                                                                                                                                                                                  |

Query params mirror PMA where implemented (location, dates, guests).

**Scale behavior:** `list-public-properties` reads lean ACTIVE candidates in deterministic 1,000-row ranges, computes filters/availability/Nearby/totals/facets before page slicing, then enriches the current page where possible. On the default unfiltered grid, `list-public-place-groups?family=properties` returns six place rows with eight previews each; only those previews receive pricing/review card enrichment. Filtered, list, and map modes stay on `list-public-properties`. Both paths use a 20,000-row safety ceiling that fails the request instead of silently truncating totals.

---

## Location browse (`/properties/in/:location`)

**`PropertiesLocationPage`** — live properties for one place only (no location grouping).

- **`:location`** — slugified place from property `location` (`tagaytay`, `makati`, `taguig`, …) via shared **`propertyPlaceLabel` / `placeLabelFromPropertyLocation`** + **`toLocationSlug`** (server + client parity, including BGC → secondary city and trailing `City` strip).
- Loads **`list-public-properties?locationSlug=…`** (paged; same place resolver as `list-public-place-groups`). Sidebar filters apply on top of the place scope.
- Same toolbar / grid|list|map chrome as the main list; default **`PropertyCard`** (not carousel).
- Page title **`Homes in {place}`** above results (matches location carousel row copy on `/properties`).
- Same scroll search morph as `/properties` (`listingScrollSearchPaths` matches `/properties/in/*`).
- Unknown / empty location slug → redirect to **`/properties`**.
- Error state: short message + **Try again**.

Route is registered **before** `/properties/:propertySlug` so `in` is not treated as a property slug.

---

## Detail (`/properties/:propertySlug`)

**Phase 2a:** `usePublicPropertyDetail` calls **`get-public-property?property=<slug>`** (anon). **ACTIVE** DB properties return live dashboard data; **404** or a missing payload redirects to **`/properties`**. TanStack Query caches 5 min. Dashboard **Page Editor** preview still injects override data (`previewOverride`).

Gap analysis (ratings, nearby POIs, etc.): **[[public-property-catalog|Public property catalog — reference]]**.

**Section order / visibility** — response includes **`sectionConfig`** from **`public_page_configs`** (`page_type = property_landing`). Section order is **fixed** (gallery → overview → amenities → location → rules → reviews). **Gallery** and **Overview** are always shown. Hosts can only toggle amenities / location / rules / reviews under **[[public-pages|Public Pages]] → Property → Edit**. Booking card is always shown. Similar properties stay out of config scope.

**Responsive layout** — listing chrome uses **CSS container queries** (`@container` / `@5xl:` ≈ 1024px content width), not only viewport `lg:` / `md:`. Below that width: single column, hero gallery, 2-col stats, floating **Reserve** bar. At `@5xl+`: `BookingCard` sidebar + collage gallery. Page Editor preview frames (mobile ≤420px or a narrow desktop pane) therefore match real phone/tablet layouts even when the host browser is wide.

**Mobile Reserve bar (2026-09-10)** — real end-user usage claims the shared bottom band via `ContextualActionBar` (the same floating pill dock as the marketing bottom tab bar; auto-hides it while open). The Page Editor's simulated mobile-frame preview keeps a literal `sticky` bar instead — a real `fixed` bar would escape the preview iframe and dock to the actual browser viewport.

| Section     | Component                                                                | Data                                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gallery     | `PropertyGallery`                                                        | API media URLs or mock images                                                                                                                                                                       |
| Overview    | `PropertyOverview`                                                       | API profile; **`ListingPlaceMeta`** (development link → `/developments/:slug`, tower · floor, geo); host card; cancellation highlight; ratings mock-only                                            |
| Amenities   | `PropertyAmenities`                                                      | Resolved amenity labels; preview grid + modal for full list                                                                                                                                         |
| Location    | `PropertyLocation` + `PropertyMapEmbed`                                  | Google/OSM iframe when pinned; decorative fallback if no pin                                                                                                                                        |
| Rules       | `PropertyRules`                                                          | House rules preview (6) + modal; cancellation live; safety mock-only                                                                                                                                |
| Reviews     | `PropertyReviews`                                                        | Merged Kame guest + approved external reviews (newest first); source badges; feedback tags on Kame reviews only; photos + lightbox; **See more** modal. No category bars, search, or helpful votes. |
| Booking     | `BookingCard` + `GuestBookingFormModal`                                  | API pricing; Reserve → in-page `GuestForm` modal                                                                                                                                                    |
| Similar     | `SimilarProperties`                                                      | live `list-public-properties` (same development/type/city); hidden when empty                                                                                                                       |
| Parking CTA | Marketplace **`/parkings`** browse or linked slot detail when configured |

---

## Property calendar (`/properties/:propertySlug/calendar`)

Same route and component as the operational booking picker — see **[calendar.md](./calendar.md)**. **`CalendarPage`** embeds **`PublicPropertyCalendar`** (`embedded`, no duplicate date summary). The property detail **`BookingCalendarModal`** uses the same grid in **`compact`** mode.

---

## API reference

| Action          | Endpoint / edge function                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Property detail | **`get-public-property?property=`** (shipped)                                                               |
| List properties | **`list-public-properties`** — page of cards; totals/facets over full filtered set; 20k fail-closed ceiling |
| Place groups    | **`list-public-place-groups?family=properties`** — bounded location rows + enriched card previews           |
| Booked dates    | **`get-booked-dates?property=`** — `useGuestBookedDates` → `PublicPropertyCalendar`, `BookingCalendarModal` |

Full field map + dashboard gaps: **[[public-property-catalog|Public property catalog — reference]]**.

---

## Implementation map

| Concern        | Path                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------- |
| Pages          | `ui/src/features/guest/marketing/pages/PropertiesListPage.tsx`                            |
|                | `PropertiesLocationPage.tsx`                                                              |
|                | `PropertyDetailPage.tsx`                                                                  |
| Calendar       | `property/components/PublicPropertyCalendar.tsx` (shared with `CalendarPage`)             |
| Reserve modal  | `properties/components/property-detail/GuestBookingFormModal.tsx`                         |
|                | `properties/hooks/usePropertyReserve.ts` (`onOpenForm`)                                   |
| Components     | `ui/src/features/guest/marketing/properties/components/**`                                |
|                | `PropertiesByLocation.tsx`, `PropertiesLocationRow.tsx`                                   |
| Grouping       | `properties/lib/groupPropertiesByLocation.ts`                                             |
| Place groups   | `shared/hooks/usePublicPlaceGroups.ts`; `list-public-place-groups/index.ts`               |
| Shared slug    | `marketing/shared/lib/locationSlug.ts`                                                    |
| Forms UI       | `ui/src/features/guest/marketing/forms/components/FormSuccess.tsx` (parking success only) |
| Mock data      | `properties/data/mockProperties.ts`, `mockPropertyDetail.ts`                              |
| Live detail    | `properties/hooks/usePublicPropertyDetail.ts`, `types/publicProperty.ts`                  |
| Section config | `properties/lib/propertyLandingSections.ts` (`resolvePropertyLandingSections`)            |
| Page Editor    | `ui/src/features/dashboard/page-editor/` (Property Landing panel)                         |
| Booked dates   | `form/hooks/useGuestBookedDates.ts`, `form/lib/fetchGuestBookedDates.ts`                  |
|                | `calendar/lib/guestCalendarAvailability.ts`                                               |
|                | `properties/lib/mapPublicPropertyDetail.ts`                                               |
| Image helper   | `marketing/shared/components/MarketingImage.tsx` (Vite `img` wrapper)                     |
| Scroll search  | `marketing/shared/context/ListingScrollSearchContext.tsx`, `MarketingNav.tsx`             |
| Routes         | `ui/src/features/guest/marketing/routes/index.tsx`                                        |

---

## Testing

| Layer | Path / spec                                                                             | Manual |
| ----- | --------------------------------------------------------------------------------------- | ------ |
| Unit  | Amenity/facet helpers when pure                                                         | —      |
| E2E   | `ui/e2e/features/public/publicPagesSmoke.spec.ts` list + detail mock (`@smoke` / `@ci`) | —      |
| N/A   | —                                                                                       | —      |

---

## Related docs

- [Route index](./README.md)
- [Calendar (operational)](./calendar.md)
- [Form (operational booking)](./form.md)
- [Developments](./developments.md)

---

## Pending / follow-ups

- [ ] Connect list/browse to published properties in DB
- [x] Wire property detail → `get-public-property` with mock fallback + query cache
- [x] Wire `BookingCard` Reserve → in-page `GuestBookingFormModal` (`GuestForm` embed; `usePropertyReserve` `onOpenForm`)
- [x] Property calendar + booking modal → `get-booked-dates`
- [ ] Replace `MarketingImage` placeholders with Supabase Storage URLs
