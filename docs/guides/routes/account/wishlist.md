---
title: 'Guest Wishlist — redirect'
status: active
tags: [guides, routes, account]
updated: 2026-08-09
---

# Guest Wishlist — redirect

Route: `/account/wishlist` → **`/account/favorites`**

The guest account hub formerly labeled **Wishlist** is now **Favorites**. See [favorites.md](./favorites.md).

## Host-facing knowledge

The guest account area calls this list **Favorites** now. It holds the properties a guest saved with the heart icon while browsing.

**Common host questions**

- Q: A guest clicked Wishlist and landed somewhere else. Is that expected?
  A: Yes. The old Wishlist link redirects to **Favorites**, which is the same saved-properties list.
- Q: Did the guest lose their saved properties?
  A: No. The redirect only changes the address. Every saved property is still in **Favorites**.
- Q: Does a saved property show up differently on my side?
  A: No. Favorites are private to the guest and do not change your listing, availability, or bookings.

---

## Testing

| Layer | Path / spec                                | Manual |
| ----- | ------------------------------------------ | ------ |
| E2E   | `legacyRouteRedirectSmoke.spec.ts` (`@ci`) | —      |
| N/A   | Redirect-only                              | —      |
