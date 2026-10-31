---
title: 'Super Admin — Feature availability — operator guide'
status: active
tags: [guides, routes, admin]
updated: 2026-10-28
---

# Super Admin — Feature availability

Route: `/admin/feature-availability` (Platform sidebar, **Feature availability**).

> **Status:** Documented · Phase 3 super-admin UI (catalog tree, turn off/edit dialog, overview KPI when any feature is off).

## Progress overview

| Section         | E2E save | Validation    | Docs | Notes                                                                                                     |
| --------------- | -------- | ------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| Feature tree    | Done     | server        | Done | Grouped by module; parent off cascades to children in the list.                                           |
| Turn off / edit | Done     | client+server | Done | Reason, optional message, expected back (Manila), auto restore, banner, super-admin bypass; live preview. |
| Turn on         | Done     | server        | Done | Confirm dialog; clears off fields on the row.                                                             |
| Unused keys     | Done     | server        | Done | Delete rows whose key left the catalog.                                                                   |

**Plans / Team RBAC:** N/A (super-admin only; step-up gated writes on `feature-availability` edge function).

**Page title:** `Kame Homes - Feature availability`

## Behavior

- **GET/PUT/DELETE** `feature-availability` (super-admin, step-up on mutating calls). PUT body uses camelCase (`featureKey`, `isEnabled`, `expectedBackAt`, …).
- Host-facing state is served by `get-feature-availability`; admin saves invalidate that query client-side.
- Turning a **child** on while its **parent** is off returns **409**.
- **Auto restore:** when `expectedBackAt` passes and `autoRestore` is true, the feature is available again at read time; the admin row may still show "Turned back on automatically …" until edited.

## Host-facing knowledge

Super admins can pause specific product areas (Meta inbox actions, channel sync imports, Marketing AI, Analytics AI review, Telegram delivery) without taking the whole app offline.

**Common operator questions**

- Q: Will hosts still see data when a section is off?
  A: Usually yes for read-only surfaces (for example inbox threads). Mutations and background jobs respect the off switch.
- Q: What does super admin bypass do?
  A: Allowlisted super admins can still use the feature while it is off for hosts, when bypass is enabled on that row.

## Implementation map

| Area         | Path                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| Page         | `ui/src/features/dashboard/super-admin/pages/SuperAdminFeatureAvailabilityPage.tsx`  |
| Dialog / row | `ui/src/features/dashboard/super-admin/components/super-admin-feature-availability/` |
| Admin hook   | `ui/src/features/dashboard/super-admin/hooks/useFeatureAvailabilityAdmin.ts`         |
| Edge         | `supabase/functions/feature-availability/index.ts`                                   |
| Plan         | `docs/workflow/done/feature-availability-controls.md`                                |

## Testing

| Layer | Coverage                                                     |
| ----- | ------------------------------------------------------------ |
| Unit  | `featureAvailabilityAdmin.test.ts`, client parity/copy tests |
| E2E   | Not yet (module gating in later phases)                      |
