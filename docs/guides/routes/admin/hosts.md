---
title: 'Super Admin Hosts — operator guide'
status: active
tags: [guides, routes, admin]
updated: 2026-08-24
---

# Super Admin Hosts — operator guide

Route: `/admin/hosts`

> **Status:** Documented

## Progress overview

| Section            | E2E save | Validation | Docs | Notes                                                                                                    |
| ------------------ | -------- | ---------- | ---- | -------------------------------------------------------------------------------------------------------- |
| Summary cards      | Done     | —          | Done | Total hosts, orgs, properties, parking — dimension-scoped `count(*)` queries, not a full host-list fetch |
| Search             | Done     | —          | Done | Name / email — server-side, via `super_admin_search_hosts` RPC (joins `organizations` + `auth.users`)    |
| Table / grid views | Done     | —          | Done | Toggle via `SuperAdminListViewToggle`                                                                    |
| Pagination         | Done     | —          | Done | URL-persisted `page`/`limit`, standard admin-list pattern                                                |

---

## Overview

Platform-wide directory of **hosts** — every distinct organization **owner** across the platform (one row per owner user, not per organization). Super admins use this list to drill into a host's organizations and properties. Read-only: there is no create/edit/delete action on this page.

**Access:** `RequireSuperAdmin` (`SUPER_ADMIN_EMAILS`).

---

## Host-facing knowledge

This page is the platform team's directory of every host account that owns at least one organization — one row per person, even if they own several organizations or properties. Hosts don't see this page themselves.

**Common host questions**

- Q: If I own two organizations, do I show up twice in the platform team's host list?
  A: No — you appear once, and the platform team can see all of your organizations and properties from your single host record.
- Q: Does this page show my booking or revenue data?
  A: No — it only shows counts (how many organizations, properties, and parking slots you have). Booking and financial detail lives in your own dashboard.

---

## Summary cards

| Card              | Computation                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Total hosts**   | Distinct `organizations.owner_id` values — only the `owner_id` column is fetched, not full host rows                 |
| **Organizations** | `count(*)` on `organizations` (every org has a `NOT NULL owner_id`, so this already equals the sum across all hosts) |
| **Properties**    | `count(*)` on `properties`                                                                                           |
| **Parking**       | `count(*)` on `parkings`                                                                                             |

`loadHostsPlatformSummary` (`_shared/hostSerialize.ts`) runs these as four lightweight, dimension-scoped queries in parallel — no host, org, or property row is loaded into memory just to produce the cards, so this stays cheap regardless of platform size. The cards always reflect the platform total, independent of the current page or search.

---

## Host card / row

| Field         | Source                                                                              |
| ------------- | ----------------------------------------------------------------------------------- |
| Name / avatar | Supabase Auth user profile (`loadAuthUserProfile`) for the owner user               |
| Email         | Supabase Auth user profile                                                          |
| Organizations | `stats.organizationCount` — count of `organizations` rows with `owner_id = host.id` |
| Properties    | `stats.propertyCount` — count of `properties` rows across those org IDs             |
| Parking       | `stats.parkingCount` — count of `parkings` rows across those org IDs                |
| Member since  | Earliest `organizations.created_at` owned by this host                              |

Clicking a host navigates to `/admin/hosts/:hostId/orgs`.

---

## Filters

| Control | Behavior                                                                                                        |
| ------- | --------------------------------------------------------------------------------------------------------------- |
| Search  | Name, email — server-side (`q` query param), URL-persisted via `useSearchParams`. Resets `page` to 1 on change. |
| View    | Table or grid                                                                                                   |

---

## Pagination

Standard admin-list pagination (same pattern as `/bookings`): `page`/`limit` are URL-persisted query params (`?page=&limit=`), default page size is `ADMIN_DEFAULT_PAGE_SIZE` (31), and the per-page selector offers `ADMIN_PAGE_SIZES` (31/50/100). The pager (`AdminListPagination`) renders below the list only when there is more than one page. Changing the per-page limit or the search filter resets to page 1.

`list-hosts` searches and paginates entirely in SQL via the `super_admin_search_hosts` RPC (`searchHostsPage` in `_shared/hostSerialize.ts`) — it never loads the full host list into the edge function. The RPC joins `organizations` (grouped by `owner_id`) with `auth.users` for name/email search, applies `ILIKE` server-side, and returns a `total_count` window column alongside the requested page of rows. The summary cards are computed separately and independently of the search/page (see above), so they always reflect platform totals even while a search is active.

---

## API reference

| Action | Endpoint                                                                                                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List   | `GET list-hosts?q=&page=&limit=` — searched (SQL `ILIKE` via RPC) + paginated host list; returns `{ hosts, total, page, limit, summary }`, `summary` computed independently of `q`/`page` |

---

## Implementation map

| Concern                 | Path                                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                    | `ui/src/features/dashboard/super-admin/pages/SuperAdminHostsPage.tsx`                                                                                                                                 |
| Summary / toolbar       | `ui/src/features/dashboard/super-admin/components/super-admin-hosts/SuperAdminHostsSummaryCards.tsx`, `ui/src/features/dashboard/super-admin/components/super-admin-hosts/SuperAdminHostsToolbar.tsx` |
| Card / table            | `ui/src/features/dashboard/super-admin/components/super-admin-hosts/SuperAdminHostCard.tsx`, `ui/src/features/dashboard/super-admin/components/super-admin-hosts/SuperAdminHostsTable.tsx`            |
| Filters                 | `ui/src/features/dashboard/super-admin/lib/superAdminHostsFilters.ts`                                                                                                                                 |
| Query hooks             | `ui/src/features/dashboard/super-admin/hooks/useHosts.ts`                                                                                                                                             |
| Edge function           | `supabase/functions/list-hosts/index.ts`                                                                                                                                                              |
| Host search / summary   | `supabase/functions/_shared/hostSerialize.ts` (`searchHostsPage`, `loadHostsPlatformSummary`) — `searchHostsPage` calls the `super_admin_search_hosts` RPC                                            |
| Search + pagination RPC | `supabase/migrations/20261106120000_super_admin_hosts_search.sql` (`public.super_admin_search_hosts`) — SECURITY DEFINER, `service_role`-only                                                         |

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
- [Host Detail guide](./host-detail.md)
- [`docs/PROJECT.md`](../../PROJECT.md)

---

## Pending / follow-ups

- [ ] None known.
