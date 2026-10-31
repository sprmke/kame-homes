---
title: 'Guest Wishlist — redirect'
status: active
tags: [guides, routes, account]
updated: 2026-08-09
---

# Guest Wishlist — redirect

Route: `/account/wishlist` → **`/account/favorites`**

The guest account hub formerly labeled **Wishlist** is now **Favorites**. See [favorites.md](./favorites.md).
---

## Testing

| Layer | Path / spec                                | Manual |
| ----- | ------------------------------------------ | ------ |
| E2E   | `legacyRouteRedirectSmoke.spec.ts` (`@ci`) | —      |
| N/A   | Redirect-only                              | —      |
