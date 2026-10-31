---
title: 'Host Detail — operator guide'
status: active
tags: [guides, routes, admin]
updated: 2026-09-05
---

# Host Detail — operator guide

Route: `/admin/hosts/:hostId`

> **Status:** Documented · redesigned 2026-09-05 from a 2-tab shell (`Organizations` /
> `Properties` routed pill tabs) into **one page** with stat cards, search, a **mode dropdown**
> (replaces the tabs), filters, view toggle, and pagination — the same shape as the other
> super-admin list pages. Old `/admin/hosts/:hostId/orgs` and `…/orgs/properties` URLs redirect
> here.

## Progress overview

| Section       | E2E save | Validation | Docs | Notes                                                                                                     |
| ------------- | -------- | ---------- | ---- | --------------------------------------------------------------------------------------------------------- |
| Header        | Done     | —          | Done | Avatar/initial, name, email, **← Hosts** back link (`SuperAdminDetailHeader`)                             |
| Stat cards    | Done     | —          | Done | Organizations / Properties / Parking slots (`host.stats`) — the first two double as the mode switch       |
| Mode dropdown | Done     | —          | Done | `Organizations` \| `Properties` — replaces the old pill tabs, URL-persisted `?mode=`                      |
| Organizations | Done     | —          | Done | Search + grid/table view + pagination                                                                     |
| Properties    | Done     | —          | Done | Search + org filter (only shown when the host owns >1 org) + status + type + grid/table view + pagination |

---

## Overview

One page per host, listing everything they own. Read-only — no create/edit action for either
organizations or properties from here (that happens in the host's own dashboard, or the
[Organization hub](./orgs.md) for plan/approval/AI actions).

**Access:** `RequireSuperAdmin` (`SUPER_ADMIN_EMAILS`).

---

## Host-facing knowledge

Internal platform-team tooling — a combined lookup of every organization and property a host
owns, across all of their organizations. Hosts never see it.

**Common host questions**

- Q: If I own more than one organization, does the platform team see all of them here?
  A: Yes — every organization you own, and every property under any of them, appears on your host
  profile.
- Q: Can the platform team edit my organization or property settings from here?
  A: No — this page only displays them. Editing happens in your own dashboard, or (for
  plan/verification/support) the platform team's per-organization hub.

---

## Behavior notes

- **Stat cards** (`StatCard` with `active`/`onClick`) double as the mode switch — clicking
  **Organizations** or **Properties** does the same thing as picking it from the dropdown. Clicking
  **Parking slots** does nothing (parking isn't a separate list here yet — it's counted, not
  browsable, from this page).
- **Mode dropdown** replaces the old `SuperAdminSecondaryNav` pill tabs. State lives in
  `?mode=organizations|properties` (default `organizations`); switching modes clears the search
  query and resets to page 1.
- **Organization filter** (Properties mode only): populated from every org this host owns
  (`useHostOrganizations(hostId, 1, 100)`, fetched once regardless of pagination) and hidden
  automatically when the host owns one org or fewer — filtering by org only matters once there's
  more than one to filter between.
- **View toggle** (`SuperAdminListViewToggle`, shared grid/table icons) reuses the existing
  `SuperAdminHostOrgCard` grid / a plain `Organization · Properties · Parking` table for
  Organizations, and the existing `OrgPropertyCard` grid / `OrgPropertyListRow` list for
  Properties — same card components as before, just reachable via one shared toggle instead of a
  view-mode prop baked into each old page.
- Below `lg`, the view is forced to grid (`useAdminMobileGridViewGuard`) — same rule as every other
  super-admin list.

---

## API reference

| Action     | Endpoint                                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host       | `GET get-host?hostId=` — profile + aggregate stats (`organizationCount`/`propertyCount`/`parkingCount`)                                                                                                          |
| Orgs       | `GET list-host-organizations?hostId=&q=&page=&limit=` — organizations owned by this host + per-org property/parking counts, searched + paginated                                                                 |
| Properties | `GET list-host-properties?hostId=&q=&status=&type=&orgId=&page=&limit=` — properties across this host's orgs (optionally narrowed to one), searched + filtered + paginated, with booking/revenue/occupancy stats |

Both list functions filter and paginate at the database level (`.range()` + `{ count: 'exact' }`,
`orgId` an `.in('organization_id', …)` narrowing) — no full-table fetch.

---

## Implementation map

| Concern             | Path                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Page                | `ui/src/features/dashboard/super-admin/components/super-admin-hosts/SuperAdminHostShell.tsx`                       |
| Org card            | `ui/src/features/dashboard/super-admin/components/super-admin-hosts/SuperAdminHostOrgCard.tsx`                     |
| Property card / row | `ui/src/features/dashboard/org/components/org-properties/OrgPropertyCard.tsx`                                      |
| Adapter             | `ui/src/features/dashboard/super-admin/lib/hostPropertyAdapter.ts`                                                 |
| Query hooks         | `ui/src/features/dashboard/super-admin/hooks/useHosts.ts` (`useHost`, `useHostOrganizations`, `useHostProperties`) |
| Edge functions      | `supabase/functions/{get-host,list-host-organizations,list-host-properties}/index.ts`                              |
| Stats aggregation   | `supabase/functions/_shared/propertyListStats.ts`                                                                  |
| Routes              | `ui/src/features/dashboard/super-admin/routes/index.tsx` — single route + a legacy-subroute redirect               |

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
- [Hosts list](./hosts.md)
- [Organizations & Organization hub](./orgs.md) — where plan assignment, verification, and support live
- [Org properties (per-org equivalent)](../org/properties.md)
- [`docs/PROJECT.md`](../../PROJECT.md)

---

## Pending / follow-ups

- [ ] Parking slots stat card is not yet clickable into a browsable parking list for this host.
