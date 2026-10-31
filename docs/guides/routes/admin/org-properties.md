---
title: 'Super Admin Org Properties — moved'
status: superseded
tags: [guides, routes, admin, properties]
updated: 2026-09-04
---

# Super Admin Org Properties — moved

Route `/admin/orgs/:orgSlug/properties` now **redirects** to the organization hub's Listings
section, `/admin/orgs/:orgSlug/listings`.

See [`admin/orgs.md`](./orgs.md) for the organization directory and hub (Overview, Subscription,
Listings, Approvals, AI credits, Support, Settings).
---

## Testing

| Layer  | Path / spec                                             | Manual                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only     | —                                                           |
| Manual | —                                                       | [`super-admin-manual.md`](../testing/super-admin-manual.md) |
