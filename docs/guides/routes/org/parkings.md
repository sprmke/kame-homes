---
title: 'Org parkings list — operator guide'
status: active
tags: [guides, routes, org, parking]
updated: 2026-09-27
---

# Org parkings list — operator guide

Route: `/org/:orgSlug/parkings`

> **Status:** Documented

## Overview

Lists all parking slots for the organization. **UI mirrors** `/org/:orgSlug/properties` exactly for shell chrome: `AdminMobilePage` (`dense`) + `MobileHeroActionMenu` for Add parking, summary KPI cards (same four-slot grid), shared **`OrgListingToolbar`** in a `FloatingToolbar`, **table / grid / list** views (`orgListingGridClassName` / `orgListingStackClassName`), client pagination (31 / 50 / 100, no always-on count meta), table desktop-only. Domain copy/stats differ (reservations vs bookings; no copy-settings). Requires **`org.parkings:view`**. **Add parking** requires **`org.parkings:create`**. Scoped org admins (`all_listings = false`) only see assigned parkings (`list-parkings` filters like `list-properties`).

---

## Host-facing knowledge

This is your parking inventory hub, showing every slot your organization offers, with search, filters, and summary stats similar to the properties page. Each card shows location, type, cover photo, and high-level reservation metrics. From here you can open a slot’s dashboard, copy its public booking link, or add a new parking space.

**Common host questions**

- Q: Is this the same as parking tied to a stay booking on a property?
  A: No. These are standalone parking listings (tower slots, motorcycle bays, etc.). Guest stays that only need parking at a rental unit are still managed under property bookings.
- Q: How do I add a new parking slot?
  A: Tap **Add parking** (or use the **+** menu in the sidebar switcher), then complete setup on the new slot’s settings page.
- Q: What do the revenue and occupancy numbers mean?
  A: They reflect reservation activity for each slot. Full reservation booking flows are still rolling out, so treat dashboard-style metrics as previews until reservation data is connected end to end.

---

## Page sections

| Section       | Property equivalent                                                          | Parking notes                                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Summary cards | Total properties, revenue, avg revenue, avg occupancy                        | **Total parkings**; stats from `list-parkings` (`activeReservations`, `monthlyRevenue`, `occupancyRate`)                                      |
| Toolbar       | Shared `OrgListingToolbar` (search, status, type, per page, table/grid/list) | Same chrome as properties. Type: inside tower / outside tower / motorcycle. Default list under five; table (desktop) or grid (phone) at five+ |
| Pagination    | Client page over filtered list                                               | Page controls when more than one page (31 / 50 / 100); no always-on count meta                                                                |
| Card / list   | Image carousel, title, residence + address meta, stats                       | Cover image from `settings.coverImage`; title is display name; **Reservations** stat                                                          |
| Table         | Dense columns (desktop)                                                      | Name only (no address), type, status, reservations, revenue, occupancy, ··· menu                                                              |
| Actions menu  | Dashboard, Settings, Guest calendar, Copy link                               | **View parking** (public `/parkings/:slug`), **Copy public link**                                                                             |
| Empty state   | Filtered vs no slots                                                         | Same pattern as properties                                                                                                                    |

---

## Save path

- **Add parking** → `POST create-parking` → seeds parking settings → backfills empty/invalid **`properties.settings.preferredOwnerParkingId`** to the earliest ACTIVE org listing → redirects to parking settings

---

**Unsaved changes.** Closing with unsaved edits (X, Esc, outside click, Cancel, or leaving the page) asks to **Save & close**, **Discard**, or **Keep editing**. Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).

## Implementation map

| Concern                | Path                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| Page                   | `ui/src/features/dashboard/org/pages/OrgParkingsPage.tsx`                                     |
| Cards / list / table   | `OrgParkingCard.tsx`, `OrgParkingsTable.tsx`                                                  |
| Summary / toolbar      | `OrgParkingsSummaryCards.tsx`, `OrgParkingsToolbar.tsx` → shared `OrgListingToolbar.tsx`      |
| Pagination / view mode | Shared with properties (`orgListingPagination`, `orgListingViewMode`, `OrgListingViewToggle`) |
| Filters                | `ui/src/features/dashboard/org/lib/orgParkingsFilters.ts`                                     |
| Edge                   | `supabase/functions/list-parkings`, `create-parking`                                          |

---

## Testing

| Layer | Path / spec                                                  | Manual |
| ----- | ------------------------------------------------------------ | ------ |
| Unit  | `orgListingViewMode.test.ts`, `orgListingPagination.test.ts` | —      |
| E2E   | `orgHubSmoke.spec.ts` + parking marketplace specs            | —      |
| N/A   | Org parkings inventory dedicated smoke                       | —      |
