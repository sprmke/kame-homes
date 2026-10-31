---
title: 'Guest Messages — redirect'
status: active
tags: [guides, routes, account]
updated: 2026-08-09
---

# Guest Messages — redirect

Route: `/account/messages` → **`/account/stays`**

The guest account hub formerly labeled **Messages** is now **Stays**. See [stays.md](./stays.md).
---

## Testing

| Layer | Path / spec                                | Manual |
| ----- | ------------------------------------------ | ------ |
| E2E   | `legacyRouteRedirectSmoke.spec.ts` (`@ci`) | —      |
| N/A   | Redirect-only                              | —      |
