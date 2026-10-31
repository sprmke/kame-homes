---
title: 'Calendar — legacy route'
status: active
tags: [guides, routes, org, property]
updated: 2026-08-24
---

# Calendar — legacy route

Route: `/org/:orgSlug/property/:propertySlug/calendar`

> **Status:** Redirect — replaced by **Pricing**.

This legacy URL redirects to `/org/:orgSlug/property/:propertySlug/pricing` with
`replace`, so it does not add an extra browser-history entry.

The pricing UI, permissions, fields, save paths, and owner-managed date blocks are
documented in the [Pricing operator guide](./pricing.md).
---

## Testing

| Layer | Path / spec                                                     | Manual |
| ----- | --------------------------------------------------------------- | ------ |
| E2E   | `ui/e2e/features/auth/legacyRouteRedirectSmoke.spec.ts` (`@ci`) | —      |
| N/A   | Redirect-only route                                             | —      |
