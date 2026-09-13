---
title: 'Organization Team — operator guide'
status: active
tags: [guides, routes, org, team]
updated: 2026-09-10
---

# Organization Team — operator guide

Route: `/org/:orgSlug/team`

> **Status:** Documented (granular org hub RBAC + listing assignment)

## Progress overview

| Section           | E2E save | Validation       | Docs       | Notes                                 |
| ----------------- | -------- | ---------------- | ---------- | ------------------------------------- |
| Stats cards       | ✓        | —                | Documented | From API member/invite counts         |
| Roles / templates | ✓        | Name + perms     | Documented | Seeded + custom org hub templates     |
| Members tab       | ✓        | —                | Documented | Search, scope summary, manage, remove |
| Invitations tab   | ✓        | Email + listings | Documented | Invite, resend, cancel                |
| Permissions tab   | ✓        | Tree + CRUD      | Documented | Editable templates + matrix           |
| Invite dialog     | ✓        | Email + listings | Documented | Org tree + listing picker             |
| Manage dialog     | ✓        | —                | Documented | Contact + org perms + listings        |
| Remove dialog     | ✓        | —                | Documented | Cleans org-assigned listing rows      |
| RBAC              | ✓        | —                | Documented | Granular org leaves + listing scope   |

---

## Overview

Organization-scoped **team management** with **granular org hub permissions** and **listing assignment** (properties + parkings). Members and invitations load from **`org-team-*`** edge functions via **`useOrgTeam`**.

The **org owner** appears virtually (`isOwner: true`). Invited members get:

1. **Org hub permissions** — leaf IDs on `organization_members.permissions` (dashboard, cross-listing bookings, inventory, team, settings sections, plans view). Booking CSV import is **property-only** (`bookings.import:add`).
2. **Listing access** — either **All listings** (`all_listings = true`, current + future) or explicit assignments materialized as `property_members` / `parking_members` with `assigned_via_org = true`.

**Seat counting:** Org admin rows count toward org team seats; org-assigned property/parking rows do **not** add property-pool seats.

Org **delete** and **Plans checkout/downgrade** remain **owner-only** (not grantable).

**Plan gating:** Viewing the team is always free. **Invite Member** at the pooled cap opens the inline upgrade modal (`teamManagement`); **Continue to payment** goes to org Plans. Server enforces via `requireOrgTeamInviteAllowed`. Loading the members list runs seat reconciliation — excess org admins and property members are auto-deactivated with a **Plan limit** badge. **Invite Member** shows a corner plan pill on the page header and empty states when at seat cap. **Creating, duplicating, or editing org permission templates** requires **`customRoles`** (Starter+) — client upgrade modal plus `org-team-custom-roles` POST/PATCH/DELETE.

---

## Host-facing knowledge

Organization **Team** is where the owner invites co-admins who can help run every property in the org. You see who has access, resend or cancel pending invites, and review what owners versus admins can do. Invites must use a Gmail address because sign-in is Google-only. The owner always appears at the top and cannot be removed from this list.

**Common host questions**

- Q: What’s the difference between Owner and Full Access?
  A: The owner always has full org control (including billing and deleting the org). **Full Access** is an inviteable role with org hub permissions and, by default, access to every listing. **Operations** and **Read Only** usually use **Choose listings** so you pick which properties and parkings they can open.
- Q: Why does the invite require a Gmail address?
  A: Hosts sign in with Google. The invite email must match the Google account the person will use to accept.
- Q: Can a teammate invite someone else?
  A: Yes, if their org Team permissions allow invites. They still cannot remove the owner.

---

## Roles

Org team uses **three default templates** per organization (**Full Access**, **Operations**, **Read Only**) stored in `organization_custom_roles`, plus optional custom templates (Starter+).

| Person             | Storage                                        | UI label        | Notes                                                                                                                    |
| ------------------ | ---------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Org owner**      | `organizations.owner_id` (virtual team row)    | **Full Access** | Cannot change role, permissions, or listings from Team; contact fields only via **Manage**. Cannot deactivate or remove. |
| **Invited member** | `organization_members.role_id` = template UUID | Template name   | Assign one of the three defaults or a custom template.                                                                   |

Legacy `ADMIN` / `OWNER` role ids are no longer shown in the UI. Migration `20261231140100_org_team_template_role_ids.sql` maps existing `ADMIN` rows to the closest seeded template by permissions.

Org **delete**, **Plans checkout/downgrade**, and org settings PATCH remain **owner-only** (not grantable via templates).

---

## Tabs

### Members

- Owner appears in the list with **Full Access** (no separate Owner badge).
- Invited members show their template role badge (**Full Access** / **Operations** / **Read Only** / custom).
- Single **Manage** dropdown per row: **Member details** (opens manage dialog — contact only for owner; contact + role + permissions + listings for others), **Deactivate** / **Activate**, **Remove from Organization** (non-owners with manage access).
- Org permissions tree: one module per org hub page (**Dashboard**, **Bookings**, **Properties**, etc.) with **Open page** access control plus granular actions; counts show selected/total leaf permissions (no empty 0/0 modules).

### Invitations

- Pending invites with role, sent date, expiry (UI shows dates as e.g. **July 6, 2026**).
- **Resend** rotates token, refreshes expiry, sends Resend email. Failed resend restores the previous token/expiry.
- **Cancel** marks invitation `cancelled`.
- Members cannot deactivate or remove their own org ADMIN row.

### Permissions

- Seeded templates (**Full Access**, **Operations**, **Read Only**) plus custom templates on Starter+.
- Default templates are created automatically when an org is created (and backfilled on first team load if missing).
- Default templates **cannot be deleted** or renamed via API/UI; duplicates create custom copies.
- Editing a template’s permissions or listing scope updates only members/invites that still match the **previous** template defaults (customized overrides are preserved). Listing scope changes re-sync `assigned_via_org` membership rows for matching members.
- Each template stores **org hub permissions** and a default **listing scope** (`all_listings` or selected properties/parkings with per-listing property roles).
- **Full Access** defaults to **All listings**; other templates default to **Choose listings** (empty until configured).
- **Role Permissions** matrix — org hub modules by template column.
- Roles list shows permission count and listing scope summary (e.g. `All listings`, `2 properties · 1 parking`).

#### Default org permission presets

| Permission                    | Full Access | Operations | Read Only |
| ----------------------------- | :---------: | :--------: | :-------: |
| Org dashboard — view          |      ✓      |     ✓      |     ✓     |
| Properties — view             |      ✓      |     ✓      |     ✓     |
| Properties — add (create)     |      ✓      |     —      |     —     |
| Properties — manage (edit)    |      ✓      |     ✓      |     —     |
| Org settings — view / edit    |      ✓      |     —      |     —     |
| Delete organization           | owner only  |     —      |     —     |
| Team — view / invite / manage |      ✓      |     ✓      |     ✓     |
| Org plans — view              |      ✓      |     —      |     ✓     |

---

## Invite Member dialog

Dialog order: **Email** → **Phone** → **Role** (template dropdown only) → **Listing access**. Matches property invite: no permissions tree on invite — org hub permissions are taken from the selected role template. To change grants, edit the role on the **Permissions** tab or create a custom role.

| Field               | Storage                                  | Validation                                                                                                                                                                                                                          |
| ------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email               | `organization_invitations.email`         | Gmail / Googlemail only                                                                                                                                                                                                             |
| Phone               | `organization_invitations.contact_phone` | PH mobile                                                                                                                                                                                                                           |
| Role / template     | `role_id`                                | `organization_custom_roles.id` (Full Access / Operations / Read Only / custom)                                                                                                                                                      |
| Org permissions     | `permissions` JSONB                      | Always copied from the selected role template (invite + member update); not editable per member                                                                                                                                     |
| All listings        | `all_listings`                           | Radio — includes current + future listings                                                                                                                                                                                          |
| Choose listings     | `listing_assignments`                    | Nested picker — Properties and Parkings sections with checkboxes and per-listing role (both selectable immediately; no per-property role preload)                                                                                   |
| Listing assignments | `listing_assignments`                    | When not all listings: UI stores seeded names **Full Access** / **Operations** / **Read Only**; server resolves each to that property's template UUID on accept/sync. Parking uses the same labels (stored as MANAGER/STAFF/VIEWER) |

Default invite mode: **Select listings** (empty until host picks). **All listings** opt-in for co-admins.

On accept, `accept-org-invite` upserts `organization_members` and calls **`syncOrgListingMemberships`** to create/update org-assigned `property_members` / `parking_members`.

---

## New / Edit role dialog

Dialog order: **Role name** → **Listing access** (org scope only) → **Based on** template picker → **Org permissions** tree.

Same permissions tree as the **Permissions** tab role editor (not used on members). **Based on** loads checkboxes from an existing template or **Custom**. **Listing access** — card with **All listings** / **Choose listings** radio options; choose mode lists org properties and parkings (with selection counts) and **Full Access** / **Operations** / **Read Only** per listing. Name required; at least one org permission required to save. Listing scope is optional (no listings = org hub only until invite overrides).

## Manage member dialog

Dialog order: **Display name** → **Phone** → **Role** (template dropdown) → **Listing access**. No per-member permissions tree — changing the role resets org hub grants from that template. Edit leaves on the **Permissions** tab (role templates) or create a custom role.

PATCH **`org-team-members`** with `{ memberId, displayName?, contactPhone?, roleId?, permissions?, allListings?, listingAssignments?, status? }`. Listing changes re-sync org-assigned rows. Remove deletes org-assigned property/parking memberships for that user in the org. Changing org role pre-fills listing scope from the role template (member can override before save).

---

## API

| Action                            | Function                          | Method            | Auth / body                                                                                                        |
| --------------------------------- | --------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Current user org access           | `org-access?org_slug=`            | GET               | JWT — `permissions[]`, `canListAllProperties`, capability flags                                                    |
| List members (+ virtual owner)    | `org-team-members?org_slug=`      | GET               | `org.team:view`; returns `teamInviteCapacity`                                                                      |
| Update member                     | `org-team-members`                | PATCH             | Role + listing (+ contact); role change resets permissions from template; per-member permission overrides rejected |
| Remove member                     | `org-team-members`                | DELETE            | `{ memberId }` — cleans org-assigned listing rows                                                                  |
| List invitations                  | `org-team-invitations?org_slug=`  | GET               | Same as members                                                                                                    |
| Invite                            | `org-team-invitations`            | POST              | `{ email, contactPhone, roleId, permissions, allListings, listingAssignments }`                                    |
| Resend / cancel invite            | `org-team-invitations`            | POST / DELETE     | Resend: `org.team.invitations:edit`; cancel: `org.team.invitations:delete`                                         |
| Accept invite                     | `accept-org-invite`               | POST              | JWT `{ token }`; syncs listing memberships                                                                         |
| List custom roles                 | `org-team-custom-roles?org_slug=` | GET               | `org.team:view`                                                                                                    |
| Create / update / delete template | `org-team-custom-roles`           | POST/PATCH/DELETE | `org.team.roles:*`                                                                                                 |

Invite email link: `/accept-invite?token=…&scope=org`. **Accept page:** org logo + org name (via **`get-team-invite-preview`**); signed-in users must tap **Accept** (no auto-accept on load). **Subject:** `{Org name} - Team Invitation`. **Body:** inviter, org name, template role label (Full Access / Operations / Read Only / custom), expiry, accept CTA. Branding/from address uses the org’s **first property** (`getFirstPropertyIdForOrg`) — same Resend shell as property invites. If create fails after Resend errors, the pending row is rolled back; use **Resend** on an existing pending invite to retry delivery. Resend API errors surface in the UI toast (not a generic message).

Auth: Bearer JWT + `verifyOrgTeamAccess` (`_shared/orgAuth.ts`). Query **`?org_id=`** or **`?org_slug=`** (UI uses `scopedOrgFunctionsUrl`).

When org access is revoked (deactivated org admin, removed member), **`RequireOrgPermission`** shows **`TenantAccessDenied`** instead of redirecting to `/org`. Plan-limited seats (`organization_members.status = inactive`, `plan_limited = true`) return **`planLimited: true`** from **`org-access`** and show **Access paused** — contact the organization owner to upgrade the plan and restore access (full-page gate in **`OrgAdminShell`**, no sidebar chrome), with **Home** → **`/org`** (other usable org or onboarding) and **Sign out**. The member's role is saved; dashboard access stays off until a seat opens. **Plan seat banner (Members tab):** when members are paused by plan limits, a warning banner (`planLimitedTeamCopy.ts`) offers **Upgrade** (next tier, e.g. Starter when on Free at cap) and **Activate** at cap opens that flow instead of hitting **`upgradeHook`**. **Invite Member** shows a corner plan pill (`TeamInviteTierBadge`) when team seats are at cap or team management is gated. Soft-allow (no permission required): **`org-access`**, **`list-organizations`** (includes plan-limited org admins), **`list-properties`** / **`verifyOrgListAccess`** (empty property set for plan-limited org admins), and **`notifications-list`** / **`notifications-mark-read`** (empty inbox / no-op mark). Permissioned org endpoints still return **403**. **`OrgPlanLimitedGate`** must not mount **`AdminLayout`** on access errors (avoids 403 fan-out from notifications / assistant).

---

## Database

| Table                               | Purpose                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `organization_members`              | Org admins: `permissions`, `all_listings`, `listing_assignments`, `saved_permissions` |
| `organization_invitations`          | Pending invites with same permission/listing payload                                  |
| `organization_custom_roles`         | Org hub templates (Full Access, Operations, Read Only, custom)                        |
| `property_members.assigned_via_org` | Listing grant from org team — excluded from property seat pool                        |
| `parking_members.assigned_via_org`  | Same for parking                                                                      |

Migration: `supabase/migrations/20261209130000_org_team_granular_permissions.sql`

---

## Implementation map

| Area             | Path                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Page             | `ui/src/features/dashboard/team/pages/OrgTeamPage.tsx`                                                                                         |
| Listing picker   | `ui/src/features/dashboard/team/components/OrgListingAssignmentPicker.tsx` (+ `OrgRoleListingAccessSection`)                                   |
| Summary cards    | `ui/src/features/dashboard/team/components/OrgTeamStatsCards.tsx` (`AdminMetricCard`)                                                          |
| Hook             | `ui/src/features/dashboard/team/hooks/useOrgTeam.ts`                                                                                           |
| Org access hook  | `ui/src/features/dashboard/team/hooks/useOrgPermissions.ts`                                                                                    |
| Route guard      | `ui/src/features/dashboard/org/components/RequireOrgPermission.tsx`                                                                            |
| Access denied UI | `ui/src/features/dashboard/org/components/TenantAccessDenied.tsx`                                                                              |
| Edge functions   | `org-access`, `org-team-members`, `org-team-invitations`, `org-team-custom-roles`, `accept-org-invite`                                         |
| Shared server    | `_shared/orgTeamService.ts`, `_shared/orgTeamPermissions.ts`, `_shared/orgTeamListingAssignment.ts`, `_shared/orgLegacyPermissionExpansion.ts` |
| Route            | `ui/src/features/dashboard/routes/index.tsx`                                                                                                   |
| Sidebar          | `ui/src/features/dashboard/bookings/lib/adminSidebarNav.ts` — Org → Team                                                                       |
| Accept page      | `ui/src/features/dashboard/team/pages/AcceptInvitePage.tsx`                                                                                    |

---

## Member activity history

The **Manage Member** dialog (`OrgManageMemberDialog`) embeds `<EntityActivityHistory targetType="member" targetId={member.id} />` below the role / listing-access controls — the recent `team.member_*` / `team.invite_accepted` events for that member, read from `list-activity-log`. Read-only; "Show more" expands. Full org team history is on the [Activity](./activity.md) page.

---

## Testing

| Layer | Path / spec                                                       | Manual              |
| ----- | ----------------------------------------------------------------- | ------------------- |
| Unit  | `ui/src/features/dashboard/team/lib/orgTeamCatalogDrift.test.ts`  | —                   |
| E2E   | `ui/e2e/features/org/orgHubSmoke.spec.ts` team shell load (`@ci`) | Invite email accept |

---

## Related docs

- [Property team](./property/team.md) — property-scoped roles (Manager / Staff / Viewer)
- [`docs/PROJECT.md`](../../PROJECT.md) — multi-tenancy + team RBAC

---

## Pending / follow-ups

- [ ] Org settings / danger zone access for org ADMIN (today owner-only on server)
- [ ] Transfer ownership flow
- [ ] `last_active_at` tracking for org members
