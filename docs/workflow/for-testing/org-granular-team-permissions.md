---
stage: for-testing
title: 'Org Granular Team Permissions — Org Catalog + Listing Assignment'
status: in-progress
tags: [planning, planned, team, rbac, permissions, org]
updated: 2026-09-09
---

# Org Granular Team Permissions — Org Catalog + Listing Assignment

**Status:** In progress — Phases 1–4 enforcement (incl. AI assistant org-tool leaf audit) closed 2026-09-04; Phase 5 QA remains.

## Goal

Bring org-level team management to parity with the finalized property model:

1. **Granular, editable org permissions** for every real org surface (not a fixed Admin preset / read-only matrix).
2. **Listing assignment on invite + manage** — choose which properties and/or parking slots the member can enter, and which **property/parking permission set** they get on those listings.
3. Keep Owner | Admin role simplicity; reuse property's template / tree-UI patterns instead of inventing a third RBAC shape.

## Why now

Property team now has leaf IDs, templates (Full Access / Operations / Read Only), and an editable permissions tree. Org team is still v1:

| Axis                | Property (shipped)                     | Org (today)                                                                                                                              |
| ------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Role                | `ADMIN` + templates                    | `ADMIN` only                                                                                                                             |
| Permissions storage | JSONB leaf array on `property_members` | **None** — fixed `ORG_ROLE_PERMISSIONS.ADMIN` in code                                                                                    |
| Permissions UI      | Editable tree + custom roles           | Read-only matrix                                                                                                                         |
| Listing scope       | One property per membership            | **All** org properties/parkings implicitly (`canListAllProperties: true`, `verifyPropertyAccess` grants full catalog to every org ADMIN) |
| Invite fields       | Email, phone, role/template            | Email, phone, role=`ADMIN`                                                                                                               |

Hosts who invite an "org admin" today accidentally grant full access to every listing. The ask is to invite at org level **and** scope listings + permissions in one flow.

---

## Scope

### In

- Org permission catalog redesign (leaf IDs + tree UI metadata) covering every live org route.
- `organization_members` / `organization_invitations` schema: `permissions` JSONB (+ listing assignment payload).
- Org Team invite + edit-member UX: org permission tree **and** listing picker (properties + parkings).
- Accept-invite path that materializes org membership **and** assigned `property_members` / `parking_members` rows.
- `verifyOrgAccess` / `verifyOrgListAccess` / `verifyPropertyAccess` / parking scope: stop treating every org ADMIN as all-listings + full property catalog.
- Seeded org permission templates (mirror property: Full Access / Operations / Read Only) via `organization_custom_roles` (or equivalent).
- Docs: `docs/guides/routes/org/team.md`, related org route guides, `docs/PROJECT.md`, data-model.
- Access-preserving migration for existing org ADMIN rows (see D8).

### Out

- Rebuilding parking's **leaf** permission catalog (still Manager/Staff/Viewer + coarse IDs until property-plan Phase 9).
- Ownership transfer / making org Settings danger-zone grantable to non-owners.
- Changing plan seat pooling math beyond wiring new org member rows into existing `reconcile*` helpers.
- Property-only invite flow redesign (already shipped).
- Org Inbox (removed — stays removed).

---

## Org feature inventory (grantable surfaces)

Built from `docs/guides/routes/README.md` + live org guides. Only **org-scoped** pages — property/parking modules stay on their own catalogs, reached via listing assignment.

| Page / surface                | Route                        | Current gate                                          | Sections / actions                                                                          | Proposed org leaves                                                                                                                                                                                                       |
| ----------------------------- | ---------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**                 | `/org/:orgSlug/dashboard`    | `org:dashboard:view`                                  | KPIs, charts, recent bookings, pending actions, listings performance, **Add listing**       | `org.dashboard:view`; Add listing delegates to `org.properties:create` / `org.parkings:create`                                                                                                                            |
| **Bookings**                  | `/org/:orgSlug/bookings`     | `org:bookings:view`                                   | Cross-listing list (property + parking), filters, table/card/calendar                       | `org.bookings:view` (data filtered to assigned listings). No create/workflow here — those stay on listing pages.                                                                                                          |
| **Properties**                | `/org/:orgSlug/properties`   | `org:properties:view` (+ create/manage)               | Inventory cards, search/filters, **Add property**, open settings/dashboard, copy guest link | `org.properties:view`, `org.properties:create`, `org.properties:manage` (edit listing metadata from org list / navigate to settings — settings mutations still need property `settings.*` on that property)               |
| **Parkings**                  | `/org/:orgSlug/parkings`     | `org:parkings:view` (+ create/manage)                 | Same pattern as properties                                                                  | `org.parkings:view`, `org.parkings:create`, `org.parkings:manage`                                                                                                                                                         |
| **Team**                      | `/org/:orgSlug/team`         | `org:team:view` / `invite` / `manage`                 | Members, invitations, permissions/templates, invite, deactivate/remove, contact edit        | `org.team:view`, `org.team.members:*`, `org.team.invitations:*`, `org.team.roles:*` (mirror property Team leaf split)                                                                                                     |
| **Settings**                  | `/org/:orgSlug/settings`     | `org:settings:view` / `edit` (danger zone owner-only) | Basic info, Socials, AI platform, AI dashboard assistant, Danger zone                       | `org.settings:view`; `org.settings.basic:edit`, `org.settings.socials:edit`, `org.settings.aiPlatform:edit`, `org.settings.aiAssistant:edit`; **Delete org stays owner-only** (`org:delete` never grantable — hard-coded) |
| **Plans & Billing**           | `/org/:orgSlug/plans`        | view via `org:settings:view`; checkout **owner-only** | View plans, compare, billing history; checkout / downgrade                                  | `org.plans:view` (split from settings). Checkout / apply-downgrade stay **owner-only** (not in grantable catalog)                                                                                                         |
| **Help & Support**            | `/org/:orgSlug/help-support` | baseline (`org:dashboard:view`)                       | Docs, tickets                                                                               | Ungated for any active org member (same as property) — **no new leaf**                                                                                                                                                    |
| **Import** (org bookings CSV) | org bookings / import flows  | `org:import:manage`                                   | Upload/commit                                                                               | `org.import:manage` (keep; align naming with property `bookings.import:add` if desired later)                                                                                                                             |

**Not org surfaces (assignment only):** every `/property/...` and `/parking/...` module — Bookings detail, Finance, Marketing, Inbox, Templates, Public Pages, Notifications, Pricing, Maintenance, Property/Parking Team, Property/Parking Settings. Access = assigned listing membership + that listing's permission set.

---

## Approach (recommended)

### Two-axis grant (org hub + listings)

```
Org invite / manage
├── A. Org hub permissions     → organization_members.permissions[]
│     (dashboard, cross-listing bookings, inventory, team, settings, plans view, import)
└── B. Listing assignment
      ├── Properties[]         → create/update property_members (+ permissions / template)
      ├── Parkings[]           → create/update parking_members (+ permissions / role)
      └── OR "All listings"    → canListAllProperties/Parkings = true; implicit full listing catalogs (today's org Admin behavior)
```

**Why not store listing grants only as UUID arrays on `organization_members`?** Property already has a full RBAC stack (`property_members`, templates, leaf enforcement, seat reconciliation, virtual org rows). Duplicating that on org would drift immediately. Org invite should **orchestrate** property/parking membership rows.

**Why keep "All listings"?** True co-admins (operations managers) still need one-click full access. Default invite can prefer explicit selection; Owner invites can tick **All current & future listings**.

### Role model

- Keep **Owner** (virtual via `organizations.owner_id`) and assignable **Admin** (`role_id = 'ADMIN'`).
- Add **org custom roles / templates** (seed Full Access / Operations / Read Only for **org hub** leaves only).
- Listing permission sets reuse **property** templates (and parking built-ins until parking Phase 9).

### Enforcement changes (critical)

Today (`orgAuth.ts`):

- Active org ADMIN → `canListAllProperties: true`
- Active org ADMIN on any property → `permissions: allTeamPermissions()`

Target:

1. Org ADMIN with **All listings** flag → same as today (implicit full property/parking access).
2. Org ADMIN with **explicit assignments** → `canListAllProperties: false`; property access only via `property_members` (created at invite/accept); parking via `parking_members`.
3. Org hub pages (`list-bookings?org_slug=`, `dashboard-stats`, `list-properties`) filter to assigned listing IDs when not all-listings.
4. Virtual "Org" badge on property/parking team lists: only when member is org ADMIN **and** (all-listings **or** that listing is assigned). Prefer showing managed contact on org team still.

### Invite / manage UX

Extend `OrgInviteMemberDialog` + member Manage dialog (reuse property `PermissionsTreeView` / `EditPermissionsDialog` patterns where possible):

1. Email + phone (unchanged).
2. **Org role / template** + optional org permission tree.
3. **Listings** section:
   - Toggle: All listings | Select listings
   - Multi-select properties + parkings (grouped; search; select-all within type)
   - Per selection (or shared default): property template / parking role
4. Submit creates invitation payload with org permissions + assignment plan; accept materializes rows.

Edit existing member: same listing + permission editors; adding/removing a property updates `property_members` (deactivate vs delete — match property team conventions).

### Migration (access-preserving)

Existing active org ADMINS must keep today's behavior:

- Backfill `permissions` = full Admin org preset (expanded leaf set).
- Set `all_listings = true` (or equivalent) so they keep every property/parking + full catalogs.
- Pending org invitations: same defaults.
- Dry-run diff before ship (same bar as property Phase 1).

---

## Locked decisions (proposed — confirm before `/workflow-start`)

| #   | Decision                                                         | Default proposal                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | Org hub gets granular leaf catalog + editable UI (not docs-only) | **Yes** — parity with property                                                                                                                                                                                                                       |
| O2  | Listing access on org invite/manage                              | **Yes** — picker + All listings                                                                                                                                                                                                                      |
| O3  | How listing grants are stored                                    | **Materialize `property_members` / `parking_members`**; org row stores `all_listings` boolean (+ optional invitation JSON for pending)                                                                                                               |
| O4  | Org Admin with All listings                                      | Implicit full property/parking catalogs (preserve today's co-admin)                                                                                                                                                                                  |
| O5  | Org Admin with selected listings                                 | Hub filtered to those IDs; listing pages use membership permissions only (no silent full catalog)                                                                                                                                                    |
| O6  | Owner-only forever                                               | Org delete, Plans checkout/downgrade — **not** grantable                                                                                                                                                                                             |
| O7  | Org custom templates                                             | Seed Full Access / Operations / Read Only for **org hub** leaves                                                                                                                                                                                     |
| O8  | Existing org Admins                                              | Access-preserving → All listings + full org Admin preset                                                                                                                                                                                             |
| O9  | Parking leaf rebuild                                             | **Out** — assign parkings with current parking roles/permissions                                                                                                                                                                                     |
| O10 | Seat counting                                                    | Assigned property/parking memberships still count toward pooled `teamManagement.maxMembers` (existing reconcile); org row still counts as one org seat — clarify in implementation so double-counting is intentional or avoided (see Open questions) |

---

## Implementation tasks (ordered)

### Phase 0 — Decisions + catalog draft

- [ ] Confirm O1–O10 with product owner
- [ ] Finalize org leaf ID list (table above → exact ids in server/client catalogs)
- [ ] Competitive UX skim for multi-listing invite pickers (Guesty/Hostaway) — short brief only

### Phase 1 — Schema + server catalog

- [ ] Migration: `organization_members.permissions` JSONB; `all_listings` boolean; `saved_permissions` if mirroring property deactivate; invitation columns for permissions + assignment payload
- [ ] Optional: `organization_custom_roles` (id, organization_id, name, permissions)
- [ ] `_shared/orgTeamPermissions.ts` — leaf catalog + presets; mirror `ui/.../orgTeamConstants.ts` + `orgPermissionCatalog.ts`
- [ ] Backfill existing members/invites (O8); dry-run script/log
- [ ] Update `verifyOrgAccess` to use stored permissions (owner/platform still full)

### Phase 2 — Listing assignment orchestration

- [ ] Invite/accept/service: create property_members / parking_members from assignment plan
- [ ] Change `verifyPropertyAccess` / parking access: org ADMIN full catalog **only if** `all_listings`
- [ ] Change `verifyOrgListAccess` / list-properties / list-parkings / list-bookings / dashboard-stats to respect assignment
- [ ] Seat reconcile: document and implement O10 choice

### Phase 3 — Org Team UI

- [ ] Reuse `PermissionsTreeView` with org catalog
- [ ] Org invite dialog: template + tree + listing picker
- [ ] Edit member: org permissions + listings
- [ ] Permissions tab: templates CRUD (like property), not read-only matrix
- [ ] Members table: show listing scope summary (All / N properties · M parkings)

### Phase 4 — Route/UI enforcement + assistant

- [x] Wire org pages to new leaves (`RequireOrgPermission`, in-page gates for create/manage/settings sections)
- [x] Plans view leaf; checkout remains owner-only
- [x] Scoped org admin list filtering — `list-bookings`, `list-parkings`, `dashboard-stats` honor `all_listings` / assigned memberships (2026-09-04)
- [x] Add listing (dashboard + tenant switcher) uses `org.properties:create` / `org.parkings:create` (2026-09-04)
- [x] Org Settings section edit gates + server PATCH leaves (`org.settings.*:edit`) (2026-09-04)
- [x] AI Dashboard Assistant org-scoped tools: update permission checks (D14 pattern) — granular leaves (2026-09-04); legacy coarse ids no longer used in tool RBAC re-checks
- [x] Docs: `org/team.md`, `org/properties.md`, `org/parkings.md`, `org/settings.md`, `org/plans.md`, `org/bookings.md`, `org/dashboard.md` (permission tables refreshed 2026-09-04); `docs/architecture/ai-dashboard-assistant.md` org RBAC columns synced
- [ ] `PROJECT.md` / data-model cross-link polish if needed

### Phase 5 — QA

- [ ] Existing Admin still sees all listings after migration
- [ ] Scoped Admin: only assigned listings in org bookings/dashboard/switcher
- [ ] Property team shows Org badge correctly
- [ ] Invite accept creates both org + listing rows
- [ ] Plan-limited / seat cap still behave

---

## Docs to update

| Doc                                                                                 | Change                                                   |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `docs/guides/routes/org/team.md`                                                    | Granular catalog, listing assignment, invite fields, API |
| `docs/guides/routes/org/{dashboard,bookings,properties,parkings,settings,plans}.md` | Permission leaves                                        |
| `docs/guides/routes/org/property/team.md`                                           | Org virtual member rules when scoped                     |
| `docs/PROJECT.md` / `docs/architecture/data-model.md`                               | Schema + RBAC                                            |
| `docs/workflow/done/granular-team-permissions.md`                                   | Cross-link "org follow-on planned"                       |
| This file → `in-progress/` via `/workflow-start` when coding starts                 |

---

## Open questions

1. **Seat double-count:** If org invite creates an org ADMIN row **and** 3 `property_members` rows, do those count as 1 seat or 4 against `teamManagement.maxMembers`? Recommendation: **1 org seat covers the person**; listing memberships created by org assignment **do not** add extra seats (tag `source: 'org_assignment'` or skip reconcile for those rows). Confirm.
2. **Future listings:** When `all_listings = false` and owner adds a new property later, should scoped admins auto-get it? Recommendation: **No** — only All listings gets future listings; otherwise owner assigns.
3. **Same person already a property member:** Org invite that assigns that property — merge permissions (union / replace / block)? Recommendation: **replace with invite's chosen template** on accept, with UI warning if an existing membership exists.
4. **Parking templates:** Until parking Phase 9, picker uses parking built-in roles (Manager/Staff/Viewer + custom parking roles). OK?
5. **Default invite mode:** All listings (backward compatible) vs Select listings empty (safer)? Recommendation: **Select listings** with helper to "Select all" + explicit All listings toggle for co-admins.

---

## Related

- Property plan (done): [`../done/granular-team-permissions.md`](../done/granular-team-permissions.md)
- Property team guide: [`../../guides/routes/org/property/team.md`](../../guides/routes/org/property/team.md)
- Org team guide (current): [`../../guides/routes/org/team.md`](../../guides/routes/org/team.md)
- Parking team (coarse, assignable): [`../../guides/routes/org/parking/team.md`](../../guides/routes/org/parking/team.md)
