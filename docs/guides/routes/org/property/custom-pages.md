---
title: 'Custom Pages'
status: active
tags: [guides, routes, org, property]
updated: 2026-08-18
---

# Custom Pages

This module was renamed to **[[public-pages|Public Pages]]**.

Route `/org/:orgSlug/property/:propertySlug/custom-pages` redirects to `/public-pages`.

**Note:** `custom_pages.page_type` now includes **`property_showcase`** with a real multi-template `template_key` picker (Aurora / Monolith / Editorial) — the first true multi-template use of this table. See **[[property-showcase]]** and **[[public-pages]]**.
---

## Testing

| Layer | Path / spec                                                     | Manual |
| ----- | --------------------------------------------------------------- | ------ |
| E2E   | `ui/e2e/features/auth/legacyRouteRedirectSmoke.spec.ts` (`@ci`) | —      |
| N/A   | Redirect-only route                                             | —      |
