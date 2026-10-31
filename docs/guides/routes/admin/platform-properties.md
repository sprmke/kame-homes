---
title: 'Super Admin Properties — operator guide'
status: active
tags: [guides, routes, admin, properties]
updated: 2026-08-24
---

# Super Admin Properties — operator guide

Route: `/admin/properties`

> **Status:** Documented

## Progress overview

| Section            | E2E save | Validation | Docs | Notes                                                                  |
| ------------------ | -------- | ---------- | ---- | ---------------------------------------------------------------------- |
| Search & filters   | Done     | —          | Done | Search, status, type, development filters — server-side, URL-persisted |
| Table / grid views | Done     | —          | Done | Toggle via `SuperAdminListViewToggle`                                  |
| Development link   | Done     | —          | Done | Card/table link to matched development, if any                         |
| Pagination         | Done     | —          | Done | URL-persisted page/limit, `AdminListPagination` + per-page select      |

---

## Overview

Platform-wide directory of **every property across every organization**, for the platform team to browse without switching org context. Unlike the org-scoped properties page, this list carries **no booking/revenue/occupancy stats** — it is profile data only.

**Access:** `RequireSuperAdmin` (`SUPER_ADMIN_EMAILS`).

---

## Host-facing knowledge

This page is the platform team's master list of every property on the platform, across every host and organization — used to browse or investigate a property without needing to log in as its owner.

**Common host questions**

- Q: Does this page show my property's bookings or revenue to the platform team?
  A: No — this list only shows profile details (name, type, location, which organization and development it belongs to), not booking or financial data.
- Q: How does the platform team know which development my property belongs to?
  A: It's matched automatically when your property's residence/building name matches a development the platform team has registered.

---

## Card / row fields

| Field                                   | Source                                                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name / tower / unit                     | `properties.name`, `.tower`, `.unit_number` (same as org properties card)                                                                                               |
| Type / location / beds / baths / guests | `properties.type`, `properties.settings` (same as org properties card)                                                                                                  |
| Organization                            | `organizationSlug`, `organizationName` — joined from `properties.organization_id`                                                                                       |
| Development                             | `developmentSlug`, `developmentName` — matched by `properties.residence_name = developments.name` (case-insensitive); links to `/admin/developments/:slug` when matched |
| Bookings / revenue / occupancy          | **Hidden** (`hideStats: true`) — not computed on this page                                                                                                              |

---

## Filters

| Control     | Behavior                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------- |
| Search      | Name, slug, address, residence name, type, status (property columns), plus organization name/slug |
| Status      | `ACTIVE` / `INACTIVE`                                                                             |
| Type        | Exact match on `properties.type` (`CONDO` / `APARTMENT` / `HOUSE` / `VILLA` / `OTHER`)            |
| Development | Filter to properties matched to any registered development ("linked"), or none ("unlinked")       |
| View        | Table or grid                                                                                     |

Filters are **server-side, real DB predicates** (not client-side over the loaded page) — `list-platform-properties` applies `q` via `.or()` `ilike` across `name`/`slug`/`address`/`residence_name`/`type`/`status`, plus an `organization_id.in.(...)` clause when `q` matches an organization's name or slug (organizations are looked up in a small separate query, not the paginated properties query). `status`/`type` use `.eq()`. `development=linked`/`unlinked` filters on `residence_name` against the full list of development names (also a small lookup query, not the paginated resource). Filter state lives in the URL (`?q=`, `?status=`, `?type=`, `?development=`) alongside `page`/`limit`, so it's shareable/bookmarkable and survives refresh. Changing any filter resets to page 1.

---

## Pagination

Standard admin-list pagination (same pattern as the bookings list): `page`/`limit` persisted in the URL (`?page=`, `?limit=`), default page size 31 (`ADMIN_DEFAULT_PAGE_SIZE`). `GET list-platform-properties` accepts `page`/`limit`/`q`/`status`/`type`/`development`, applies the filters as real Postgres predicates against the `properties` table, orders by name, and paginates via `.range()` + `{ count: 'exact' }` — no full-table fetch. Response: `{ properties, total, page, limit }`. Pagination controls are hidden until there is more than one page; the per-page select (`AdminListPerPageSelect`) resets to page 1 on change.

---

## API reference

| Action | Endpoint                                                                                                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List   | `GET list-platform-properties?page=&limit=&q=&status=&type=&development=` — server-side filtered + `.range()`-paginated `properties` rows + organization + matched development; response includes `total`, `page`, `limit` |

---

## Implementation map

| Concern       | Path                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Page          | `ui/src/features/dashboard/super-admin/pages/SuperAdminPlatformPropertiesPage.tsx`                                         |
| Toolbar       | `ui/src/features/dashboard/super-admin/components/super-admin-platform-properties/SuperAdminPlatformPropertiesToolbar.tsx` |
| Table         | `ui/src/features/dashboard/super-admin/components/super-admin-platform-properties/SuperAdminPlatformPropertiesTable.tsx`   |
| Card (shared) | `ui/src/features/dashboard/org/components/org-properties/OrgPropertyCard.tsx`                                              |
| Filters       | `ui/src/features/dashboard/super-admin/lib/superAdminPlatformPropertiesFilters.ts`                                         |
| Adapter       | `ui/src/features/dashboard/super-admin/lib/platformPropertyAdapter.ts`                                                     |
| Query hook    | `ui/src/features/dashboard/super-admin/hooks/usePlatformProperties.ts`                                                     |
| Edge function | `supabase/functions/list-platform-properties/index.ts`                                                                     |

---

## Testing

| Layer  | Path / spec                                             | Manual                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only     | —                                                           |
| Manual | —                                                       | [`super-admin-manual.md`](../testing/super-admin-manual.md) |

---

## Related docs

- [Route index](../README.md)
- [Org properties (org-scoped equivalent)](../org/properties.md)
- [Development detail guide](./development-detail.md)
- [`docs/PROJECT.md`](../../PROJECT.md)

---

## Pending / follow-ups

- [ ] Consider adding booking/revenue stats if the platform team needs cross-org totals later.
