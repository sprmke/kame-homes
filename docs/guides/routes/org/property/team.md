---
title: 'Property Team — operator guide'
status: active
tags: [guides, routes, org, property]
updated: 2026-08-28

Route: `/org/:orgSlug/property/:propertySlug/team`

> **Status:** Documented (live — property team module complete; org-level team at `/org/:orgSlug/team` assigns listing access via `assigned_via_org`)

## Progress overview

| Section                 | E2E save | Validation     | Docs       | Notes                                                     |
| ----------------------- | -------- | -------------- | ---------- | --------------------------------------------------------- |
| Stats cards             | ✓        | —              | Documented | From API member/invite counts                             |
| Members tab             | ✓        | —              | Documented | List, role change, activate/deactivate, remove; phone = dense rows + compact ⋯ menu |
| Invitations tab         | ✓        | Email required | Documented | Invite, resend (email), cancel via API                    |
| Permissions tab         | ✓        | —              | Documented | Roles list (⋯ actions) + comparison matrix                |
| Invite dialog           | ✓        | Email required | Documented | Role picker; default Operations                           |
| Host details dialog     | ✓        | —              | Documented | Name, phone, role (no per-member permission tree)         |
| Remove dialog           | ✓        | —              | Documented | Destructive confirm                                       |
| RBAC contract           | —        | —              | Documented | Server mirror + migration                                 |
| Team edge functions     | ✓        | —              | Documented | UI wired via `usePropertyTeam`                            |
| RBAC enforcement        | ✓        | —              | Documented | `property-access` + sidebar/route guards + edge functions |

---

## Overview

Property-scoped **team management**. Members, invitations, and custom roles load from edge functions; mutations invalidate TanStack Query cache.

Org owner and org admins appear in the member list **virtually** (`fromOrg: true`) — not stored in `property_members`. Org-level team lives at `/org/:orgSlug/team`.

Custom role definitions (not members or invitations) are bulk-copyable via org **Properties → Copy settings**.

---

## Host-facing knowledge

Team is where you invite people to help run this property and control what they can see or do. Pick a role (**Full Access**, **Operations**, **Read Only**) or create a custom role. When editing permissions, start from an existing role (**Based on**) then adjust checkboxes.

**Common host questions**

- Q: What's the difference between Full Access and Operations?
  A: Full Access includes finance, settings, team management, and notifications editing. Operations covers bookings and maintenance day-to-day plus inbox replies, but not finance, settings, or team management.
- Q: How do invites work?
  A: Enter their Gmail address (they sign in with Google), choose a role, and they'll get an email link valid for seven days to accept and join this property.
- Q: Can organization owners see my property team list?
  A: Yes. Organization owners and admins show up in the member list automatically with full access, even though they aren't stored as separate property members.
- Q: What happens to my team members if I downgrade my plan?
  A: Nothing is deleted. If your new plan supports fewer members than you currently have active, the most recently added ones are automatically disabled — marked "Plan limit" — until you're back within your plan's limit. Their roles and permissions are saved, not erased. Upgrading again automatically re-enables them, oldest first, with no extra work on your end.

**Plan gating:** Viewing the team is always free. **Send Invitation** is gated by `teamManagement.enabled` and `teamManagement.maxMembers` (active members + pending invites + the owner + any org-level admins with implicit access — all count toward the cap on both client and server). **Free is capped at 1** (the owner alone — same mechanism as every paid tier's cap, not a separate "disabled" state, so the owner already occupies the one slot and any invite attempt hits the at-limit path); Starter/Pro/Business/Managed/Commission raise the cap (see `docs/architecture/plans-feature-matrix.md`). Over the cap navigates to **org Plans & Billing** with review pre-opened (`?feature=teamManagement`) instead of calling `property-team-invitations`; server enforces the same count via **`requireTeamInviteAllowed`**. Client uses **`useFeatureGate` → `canUse`** (fail-closed while entitlements load). **Invite Member** shows a corner plan pill (`TeamInviteTierBadge`) on the page header, members empty state, and invitations empty state when team seats are at cap or team management is gated. **Creating, duplicating, or editing roles** (including seeded default templates) requires **`customRoles`** (Starter+) — Free hosts can still view the Roles card and permissions matrix; **New role** / **Duplicate** / **Edit** open the upgrade modal and the matching edge mutations (`property-team-custom-roles` POST/PATCH/DELETE) return the standard upgrade envelope. **Manually re-activating** an existing inactive member hits the same seat-cap check — it's blocked with an upgrade prompt if it would push the property over budget, not just invite.

**Downgrade / expiration:** if a plan change (downgrade, a lapsed subscription auto-suspending after nonpayment, or being added to/removed from an org portfolio bundle) drops the seat budget below the number of currently active members, the newest-assigned members are **automatically deactivated** (never removed) until the property is back within budget — same as a manual deactivate (permissions stashed, restorable), just server-triggered. These rows show a **"Plan limit"** badge instead of the plain "Disabled" one, and a banner above the member list offers **Upgrade** whenever 1+ members are in that state. Upgrading later (or an admin freeing a seat by deactivating someone else) automatically restores the longest-waiting plan-limited members first, oldest to newest, up to the new budget — no host action required. A member an admin deactivated on purpose is never touched by this and never auto-restored.

---

## RBAC contract (finalized)

### Access kinds

| Kind                | How resolved                                             | Permissions                                        |
| ------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| **Org owner**       | `organizations.owner_id = auth.uid()`                    | Full catalog (implicit; no `property_members` row) |
| **Org admin**       | Active `organization_members` row with `role_id = ADMIN` | Full catalog (implicit; virtual row in team list)  |
| **Platform admin**  | `ADMIN_ALLOWED_EMAILS`                                   | Full catalog (same bypass as today)                |
| **Property member** | Active row in `property_members`                         | `permissions` JSONB on row                         |
| **Inactive member** | Row exists, `status = inactive`                          | None — API access denied                           |

### Member role tier + permission templates

Property team members use a single stored role tier:

| Tier  | UI label | `role_id` literal | Intent                                                                                                                                                                                                                                                                                     |
| ----- | -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin | Custom   | `ADMIN`           | Legacy role id for members whose grants no longer match a seeded/custom template (badge: **Custom**). New invites and role changes use template UUIDs only — create a custom role on the Permissions tab instead of per-member overrides. Empty `permissions: []` is rejected server-side. |

**Permission templates** (seeded per property as rows in `property_custom_roles`):

| Template    | Replaces (legacy) | Intent                                                      |
| ----------- | ----------------- | ----------------------------------------------------------- |
| Full Access | Manager           | Full coarse-catalog grant (all permission ids below)        |
| Operations  | Staff             | Bookings + maintenance ops; no finance/settings/team manage |
| Read Only   | Viewer            | Read-only modules                                           |

Additional custom templates can be created by admins with `team.customRoles:add`. Member/invite **`role_id`** is `ADMIN` (custom permission set) **or** a template UUID.

### Custom roles / templates

- Stored in **`property_custom_roles`** (UUID primary key).
- Member/invite **`role_id`** = `ADMIN` **or** template UUID string.
- Unique name per property (case-insensitive).
- Deleting blocked while members or pending invites reference the role.

### Permission IDs

Canonical list (keep in sync with `propertyTeamConstants.ts` and `_shared/propertyTeamPermissions.ts`). Phases 3–7 use granular leaves through Marketing Studio.

`bookings:view`, `bookings.create:add`, `bookings.import:add`, `bookings.detail.stay:edit`, `bookings.detail.guests:edit`, `bookings.detail.parking:edit`, `bookings.detail.pets:edit`, `bookings.detail.pricing:edit`, `bookings.detail.workflow:edit`, `finance:view`, `finance.transactions:add`, `finance.transactions:edit`, `finance.transactions:delete`, `finance.export:view`, `pricing:view`, `pricing.rates:edit`, `pricing.blocks:add`, `pricing.blocks:delete`, `pricing.channels:view`, `pricing.channels:edit`, `pricing.smartPricing:edit`, `maintenance:view`, `maintenance.reminders:add`, `maintenance.reminders:edit`, `maintenance.reminders:delete`, `maintenance.export:view`, `marketing:view`, `marketing.content:add`, `marketing.content:edit`, `marketing.templates:add`, `marketing.templates:edit`, `marketing.templates:delete`, `marketing.generate:add`, `marketing.generate.image:add`, `marketing.generate.video:add`, `marketing.publish:add`, `notifications:view`, `notifications.chat:edit`, `notifications.marketing:edit`, `notifications.staff:edit`, `notifications.operations:edit`, `notifications.finance:edit`, `notifications.maintenance:edit`, `templates:view`, `templates.standard:edit`, `templates.email:edit`, `templates.custom:add`, `templates.custom:edit`, `templates.custom:delete`, `publicPages:view`, `publicPages.property:edit`, `publicPages.stayGuide:edit`, `publicPages.showcase:edit`, `settings:view`, `settings.integrations:view`, `settings.basicInfo:edit`, `settings.media:edit`, `settings.propertyDetails:edit`, `settings.amenities:edit`, `settings.houseRules:edit`, `settings.guestForm:edit`, `settings.cancellationPolicy:edit`, `settings.location:edit`, `settings.socials:edit`, `settings.payment:edit`, `settings.buildingForms:edit`, `settings.emailAutomations:edit`, `settings.dangerZone:edit`, `team:view`, `team.invitations:add`, `team.invitations:edit`, `team.invitations:delete`, `team.members:edit`, `team.members:delete`, `team.customRoles:add`, `team.customRoles:edit`, `team.customRoles:delete`, `inbox:view`, `inbox.messages:edit`, `inbox.channels:add`, `inbox.channels:delete`, `inbox.quickReplies:add`, `inbox.quickReplies:edit`, `inbox.quickReplies:delete`, `inbox.automation:edit`, `analytics:view`, `analytics:export`, `analytics.aiReview:add`, `assistant:view`, `activity:view`.

Legacy stored ids still expand on read (Phases 3–6): e.g. `notifications:edit` → six module edits; `inbox:reply` → `inbox.messages:edit`; `inbox:manage` → channels/quickReplies/automation leaves; `team:invite` → invitations leaves; `team:manage` → members/customRoles leaves; plus earlier Phase 3–5 umbrellas.

**Overrides:** Client may store any **subset of the catalog** on the member/invite row (can exceed a template preset — e.g. grant `finance:view` on a Read Only member if checkboxes allow).

**Template change:** Server always resets member `permissions` from the selected role template. Per-member `permissions[]` overrides on invite or member PATCH are rejected. Edit grants on the role template (Permissions tab); members on that role sync when the template is saved (matching prior permission key).

**Custom template edit:** When a custom template definition changes, server updates `permissions` on all **active** members with that template `role_id`. Inactive members restore the updated preset on activate (not the old snapshot).

**Added leaves (plan coverage audit):** `marketing.generate.image:add` (Generate tab images, separate from text `marketing.generate:add` and video), `pricing.smartPricing:edit` (Smart Pricing settings, preview, apply), `analytics.aiReview:add` (run the AI review, spends credits), `assistant:view` (dashboard AI assistant), `activity:view` (Settings → Activity). These are **not** read-time expansions: they stay individually revocable. Migration `20261316125000_team_permissions_plan_coverage_leaves.sql` backfilled them onto existing members, roles, and invites that already held the matching source leaf (`marketing.generate:add`, `pricing.rates:edit`, `analytics:export`, `bookings:view`) so nobody lost access.

**Plan pills:** the Team role editor shows each plan-gated leaf with its tier from `PLAN_FEATURE_PERMISSION_COVERAGE` (`ui/src/features/dashboard/plans/lib/planFeaturePermissions.ts`). Every plan feature key is either mapped to leaves or marked N/A there, and a unit test fails when a new plan key is added without a decision.

### Seeded template presets

| Permission                                            | Full Access | Operations | Read Only |
| ----------------------------------------------------- | :---------: | :--------: | :-------: |
| Bookings — view                                       |      ✓      |     ✓      |     ✓     |
| Bookings — create                                     |      ✓      |     ✓      |     —     |
| Bookings — import                                     |      ✓      |     —      |     —     |
| Bookings — detail tabs + workflow                     |      ✓      |     ✓      |     —     |
| Finance — view                                        |      ✓      |     —      |     —     |
| Finance — transactions + export                       |      ✓      |     —      |     —     |
| Pricing — view                                        |      ✓      |     ✓      |     ✓     |
| Pricing — rates / blocks                              |      ✓      |     —      |     —     |
| Maintenance — view                                    |      ✓      |     ✓      |     ✓     |
| Maintenance — reminders + export                      |      ✓      |     ✓      |     —     |
| Marketing — view / content / templates / AI / publish |      ✓      |     ✓      |     —     |
| Notifications — view                                  |      ✓      |     ✓      |     ✓     |
| Notifications — per-module edit                       |      ✓      |     —      |     —     |
| Templates — view                                      |      ✓      |     ✓      |     ✓     |
| Templates — edit                                      |      ✓      |     —      |     —     |
| Settings — view / edit                                |      ✓      |     —      |     —     |
| Team — view                                           |      ✓      |     —      |     ✓     |
| Team — invitations / members / roles                  |      ✓      |     —      |     —     |
| Inbox — view                                          |      ✓      |     ✓      |     ✓     |
| Inbox — messages (reply)                              |      ✓      |     ✓      |     —     |
| Inbox — channels / quick replies / automation         |      ✓      |     —      |     —     |

Effective permissions come from the stored `permissions` array only — no runtime role cap.

Property delete/archive remains **org owner** only — not a property-role permission.

### Deactivate / activate

| State                   | `status`   | `permissions`        | `saved_permissions`        | `plan_limited` |
| ----------------------- | ---------- | -------------------- | -------------------------- | -------------- |
| Active                  | `active`   | Effective grant list | `NULL`                     | `false`        |
| Inactive (manual)       | `inactive` | `[]`                 | Snapshot before deactivate | `false`        |
| Inactive (plan-limited) | `inactive` | `[]`                 | Snapshot before deactivate | `true`         |

On activate: **Template** members restore the **current template preset**. Legacy `ADMIN` members restore `saved_permissions` when present, otherwise the role default. Clear `saved_permissions` and `plan_limited`.

`plan_limited` distinguishes an admin's deliberate deactivate from one team-seat reconciliation (`reconcilePropertyTeamSeats` in `_shared/planEntitlements.ts`) made automatically because the current plan doesn't cover this seat — see **Downgrade / expiration** above. Any manual status change (deactivate or activate) always clears it, so a real admin decision is never overwritten by a later automatic restore.

**Affected member UX:** `property-access` returns **`planLimited: true`** (empty permissions). **`PropertyPlanLimitedGate`** shows **Access paused** — contact the organization or property owner to upgrade the plan and restore access (full-page, no sidebar), with **Home** → **`/org`** (other usable org or onboarding) and **Sign out**. Soft-allow without leaking data: **`list-organizations`** / **`list-properties`** / **`verifyOrgListAccess`** include the member's assigned property so **`RequireOrgContext`** can reach the gate (avoids generic **No organization access**); empty notifications; permissioned property endpoints still **403**.

### Invitations

| Field       | Column        | Rule                                                |
| ----------- | ------------- | --------------------------------------------------- |
| Email       | `email`       | Trimmed; compared case-insensitively on accept      |
| Role        | `role_id`     | Built-in or custom UUID                             |
| Permissions | `permissions` | JSONB; defaults to role preset                      |
| Token       | `token`       | Opaque hex; unique                                  |
| Expiry      | `expires_at`  | **7 days** from send (`PROPERTY_INVITE_TTL_DAYS`)   |
| Status      | `status`      | `pending` \| `accepted` \| `expired` \| `cancelled` |

**Uniqueness:** One **pending** invite per `(property_id, lower(email))`. Block invite if email is already an active member on that property. Block invite/accept if the email or signed-in user already has **organization-level property access** (org owner or active org ADMIN). Failed invite email on create deletes the pending row; failed resend restores the previous token/expiry.

**Accept flow (v1):** Resend email → `/accept-invite?token=…` → preview (org logo, name, property line) → **Sign in with Google** if needed → review **Accept invite** → tap **Accept** → invite email must match session email → upsert `property_members`, mark invite `accepted`. Property-only members have **no org-scoped routes** (sidebar org name is read-only; `/org/:slug/*` redirects to their assigned property). Invitee may already belong to other orgs/properties.

**Pending members:** No `property_members` row until accept — `pending` exists only on invitations.

### Team API permission gates

| Action                                    | Required permission                  |
| ----------------------------------------- | ------------------------------------ |
| List members / invitations / custom roles | `team:view`                          |
| Invite member                             | `team.invitations:add`               |
| Resend invitation                         | `team.invitations:edit`              |
| Cancel invitation                         | `team.invitations:delete`            |
| Update member                             | `team.members:edit`                  |
| Remove member                             | `team.members:delete`                |
| Create / update / delete custom roles     | `team.customRoles:{add,edit,delete}` |

Enforcement on bookings/finance/etc. uses **`verifyPropertyAccess`** on property-scoped edge functions (see **`property-access`** for UI guards). Org routes use **`org-access`** + **`RequireOrgPermission`**; sidebar filtered via **`filterOrgNavSections`**.

When access is revoked (deactivated member, removed from property, or lost org membership), route guards show **`TenantAccessDenied`** instead of redirecting to `/org`: **No property access** (with link to org properties when org slug is known) or **No organization access** (link **Home** → `/org` hub, which re-resolves dashboard or onboarding).

---

## Sections

### Members

- Search by name or email; filter by role (`Full Access`, `Operations`, `Read Only`, custom).
- Non-org members: role badge (read-only) and a single **Manage** dropdown — **Host details** (name, phone, **role**), **Deactivate** / **Activate**, **Remove from Property**.
- Deactivated members: muted row (lower opacity, grayscale avatar, muted name). Deactivated by team-seat reconciliation: **Plan limit** badge (tooltip explains why) in addition to the muted state.
- When 1+ members are currently plan-limited, a banner above the list shows the count with an **Upgrade** button (opens the upgrade modal targeted at `teamManagement`).
- Org owner and org admins (virtual, `fromOrg: true`): no separate Org badge (role + status already convey access). **Manage in org** goes to `/org/:orgSlug/team` when viewer has `org:team:view` — full outline button on `sm+`, compact **⋯** menu on phone (no property-level contact edit).
- Property-managed members: **Manage** outline control on `sm+`; phone uses the same menu behind **⋯**.
- Property members: **Manage** dropdown when caller has `team.members:edit` and/or `team.members:delete`; **role changes only via Host details** (permissions always follow the selected role template — no per-member permission tree). Custom-role CRUD on the **Permissions** tab when `team.customRoles:*`.
- Guest-facing contact resolves from the first active property member with team management leaves (`team.members:*` / `team.customRoles:*`), then org owner team row, then legacy settings.
- Cannot deactivate/remove yourself or the last active member with team management access (org owner still has implicit access).

### Invitations

- List pending invites with role, sent date, expiry (UI dates as e.g. **July 6, 2026**).
- **Resend** requires `team.invitations:edit`; **Cancel** requires `team.invitations:delete` (not the invite leaf alone). Resend rotates token, refreshes expiry, and sends Resend email.

### Permissions

- Matrix of property permissions by role (default Full Access / Operations / Read Only + custom columns).
- **Roles** card — two groups: **Default** and **Custom** (with counts). Title shows a `TierBadge` for `customRoles` when below Starter. No top-level **New role**; create lives on the Custom empty state or Custom group action (both wrapped in `TierBadgeAnchor`). Default rows expose **Duplicate** (desktop) plus **⋯** Edit/Duplicate (no Delete). Custom rows: edit/duplicate/delete via **⋯**. Create/edit/duplicate are client-gated to Starter+.
- Empty custom group: dashed empty row pointing hosts to duplicate a default or **New role** (`team.customRoles:add` + `customRoles` plan).

### Invite Member dialog

| Field | Storage                              | Validation                                                                                           |
| ----- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Email | `property_invitations.email`         | Required, trimmed; **`@gmail.com`** or **`@googlemail.com`** only (Google sign-in)                   |
| Phone | `property_invitations.contact_phone` | Required PH mobile `09XXXXXXXXX`; copied to `property_members` on accept                             |
| Role  | `role_id`                            | Default/custom role UUID (default **Operations**). Permissions always copied from the role template. |

Name comes from the invitee's Google account on accept; edit later via **Host details** on the member row (including role).

### Host details dialog

| Field        | Storage                         | Validation                                                                                                         |
| ------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Name / phone | `display_name`, `contact_phone` | Editable for property-managed members                                                                              |
| Role         | `role_id`                       | Template dropdown; saving a new role resets `permissions` from that template. No per-member permission checkboxes. |

To change what a role can do, edit the role on the **Permissions** tab or create a custom role — not on the member row.

### New / Edit role dialog

Multi-step wizard for **role templates** only (not per member), shared via `CustomRoleFormDialog`:

1. **Details** — role name. Next disabled until name is filled.
2. **Permissions** — **Based on** (defaults to Full Access) above the full permissions tree; changing it updates checkboxes here.
3. **Preview** — role summary + per-module selected counts.

Back (left) · Cancel + Next (right); Create or Save on Preview. Name required to leave Details; at least one permission required to leave Permissions / save.

---

## Database

| Table                   | Purpose                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `property_custom_roles` | Named permission presets per property                                              |
| `property_members`      | `user_id`, `role_id`, `permissions`, `status`, `saved_permissions`, `plan_limited` |
| `property_invitations`  | Pending invites + token + expiry                                                   |

Migrations: `supabase/migrations/20260908120000_property_team_rbac.sql`, `supabase/migrations/20261108140000_property_members_plan_limited.sql` (`plan_limited`)

RLS enabled with **no authenticated policies** — edge functions use `service_role` (same pattern as `finance_line_items`).

---

## API reference

| Action                                             | Endpoint                                               | Method                                    | Permission                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| List members (+ virtual org owner/admins)          | `property-team-members?property_id=`                   | GET                                       | `team:view`                                                                                                                          |
| Update member (role, activate/deactivate, contact) | `property-team-members`                                | PATCH                                     | `team.members:edit` — role change resets permissions from template; per-member permission overrides rejected                         |
| Remove member                                      | `property-team-members?property_id=&memberId=`         | DELETE                                    | `team.members:delete` / `team.customRoles:*`                                                                                         |
| List pending invitations                           | `property-team-invitations?property_id=`               | GET                                       | `team:view`                                                                                                                          |
| Invite member                                      | `property-team-invitations`                            | POST                                      | `team.invitations:add`                                                                                                               |
| Resend invitation                                  | `property-team-invitations`                            | POST `{ action: "resend", invitationId }` | `team.invitations:edit`                                                                                                              |
| Cancel invitation                                  | `property-team-invitations?property_id=&invitationId=` | DELETE                                    | `team.invitations:delete`                                                                                                            |
| List custom roles                                  | `property-team-custom-roles?property_id=`              | GET                                       | `team:view`                                                                                                                          |
| Create custom role                                 | `property-team-custom-roles`                           | POST                                      | `team.customRoles:add` + **`customRoles`** (Starter+)                                                                                |
| Update custom role                                 | `property-team-custom-roles`                           | PATCH                                     | `team.customRoles:edit` + **`customRoles`** (Starter+)                                                                               |
| Delete custom role                                 | `property-team-custom-roles?property_id=&roleId=`      | DELETE                                    | `team.customRoles:delete` + **`customRoles`** (Starter+)                                                                             |
| Accept invitation                                  | `accept-property-invite`                               | POST `{ token }`                          | JWT (invitee email must match). Returns **`{ propertyId, memberId, orgSlug, propertySlug, propertyName }`**.                         |
| Current user access                                | `property-access?property_id=`                         | GET                                       | JWT — returns **`{ accessKind, permissions[], memberId?, orgSlug, propertySlug, propertyName }`** (no specific permission required). |

Auth: Bearer JWT + `verifyPropertyAccess` (`_shared/orgAuth.ts`). `property_id` or body `propertyId` required on team admin endpoints.

**Update member → activate over the seat cap:** PATCH `{ status: 'active' }` on an inactive member runs the same `requireTeamInviteAllowed` check an invite does; if it would exceed `teamManagement.maxMembers`, the response is the standard `{ upgradeHook: true, feature: 'teamManagement' }` envelope (`jsonUpgradeHook`), same shape the client already handles for invite-at-limit.

**Invite email:** On create/resend, `propertyTeamInviteEmail.ts` sends via Resend using the configurable template shell. **Subject:** `{Org name} - {Property name} - Team Invitation`. **Body:** inviter name; `{property} - {unit}` join line as `{name} invites you to join … as {role}`; role description paragraph (Admin or template name from `property_custom_roles`; custom permission sets — scoped-permissions line); expiry; Google sign-in note; accept CTA. Link: **`{PUBLIC_GUEST_APP_ORIGIN}/accept-invite?token=…`**. Deliverability: verify Resend domain (SPF/DKIM/DMARC) on the sending domain to reduce spam-folder placement.

---

**Unsaved changes.** Closing with unsaved edits (X, Esc, outside click, Cancel, or leaving the page) asks to **Save & close**, **Discard**, or **Keep editing**. Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Implementation map

| Concern              | Path                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| Page                 | `ui/src/features/dashboard/team/pages/PropertyTeamPage.tsx`                                                  |
| Data hooks           | `ui/src/features/dashboard/team/hooks/usePropertyTeam.ts`                                                    |
| API client           | `ui/src/features/dashboard/team/lib/teamApi.ts`                                                              |
| Components           | `ui/src/features/dashboard/team/components/*`                                                                |
| UI constants         | `ui/src/features/dashboard/team/lib/propertyTeamConstants.ts`                                                |
| Permission catalog   | `ui/src/features/dashboard/team/lib/propertyPermissionCatalog.ts`                                            |
| Tree helpers         | `ui/src/features/dashboard/team/lib/permissionTreeState.ts`                                                  |
| Permissions tree UI  | `PermissionsTreeView.tsx`, `ApplyTemplatePicker.tsx`, `CustomRoleFormDialog.tsx` (role templates only)       |
| Server RBAC          | `supabase/functions/_shared/propertyTeamPermissions.ts`                                                      |
| Team service         | `supabase/functions/_shared/propertyTeamService.ts`                                                          |
| Seat reconciliation  | `supabase/functions/_shared/planEntitlements.ts#reconcilePropertyTeamSeats`                                  |
| Invite email         | `supabase/functions/_shared/propertyTeamInviteEmail.ts`                                                      |
| Accept page          | `ui/src/features/dashboard/team/pages/AcceptInvitePage.tsx`                                                  |
| Accept API client    | `ui/src/features/dashboard/team/lib/acceptInviteApi.ts`                                                      |
| Permissions hook     | `ui/src/features/dashboard/team/hooks/usePropertyPermissions.ts`                                             |
| Route guards         | `ui/src/features/dashboard/org/components/RequirePropertyPermission.tsx`                                     |
| Access denied UI     | `ui/src/features/dashboard/org/components/TenantAccessDenied.tsx`                                            |
| Org route guards     | `ui/src/features/dashboard/org/components/RequireOrgPermission.tsx`                                          |
| Org permissions hook | `ui/src/features/dashboard/team/hooks/useOrgPermissions.ts`                                                  |
| Nav filtering        | `ui/src/features/dashboard/bookings/lib/adminSidebarNav.ts#filterPropertyNavSections`                        |
| Property access      | `supabase/functions/_shared/orgAuth.ts#verifyPropertyAccess`                                                 |
| Edge functions       | `property-team-members`, `property-team-invitations`, `property-team-custom-roles`, `accept-property-invite` |
| Route                | `ui/src/features/dashboard/routes/index.tsx` (`team`, `accept-invite`)                                       |
| Sidebar nav          | `ui/src/features/dashboard/bookings/lib/adminSidebarNav.ts`                                                  |
| Path helper          | `ui/src/features/dashboard/org/lib/tenantPaths.ts`                                                           |

---

## Testing

| Layer | Path / spec                                                                  | Manual |
| ----- | ---------------------------------------------------------------------------- | ------ |
| Unit  | `ui/src/features/dashboard/team/lib/propertyTeamCatalogDrift.test.ts`        | —      |
| E2E   | `ui/e2e/features/team/propertyTeamNavRbac.spec.ts` (`@smoke` / `@ci`)        | —      |
| E2E   | `ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts` team shell (`@ci`) | —      |
| N/A   | Invite email delivery, accept-invite with real token                         | Resend |

---

## Related docs

- [Route index](./README.md)
- [`docs/PROJECT.md`](../../PROJECT.md) — multi-tenancy + team RBAC
- Org-level team (future): separate org roles (`OWNER`, org `ADMIN`)

---

## Pending / follow-ups

- [x] DB: `property_members`, `property_custom_roles`, `property_invitations`
- [x] RBAC contract + `propertyTeamPermissions.ts` + `verifyPropertyAccess`
- [x] Edge functions: list/invite/update/remove + custom roles + accept invite
- [x] Wire Team UI to API (`usePropertyTeam`)
- [x] Invite email (Resend) + `/accept-invite` page
- [x] Enforce permissions on property-scoped admin edge functions + sidebar/route guards
- [x] Org-level team page (`/org/:orgSlug/team`) + `organization_members`
- [x] Team-seat downgrade/expiration reconciliation (`plan_limited`, `reconcilePropertyTeamSeats`) — auto-disable over-budget members on plan change/suspension, auto-restore on upgrade, never delete
- [ ] Org-level team has no equivalent seat-limit or reconciliation concept yet — org roles aren't plan-gated by count today
