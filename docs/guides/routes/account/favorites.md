---
title: 'Guest Favorites — operator guide'
status: active
tags: [guides, routes, account]
updated: 2026-08-17
---

# Guest Favorites — operator guide

Route: `/account/favorites` (legacy `/account/wishlist` redirects here)

> **Status:** Documented.

## Progress overview

| Section    | E2E save | Validation | Docs       | Notes                        |
| ---------- | -------- | ---------- | ---------- | ---------------------------- |
| Saved list | ✅       | —          | Documented | `guest_saved_properties`     |
| Unsave     | ✅       | —          | Documented | Confirm dialog before remove |

---

## Overview

Grid of properties the signed-in guest has "hearted" (saved) while browsing the marketing site. Same save/unsave action as the heart icon on property listing and detail pages — this page is just the guest's saved-properties view. Nav label is **Favorites**.

---

## Host-facing knowledge

This is the guest's favorites list: properties they tapped the heart icon on while browsing. It doesn't affect availability, pricing, or bookings; it's purely a personal shortlist for the guest.

**Common host questions**

- Q: A guest asks why a property disappeared from their favorites.
  A: They likely un-hearted it (there's a confirm step before it's removed), or the listing itself may no longer be public. Favoriting doesn't reserve a stay or hold dates.

---

## Favorites grid

### Fields (per card)

| Field       | Storage                         | Notes                      |
| ----------- | ------------------------------- | -------------------------- |
| Thumbnail   | Property's public listing image | Square crop                |
| Name / meta | Property listing fields         | Same data as explore cards |

### Load path

1. Page mount → `useSavedPropertySlugsQuery` reads saved property slugs for the signed-in guest from **`guest_saved_properties`**.
2. Each slug renders a `WishlistPropertyCard` (fetches its own listing summary).
3. Empty state ("No saved properties.") links to **Browse properties** (`/properties`).

### Unsave path

1. Tap the heart on a `WishlistPropertyCard` → confirm dialog ("Remove from favorites?").
2. Confirm → deletes the guest's row in `guest_saved_properties` for that property (same mutation used by the heart icon on listing/detail pages) → card is removed from the grid.

### Behavior / edge cases

- Grid uses fixed **240px (`15rem`)** tracks (same scale as explore carousels), 2-up on mobile.
- Saving/unsaving from any explore page (listing grid, property detail) is reflected here on next load — there is no separate favorites-only save action.

---

## Implementation map

| Concern     | Path                                                                             |
| ----------- | -------------------------------------------------------------------------------- |
| Page        | `ui/src/features/guest/account/pages/GuestWishlistPage.tsx`                      |
| Card        | `ui/src/features/guest/account/components/WishlistPropertyCard.tsx`              |
| Shell       | `ui/src/features/guest/account/components/GuestAccountContentCard.tsx`           |
| Saved query | `ui/src/features/guest/marketing/properties/hooks/useSavedPropertySlugsQuery.ts` |
| DB          | `guest_saved_properties` table                                                   |

---

## Testing

| Layer | Path / spec                                                                 | Manual        |
| ----- | --------------------------------------------------------------------------- | ------------- |
| Unit  | N/A (Supabase RLS + client query)                                           | —             |
| E2E   | `ui/e2e/features/account/favoritesSmoke.spec.ts` list + empty state (`@ci`) | Save heart UX |
| N/A   | —                                                                           | —             |

---

## Related docs

- [Route index](../README.md)
- [Profile](./profile.md)
- [Stays](./stays.md)
- [Properties](../properties.md) — save heart / favorites gate
- [`docs/PROJECT.md`](../../PROJECT.md)
