---
title: 'Parking Team — operator guide'
status: active
tags: [guides, routes, org, parking]
updated: 2026-09-27
---

# Parking Team — operator guide

Route: `/org/:orgSlug/parking/:parkingSlug/team`

> **Status:** Documented

## Progress overview

| Section          | E2E save | Validation     | Docs       | Notes                                             |
| ---------------- | -------- | -------------- | ---------- | ------------------------------------------------- |
| Stats cards      | ✓        | —              | Documented | Same component as property team                   |
| Members tab      | ✓        | —              | Documented | Built-in + custom roles; role via Host details    |
| Invitations tab  | ✓        | Email required | Documented | Accept link uses `scope=parking`                  |
| Permissions tab  | ✓        | —              | Documented | Custom roles CRUD + role matrix (same UX)         |
| Invite dialog    | ✓        | Email required | Documented | Manager / Staff / Viewer + custom roles           |
| Host details     | ✓        | —              | Documented | Name, phone, role (no per-member permission tree) |
| Remove dialog    | ✓        | —              | Documented | Label: Remove from Parking                        |
| RBAC enforcement | ✓        | —              | Documented | `parking-access` + route guard + edge APIs        |

---

## Overview

Parking-scoped team management mirrors the property team page:

- Built-in roles: **Manager**, **Staff**, **Viewer**
- **Custom roles** with editable permission presets (`parking_custom_roles`)
- Org owner and org admins appear virtually as **Manager** (`fromOrg: true`) — not editable from parking team
- Members / Invitations / Permissions tabs, invite flow, and custom role form match property team UX (parking-scoped permission catalog only). **New / Edit role** uses the same multi-step wizard: **Details** (name) → **Permissions** (Based on + checkboxes, defaults to Full Access) → **Preview**. Member **role** changes via **Host details**; permissions always follow the role template (no per-member permission tree).

---

## Host-facing knowledge

Parking **Team** controls who can access this slot's dashboard: bookings (when live), pricing, finance, inbox, and settings. Invite managers, staff, or viewers by Gmail address, or create custom roles with a tailored permission set. The organization owner and org admins appear as managers automatically, and you can't edit them from this page.

**Common host questions**

- Q: What’s the difference between Manager, Staff, and Viewer?
  A: Managers have full access including team invites. Staff can handle operational work (e.g. edit bookings and view pricing). Viewers can look but not change sensitive settings.
- Q: Can a parking team member access my properties too?
  A: Only if they’re also invited at the org or property level. Parking invites grant access to **this slot only**.
- Q: Why must invites use Gmail?
  A: Host sign-in is Google-based. The invitee must accept with the same Gmail address you invited.

---

## Standard roles

| Role    | `role_id` | Notes                                                                    |
| ------- | --------- | ------------------------------------------------------------------------ |
| Manager | `MANAGER` | Full parking access; invitable; org owner/admin shown as virtual Manager |
| Staff   | `STAFF`   | Bookings edit, pricing/notifications view                                |
| Viewer  | `VIEWER`  | Read-only + `team:view`                                                  |

Permission presets: `ui/src/features/dashboard/team/lib/parkingTeamConstants.ts` (server mirror: `_shared/parkingTeamPermissions.ts`).

Custom roles store a JSON permission array validated against the same parking catalog.

The catalog includes **`activity:view`** (module "Activity") for Settings → Activity. Built-in Full Access, Operations, and Read Only include it, and existing members with `bookings:view` were backfilled by migration `20261316125000_team_permissions_plan_coverage_leaves.sql`. Parking has no AI assistant leaf: the assistant does not act for parking-only members.

---

## Edge functions

| Function                    | Purpose                                      |
| --------------------------- | -------------------------------------------- |
| `parking-team-members`      | List / update / remove members               |
| `parking-team-invitations`  | List / invite / resend / cancel              |
| `parking-team-custom-roles` | List / create / update / delete custom roles |
| `parking-access`            | Caller permissions for nav guard             |
| `accept-parking-invite`     | Post-OAuth accept (`{ token }`)              |

Query/body scope: **`parking_id`** / **`parkingId`**.

---

**Unsaved changes.** Closing with unsaved edits (X, Esc, outside click, Cancel, or leaving the page) asks to **Save & close**, **Discard**, or **Keep editing**. Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Implementation map

| Concern       | Path                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Page          | `ui/src/features/dashboard/team/pages/ParkingTeamPage.tsx`                                            |
| Shared tabs   | `TeamMembersTab`, `TeamInvitationsTab`, `TeamPermissionsTab` (`scope="parking"`)                      |
| Scope config  | `ui/src/features/dashboard/team/lib/teamScopeConfig.ts`                                               |
| Hooks         | `useParkingTeam`, `useParkingTeamMutations`, `useParkingPermissions`                                  |
| Route guard   | `RequireParkingPermission` + `parkingRoute('team', …)`                                                |
| Accept invite | `AcceptInvitePage` + `acceptInviteApi.acceptParkingInvite`                                            |
| Sidebar       | `buildParkingNavSections` — **Team** item                                                             |
| DB            | `parking_custom_roles`; `parking_members` / `parking_invitations` `role_id` accepts UUID custom roles |

---

## Testing

| Layer | Path / spec                                                                  | Manual        |
| ----- | ---------------------------------------------------------------------------- | ------------- |
| Unit  | `parkingStatusMachine_test.ts`                                               | —             |
| E2E   | [`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs | PayMongo live |
| N/A   | Parking host dashboard shell load                                            | —             |

---

## Related

- Property team: [../property/team.md](../property/team.md)
- Org team: [../team.md](../team.md) (org scope)
