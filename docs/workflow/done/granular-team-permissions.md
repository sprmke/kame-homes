---
stage: done
title: 'Granular Team Permissions — CRUD-Level Access & Owner/Admin Role Simplification'
status: done
tags: [planning, done, team, rbac, permissions, property]
updated: 2026-08-28
---

# Granular Team Permissions — CRUD-Level Access & Owner/Admin Role Simplification

**Status:** **Done** (2026-08-28). Phases 0–8 shipped. Parking parity remains **Phase 9 stub** (deferred — not blocking closeout). Known historical risk: Phase 7 Marketing member heuristic may over-grant vs Q5 (no strip migration — see Risks).

**Shipped notes:** [`../../archive/todos/shipped/granular-team-permissions.md`](../../archive/todos/shipped/granular-team-permissions.md)

**Updated 2026-08-27:** feature access must check **both** axes from now on — the team member's granular permission grant **and** the org's plan/subscription entitlement, wherever a plan feature key already exists for that surface. See "Plan (subscription) entitlement alignment" below (D16–D20) and the updated task lists in Phases 0–7.

**Scope:** Property-level team permissions only, this round. Org level gets a **docs-accuracy fix only** in Phase 8 (it already satisfies Owner | Admin and keeps its current fixed-preset, non-customizable model — no schema/UI RBAC changes to org this round). Parking is explicitly deferred to **Phase 9 (stub)**, to be picked up once the parking E2E flow ([`../planned/parking-e2e-later-phases.md`](../planned/parking-e2e-later-phases.md)) is finalized.

## Why this exists

Today, property team access is controlled by a role (`MANAGER` / `STAFF` / `VIEWER` + unlimited custom roles) and a flat array of ~21 `module:action` permission ids, each covering an **entire page** (e.g. one `settings:edit` gates all 16 sections of Property Settings, one `notifications:edit` gates all 6 independent Telegram modules). The ask is to make this genuinely granular — every page's sections/sub-features independently configurable, each with its own View/Add/Edit/Delete control where that action applies — while simplifying the role tier itself down to just **Owner | Admin** at both org and property level (org already is; property currently has five effective tiers: implicit Owner, implicit Org Admin, Manager, Staff, Viewer, plus unlimited custom roles). The permissions matrix UI/UX and "create a new role" flow need a redesign to make this manageable without becoming confusing.

## Current-state findings (researched 2026-08-27 — verify file paths with grep before coding, they may have moved)

### Database & server (full detail: see git history / re-run research if stale)

- `organizations.owner_id` is the implicit **Owner** — never a stored role row, always full access.
- `organization_members.role_id` is **already CHECK-locked to the single literal `'ADMIN'`** (`supabase/migrations/20260909120000_org_team.sql`) — org already matches the Owner | Admin target. There is **no `permissions` column on `organization_members`** — every org Admin gets one fixed preset (`ORG_ROLE_PERMISSIONS.ADMIN`, `_shared/orgTeamPermissions.ts`), not customizable per member. The org "Permissions" tab in the UI is a **read-only reference matrix**, not an editor.
- `property_members.role_id` CHECK allows `'MANAGER' | 'STAFF' | 'VIEWER' | <custom-role-uuid>` (`20260908120000_property_team_rbac.sql`). `property_members.permissions` is a **JSONB array of permission-id strings** (already granular-by-id, just coarse-grained ids) — changing role resets to that role's preset; the checkbox UI already lets an admin add/remove individual ids beyond the preset, except `STAFF`, which the server clamps back to its preset regardless of stored value (`capStaffMemberPermissions`, `_shared/orgAuth.ts`).
- `property_custom_roles` (id, property_id, name, `permissions` JSONB array) already exists as a reusable, named permission preset — this is the feature to build on, not replace.
- Canonical property catalog today (21 ids, `_shared/propertyTeamPermissions.ts` / `propertyTeamConstants.ts`): `bookings:{view,edit,workflow}`, `finance:{view,edit}`, `pricing:{view,edit}`, `maintenance:{view,edit}`, `notifications:{view,edit}`, `templates:{view,edit}`, `settings:{view,edit}`, `team:{view,invite,manage}`, `inbox:{view,reply,manage}`, `import:manage`.
- Enforcement: `verifyPropertyAccess(req, propertyId, requiredPermission?)` / `verifyOrgAccess(...)` in `_shared/orgAuth.ts` — resolves owner → platform-admin → org-Admin → `property_members` row, then checks "is this permission id in the resolved set." **This shape does not need to change** — it already supports an arbitrary-size id vocabulary; it just isn't fed one yet.
- UI gates: `RequirePropertyPermission.tsx` / `RequireOrgPermission.tsx` check only the page-level `:view` id (route guard). In-page CRUD gating exists only where a page author remembered to call `hasPropertyPermission`/`hasOrgPermission` with a non-`:view` id — ad hoc today, e.g. `PropertyPricingPage.tsx:76`, `PropertyInboxPage.tsx:26-27`, `BookingsListPage.tsx:157`, `OrgPropertiesPage.tsx:46`.
- Property Team (`EditPermissionsDialog.tsx`, `CustomRoleFormDialog.tsx`, `CustomRolesSection.tsx`, `property-team-custom-roles` edge function) is already the best-precedented module — 3-way `view`/`invite`/`manage` split, real custom-role CRUD. This is the closest existing pattern to what the new system should look like everywhere.
- **Marketing Studio has zero property-team-RBAC today** — gated only by the legacy `ADMIN_ALLOWED_EMAILS` allow-list via `serveAdmin`, completely decoupled from `property_members`/custom roles. Confirmed as a deliberate, documented carve-out declined 2026-08-16 specifically because it would require "touching the permission catalog, built-in role definitions, the custom-role UI, and migrating 6 edge functions" — i.e., exactly this plan.
- **Public Pages has no dedicated permission** — shares `templates:view`/`templates:edit` despite being a distinct nav item/module with its own Page Editor.
- Property delete/archive and org settings/danger-zone are **already hard-coded owner-only**, not part of the permission catalog at all — this boundary must be preserved, not folded into the granular system.
- RBAC logic is **triplicated** today across property / org / parking (`propertyTeamPermissions.ts`, `orgTeamPermissions.ts`, `parkingTeamPermissions.ts`) with no shared abstraction — out of scope to unify now, but Phase 9 should reuse this plan's pattern rather than reinvent one.
- Backlog signal: the Team → Permissions matrix mobile redesign was **explicitly deferred** in `mobile-native-redesign.md` ("Team permissions matrix deferred") — this plan's Phase 2 closes that gap.
- **The AI Dashboard Assistant's tool-calling layer is also gated by this same permission model** (`docs/architecture/ai-dashboard-assistant.md`: "AI Dashboard Assistant tools are gated by the property-team RBAC model," Marketing excluded as a deliberate carve-out). Every module phase below (3–7) must update that module's assistant-tool permission check to the new granular id(s) in the same phase as the UI/server cutover — otherwise the assistant would keep checking an old umbrella id (or, worse, stop checking anything) while a human's in-page controls already enforce the new one, letting the assistant act beyond what its caller could do by hand.
- **New properties, not just existing ones, need the seeded templates.** The property-creation edge function (onboarding + "Add property" flow) must be updated to seed the same three templates going forward — Phase 1's backfill only covers properties that exist on migration day.

### Full page/section/CRUD inventory (property-level, org excluded except where noted)

This is the literal "list them all down" deliverable, built from `docs/guides/routes/org/**` cross-checked against `ui/src/features/dashboard/**`. Doc discrepancies found and folded in below: the canonical permission list in `org/property/team.md` is missing `inbox:*`/`import:manage` (now fixed in Phase 8), and its preset matrix is missing an Inbox/Import row.

| Page                           | Current gate (whole-page)                                                                  | Sections found                                                                                                                                                                                                                                                                                               | CRUD surface per section                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**                  | `bookings:view`                                                                            | Stat cards, mini-calendar, needs-attention/recent-bookings, cash-flow chart, maintenance reminders, transactions-due — each is a **read-out of another module's own data**                                                                                                                                   | View only; "Add Reminder"/"Add Transaction" quick actions delegate to Maintenance/Finance's own Add permission                                          |
| **Bookings List**              | `bookings:view`                                                                            | Summary cards, filters, Table/Card/Kanban/Calendar views, **New booking**, **CSV Import** wizard                                                                                                                                                                                                             | View (list); Add (new booking, CSV import — already has its own `import:manage` id today); Edit/Workflow via row → Booking Detail                       |
| **Booking Detail**             | `bookings:view` / `edit` / `workflow` (already 3-way)                                      | Stay tab, Guests tab (+ Valid ID docs), Parking tab, Pets tab, Pricing tab, Files tab, WorkflowPanel (stage progression), transition actions, automation triggers, AI Summary run/recheck                                                                                                                    | View per tab; Edit per tab; Workflow (Proceed/Return/Mark-complete/Cancel/automation) as its own action, already precedented                            |
| **Finance**                    | `finance:view` / `edit`                                                                    | Summary cards/charts, ledger, **Add Transaction**, row Edit, row Delete (incl. recurring scope), Export report                                                                                                                                                                                               | View; Add; Edit; Delete (currently all bundled into one `edit`); Export (currently plan-gated only, no permission)                                      |
| **Maintenance**                | `maintenance:view` / `edit`                                                                | Summary cards, reminders list, **Add reminder**, row Edit/mark-done, row Delete, Export report                                                                                                                                                                                                               | View; Add; Edit; Delete (currently all bundled); Export (plan-gated only today)                                                                         |
| **Pricing**                    | `pricing:view` / `edit`                                                                    | Calendar grid (read), per-date rate override, **Block/Unblock dates**, rates & fees sidebar                                                                                                                                                                                                                  | View; Edit (rates/fees); Add (block dates); Delete (unblock dates) — currently one flat `edit`                                                          |
| **Property Team**              | `team:view` / `invite` / `manage` (already 3-way)                                          | Members list, role/permission edit, deactivate/remove, Invitations (invite/resend/cancel), Permissions tab (roles reference + **custom role CRUD**)                                                                                                                                                          | View; Add (invite, new custom role); Edit (resend, role/permission change, custom-role edit); Delete (cancel invite, remove member, delete custom role) |
| **Marketing (Content Studio)** | **none — allow-list only**                                                                 | Calendar/Design/Video builder, Templates sidebar (save/rename/move/remove), Generate with AI, Publish to Meta, Recent publishes                                                                                                                                                                              | View; Add/Edit (content, templates); Delete (custom templates); Add (generate, publish) — **entirely net-new permission surface**                       |
| **Guest Inbox**                | `inbox:view` / `reply` / `manage` (already 3-way, but "manage" bundles 3 unrelated things) | Messages (read + reply), Channels (connect/disconnect Meta), Quick replies (CRUD), Automation (AI tone/rules/auto-send)                                                                                                                                                                                      | View; Edit (reply); Add/Delete (channel connect/disconnect); Add/Edit/Delete (quick replies); Edit (automation)                                         |
| **Notifications**              | `notifications:view` / `edit`                                                              | Activity feed (read), **6 independent Telegram modules** (Chat, Marketing, Staff, Operations, Finance, Maintenance) — each with its own enable toggle, bot token/chat ID, schedule/template cards                                                                                                            | View; Edit **per module**, currently one flat `edit` for all six                                                                                        |
| **Templates**                  | `templates:view` / `edit`                                                                  | Standard templates (house-rules/check-in/out/parking-reminders), Email templates (7 keys), Custom templates (up to 20)                                                                                                                                                                                       | View; Edit (standard); Edit (email); Add/Edit/Delete (custom) — currently one flat `edit` for all three groups                                          |
| **Public Pages**               | `templates:view` / `edit` (borrowed)                                                       | Property/listing page editor, Stay Guide page editor                                                                                                                                                                                                                                                         | View; Edit (property page); Edit (stay guide) — **no dedicated permission today**                                                                       |
| **Property Settings**          | `settings:view` / `edit`                                                                   | **16 sections**: Basic Info, Photos & Videos, Property Details, Amenities, House Rules, Guest Form, Cancellation Policy, Location, Socials, Payment (+OTP gate), Building Forms, Email Automations, Integrations (read), Voice Receptionist, AI Overrides, Danger Zone (Archive/Restore + owner-only Delete) | View; Edit per section (currently one flat `edit` for all 16) — Danger Zone **Delete stays hard-owner-only**, not part of this catalog                  |
| **Help & Support**             | none (baseline, everyone)                                                                  | FAQs, Guides, Tickets (create/reply), Ask AI                                                                                                                                                                                                                                                                 | Intentionally ungated today — **no change proposed**, stays baseline access for every active member                                                     |

Org-level pages (Dashboard, Bookings, Properties, Team, Plans & Billing, Settings, Help & Support) were also inventoried but are **out of scope for the granular rebuild this round** — see Scope above. Plans & Billing's actual mutation (checkout) is hard-coded org-owner-only regardless of team permissions and stays that way. Parking pages exist and mirror this exact pattern one layer over — confirmed present, not detailed, per Phase 9.

## Decisions (locked for planning — flag before Phase 1 if any of these reads wrong)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | This plan targets **property-level pages only**. Org gets a docs-accuracy pass (Phase 8); parking is a future stub (Phase 9).                                                                                                                                                                                                                                                                                                                                                                                                                                               | Explicit scope from the ask; org already satisfies Owner\|Admin; avoids tripling effort across three already-duplicated RBAC copies at once.                                                                                                                                                                                                                                                                                                                          |
| D2  | Property built-in roles collapse from `MANAGER`/`STAFF`/`VIEWER` to a single assignable `role_id = 'ADMIN'`, mirroring org exactly. `OWNER`, org-Admin, and platform-admin stay **implicit** (no stored row), unchanged.                                                                                                                                                                                                                                                                                                                                                    | Explicit ask; once granular permissions exist, the role tier no longer needs to encode an access level — it's just "who's a stored team member."                                                                                                                                                                                                                                                                                                                      |
| D3  | `property_custom_roles` stays a first-class feature, reframed as **reusable named permission templates**, not access tiers. The old `MANAGER`/`STAFF`/`VIEWER` presets become three seeded templates named **Full Access** / **Operations** / **Read Only** (grants locked in Phase 0 § Locked decisions) so the "quick sensible default" UX isn't lost.                                                                                                                                                                                                                    | Explicit ask that creating roles stay flexible; templates preserve the fast-path UX the old built-in roles gave without hardcoding tiers into the schema.                                                                                                                                                                                                                                                                                                             |
| D4  | Storage stays a **flat JSON array of leaf permission-id strings** on `property_members.permissions` / `saved_permissions` / `property_invitations.permissions` / `property_custom_roles.permissions` — same shape, bigger vocabulary. No new table, no tree structure in Postgres.                                                                                                                                                                                                                                                                                          | The array-of-strings model already scales to more ids with zero schema risk.                                                                                                                                                                                                                                                                                                                                                                                          |
| D5  | Hierarchy (parent toggle → nested children) is a **UI/catalog-metadata concept only**. Every real permission is a leaf id; a parent checkbox is UI sugar that (de)selects all leaf descendants, with an indeterminate state for partial selection. The **server never reasons about hierarchy** — it only ever checks "is this leaf id in the resolved set."                                                                                                                                                                                                                | Keeps `verifyPropertyAccess` unchanged in shape; avoids inventing implicit-inheritance bugs (e.g. "does `settings:edit` silently imply `settings.dangerZone` access?" — answer must always be no).                                                                                                                                                                                                                                                                    |
| D6  | Each page keeps one umbrella `<module>:view` id as the route-guard/nav-visibility gate (`RequirePropertyPermission` unchanged); every section gets its own nested `<module>.<section>:<action>` id(s) for in-page control. A member with page `:view` but no section grants sees the page shell with sections empty-stated.                                                                                                                                                                                                                                                 | Preserves the existing, working route-guard architecture; adds section granularity without a navigation rewrite.                                                                                                                                                                                                                                                                                                                                                      |
| D7  | Every node exposes only the CRUD actions that actually exist for it — View always; Add/Edit/Delete only where that action exists in the UI. Never force all four on a read-only or create-only surface.                                                                                                                                                                                                                                                                                                                                                                     | The inventory shows several sections have no add/edit/delete at all (e.g. Dashboard, Help & Support) — forcing all four everywhere would create dead toggles.                                                                                                                                                                                                                                                                                                         |
| D8  | Granularity is capped at **"a section a user would recognize as its own thing"** — its own tab, card, modal, or clearly separable action — never per-field. See Granularity Heuristic below.                                                                                                                                                                                                                                                                                                                                                                                | Keeps the catalog usable (tens of nodes per page, not hundreds); matches the ask for "best UI/UX... without confusion."                                                                                                                                                                                                                                                                                                                                               |
| D9  | Marketing Studio and Public Pages, both currently outside property-team RBAC, get their own first-class permission nodes in this overhaul.                                                                                                                                                                                                                                                                                                                                                                                                                                  | Explicit ask for full page/section coverage; both were flagged as real, documented gaps.                                                                                                                                                                                                                                                                                                                                                                              |
| D10 | Plans & Billing (org-level, out of scope anyway), org settings danger-zone, and **property Delete** (Archive/Restore is fine) stay hard-coded owner-only — never added to the grantable catalog.                                                                                                                                                                                                                                                                                                                                                                            | Pre-existing, deliberate, documented boundary; changing it is a different, riskier project.                                                                                                                                                                                                                                                                                                                                                                           |
| D11 | The Phase 1 migration must be **access-preserving**: every existing member/invitation/custom-role row gets backfilled to the exact equivalent leaf-id set for its current effective permissions — verified by a dry-run diff before it ships, not just a default guess.                                                                                                                                                                                                                                                                                                     | "No behavior change on migration day" is non-negotiable any time an access-control model changes.                                                                                                                                                                                                                                                                                                                                                                     |
| D12 | Server enforcement and client UI enforcement for a given module ship **together, in the same phase** (never "all server then all client" globally). Until a module's phase lands, its pages keep checking the **old umbrella id** even after the new leaf ids exist in the catalog/UI.                                                                                                                                                                                                                                                                                      | Avoids a window where a control exists in the UI but isn't enforced (or vice versa) — a page is never half-migrated in production.                                                                                                                                                                                                                                                                                                                                    |
| D13 | Marketing's new permission ids are granted on the **Full Access** and **Operations** seeded templates (and to members whose effective set matches those templates at Phase 7 cutover). **Read Only** and custom/partial sets do **not** get Marketing unless explicitly granted. Org owner / org Admin / platform-admin keep implicit full access as today.                                                                                                                                                                                                                 | Phase 0 user decision (2026-08-27): Marketing should be usable by Admin-equivalent (Full Access) and Operations team members, not owner-only. Overrides the earlier "nobody by default" draft — still not granted to Viewers/Read Only.                                                                                                                                                                                                                               |
| D14 | Every leaf id addition/split touches **three** files in the same commit: the server catalog (`_shared/propertyTeamPermissions.ts`), the client mirror (`propertyTeamConstants.ts`), and that module's AI Dashboard Assistant tool permission check.                                                                                                                                                                                                                                                                                                                         | The server/client duplication already exists and drifts easily; the assistant is a third, easy-to-forget consumer of the same ids (see Current-state findings) — a two-file sync habit silently becomes insufficient the moment a module's assistant tools ship.                                                                                                                                                                                                      |
| D15 | Each of Phases 3–7 is **independently shippable** — the app is fully consistent and working after any one of them lands, whether or not the others have started.                                                                                                                                                                                                                                                                                                                                                                                                            | Confirms the module-by-module rollout (D12) is a real incremental delivery plan, not an all-or-nothing release artificially split into phase headings.                                                                                                                                                                                                                                                                                                                |
| D16 | Formalize the app's existing (but undocumented) precedence between the two independent gates: **team permission is the outer/visibility gate** (a member without it never sees the control at all — no plan/upgrade messaging either); **plan entitlement is the inner/actionability gate** on an already-visible control (disabled + `TierBadge` + `UpgradeModalProvider` on click). If a member lacks permission, the control simply doesn't exist for them — showing "upgrade to unlock" for something the org owner deliberately withheld would be actively misleading. | This is already how the app behaves in the two places both checks compose today (`ui/src/features/dashboard/org/routes/guards.tsx`'s `RequirePropertyPermission` wrapping `RequirePropertySubscriptionAccess`; `PropertyTeamPage.tsx`'s invite button rendering only when `canInvite`, with the plan/seat badge only applied once it does) — this decision just makes that convention explicit and mandatory everywhere the new catalog touches a plan-gated feature. |
| D17 | Add one shared server helper (e.g. `requirePropertyPermissionAndFeature(req, propertyId, permission, feature?)`, built in Phase 1 on top of the existing `verifyPropertyAccess` + `requirePropertyFeature`/`catchPlanFeatureError`) and use it everywhere a new leaf permission id maps to an existing `PlanFeatureKey`, instead of hand-rolling two separate calls per handler.                                                                                                                                                                                            | No such helper exists today — every real example found (`import-ai-map-columns`, `finance-export`, `property-templates-settings`, `social-inbox-settings`) hand-writes the same two-call pattern with two different error idioms (`verifyPropertyAccess` throws, `requirePropertyFeature`/`catchPlanFeatureError` returns a nullable Response) — a documented, repeated source of "forgot the second check" bugs per `plans-feature-matrix.md`'s own gap log.         |
| D18 | Only wire new granular permission nodes to **plan feature keys that already exist** (the 21-key `PlanFeatureKey` catalog in `_shared/planFeatures.ts`). This plan does not add, rename, or re-tier any plan feature.                                                                                                                                                                                                                                                                                                                                                        | Plan/pricing-tier design is owned by `docs/architecture/plans-feature-matrix.md` and its own initiative — this plan only has to make sure the _permission_ side lines up with entitlements that already exist, not invent new monetization boundaries.                                                                                                                                                                                                                |
| D19 | A plan gate can apply to **one sub-action of a permission node**, not the whole node — copy the existing convention (`templates.email:edit`'s Save action is `customTemplates`-gated while Edit/Preview/Reset stay free on every tier; `inbox.quickReplies` list/delete stay free while save/insert is `quickReplies`-gated; `inbox.automation:edit`'s plan check only fires when the specific PATCH would enable auto-send). Do not force an entire node behind a plan gate just because one action under it is monetized.                                                 | Matches the app's real, already-shipped behavior in every confirmed example — generalizing to "gate the whole node" would make several currently-free actions newly paywalled with no product decision behind it.                                                                                                                                                                                                                                                     |
| D20 | The Phase 2 tree UI shows a `TierBadge` next to any node/action whose mapped `PlanFeatureKey` the org's current plan lacks, so an owner understands why granting the permission alone won't unlock the feature. The node stays toggleable — an owner can pre-grant it ahead of upgrading.                                                                                                                                                                                                                                                                                   | Reuses the existing `TierBadge` component (`ui/src/features/dashboard/plans/components/TierBadge.tsx`) rather than inventing a new locked-state visual; keeps the granular-permission and plan-tier stories legible side by side instead of silently doing nothing when an owner grants a permission the org hasn't paid for.                                                                                                                                         |

## Target permission catalog — design

**ID convention:** `<module>.<section>:<action>` for section-level ids (dot-separated path, colon-separated action), `<module>:view` for the page-level umbrella (unchanged convention from today). Actions: `view`, `add`, `edit`, `delete` — only the ones that apply to that node (D7).

### Granularity heuristic (apply per node before adding it to the catalog)

Add a distinct permission node when **any** of these is true:

1. It's already its own tab, card, modal, or standalone action in the UI (a user would describe it as "that section," not "part of that section").
2. There's a plausible real reason to grant one without the other (e.g., a front-desk hire who can create bookings but shouldn't edit financial fields on existing ones; someone who can view Finance numbers on screen but shouldn't be able to export/download them).
3. The action is structurally independent (Add vs Edit vs Delete are rarely the same risk level — deleting a transaction is not the same grant as adding one).

Do **not** add a node for an individual form field, a read-only stat card, or an action with no plausible independent use case. Target ballpark: tens of leaf ids per large page (Settings, Booking Detail), a handful for small ones (Dashboard needs none of its own — see below) — not hundreds across the app.

### Representative catalog shape (full enumeration is a Phase 0 deliverable; this proves the model against the inventory above)

- **Dashboard** — no new ids. Each widget reads its owning module's own `:view` permission (Finance card needs `finance:view`, Maintenance reminders need `maintenance:view`, etc.); quick actions ("Add Reminder"/"Add Transaction") require that module's `:add`.
- **Bookings** — `bookings:view` (list/detail read), `bookings.create:add` (New booking), `bookings.import:add` (CSV import, replaces today's `import:manage` 1:1), `bookings.detail.stay:edit`, `bookings.detail.guests:edit`, `bookings.detail.parking:edit`, `bookings.detail.pets:edit`, `bookings.detail.pricing:edit`, `bookings.detail.workflow:edit` (transitions/automation — the direct successor to today's `bookings:workflow`).
- **Finance** — `finance:view`, `finance.transactions:add`, `finance.transactions:edit`, `finance.transactions:delete`, `finance.export:view`.
- **Maintenance** — `maintenance:view`, `maintenance.reminders:add`, `maintenance.reminders:edit`, `maintenance.reminders:delete`, `maintenance.export:view`.
- **Pricing** — `pricing:view`, `pricing.rates:edit` (per-date overrides + base rates + fee defaults), `pricing.blocks:add`, `pricing.blocks:delete`.
- **Team** — `team:view`, `team.invitations:add`, `team.invitations:edit` (resend), `team.invitations:delete` (cancel), `team.members:edit`, `team.members:delete`, `team.customRoles:add`, `team.customRoles:edit`, `team.customRoles:delete`. (`team.members:*` and `team.customRoles:*` use the Phase 2 confirm dialog — Q6 locked.)
- **Marketing** (net-new) — `marketing:view`, `marketing.content:add`, `marketing.content:edit`, `marketing.templates:add`, `marketing.templates:edit`, `marketing.templates:delete`, `marketing.generate:add`, `marketing.publish:add`.
- **Inbox** — `inbox:view`, `inbox.messages:edit` (reply/AI-suggest send), `inbox.channels:add`, `inbox.channels:delete`, `inbox.quickReplies:add`, `inbox.quickReplies:edit`, `inbox.quickReplies:delete`, `inbox.automation:edit`.
- **Notifications** — `notifications:view`, then one `notifications.<module>:edit` each for `chat`/`marketing`/`staff`/`operations`/`finance`/`maintenance` (6 ids, replacing one flat `edit`).
- **Templates** — `templates:view`, `templates.standard:edit`, `templates.email:edit`, `templates.custom:add`, `templates.custom:edit`, `templates.custom:delete`.
- **Public Pages** (net-new, split from Templates) — `publicPages:view`, `publicPages.property:edit`, `publicPages.stayGuide:edit`.
- **Settings** — `settings:view`, then one `settings.<section>:edit` each for `basicInfo`, `media`, `propertyDetails`, `amenities`, `houseRules`, `guestForm`, `cancellationPolicy`, `location`, `socials`, `payment` (keeps its existing OTP gate **in addition to** this permission), `buildingForms`, `emailAutomations`, `voiceReceptionist`, `aiOverrides`, plus `settings.dangerZone:edit` for Archive/Restore only. `settings.integrations` stays `:view`-only (edits happen on Notifications/AI pages). **Permanent property Delete is never added to this catalog** (D10 — stays hard owner-only).
- **Help & Support** — no new ids; stays baseline/ungated (unchanged).

That's roughly 55–65 leaf ids total, proportionate to the "very detailed but not confusing" goal.

## Target Permissions Matrix UI/UX

- Replace the flat category-checkbox list with a **collapsible tree**: Page → Section → Action, collapsed by default, "Expand all / Collapse all."
- **Three-state toggles at every level** (on / off / indeterminate) — checking a page-level switch selects every leaf beneath it; unchecking any leaf flips its parents to indeterminate. This is the literal "parent toggle, deeply nested if necessary" ask.
- Leaf actions render as a compact toggle-chip row per section (`Finance › Transactions   [View] [Add] [Edit] [Delete]`) rather than one row per permission id, to keep vertical space sane on a 55–65-id catalog.
- Sticky search/filter bar: search by section name; filter to "differs from template" to spot manual overrides at a glance.
- **Template picker** at the top ("Apply Template ▾") replaces today's role `<Select>` — choosing one resets the whole tree to that template's grant, with a confirm step if the current selection already diverges from any saved template. A "Custom" badge appears automatically the moment the live selection no longer matches any saved template (generalizes today's role-diff detection).
- **Manage Templates** as a separate view (list / create / duplicate / edit / delete a template), reusing the same tree component in "editing a template" mode instead of "editing a member" mode.
- Sensitive nodes (`team.members:*`, `team.customRoles:*`) get a subtle warning affordance when toggled on for a non-owner — not a hard block, just a "this member can now manage other members' access" confirm.
- Mobile (≥375px, ≥44×44px targets): collapse to one page per screen with a page picker/stepper instead of one long scroll — this is the item `mobile-native-redesign.md` explicitly deferred.

## Plan (subscription) entitlement alignment

Team permission and plan entitlement are **two independent axes** today — who (RBAC) and what-the-org-pays-for (plan). They already compose correctly in a handful of places (Team invites, CSV import, Finance export, custom templates, Telegram, Meta inbox, marketing watermarking), but only by convention: no shared helper, no documented precedence, and no cross-reference between the `TeamPermissionId`/leaf-id catalog and the `PlanFeatureKey` catalog (`_shared/planFeatures.ts`, 21 keys — confirmed neither catalog references the other anywhere, including in `docs/architecture/plans-feature-matrix.md`, which documents plan gating exhaustively but never mentions RBAC granularity). As this plan multiplies the permission catalog from ~21 to ~55–65 ids, every module phase (3–7) must explicitly check each new node against the existing plan-feature catalog and wire both where one applies — see D16–D20.

### Mapping: new leaf permission ids ↔ existing `PlanFeatureKey`

Built from `_shared/planFeatures.ts` + `plans-feature-matrix.md`, cross-referenced against the catalog in "Representative catalog shape" above. Only ids with a real, already-shipped plan gate are listed — everything else in the catalog is permission-only, unchanged from today.

| New leaf permission id                                                     | `PlanFeatureKey`                                                               | Notes                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bookings.import:add`                                                      | `bookingImport`                                                                | Already combined today via `_shared/importAccess.ts` (bespoke, two calls) — migrate to the D17 helper.                                                                                                                        |
| `finance.export:view`                                                      | `financeReporting`                                                             | Already server-enforced (`finance-export/index.ts`).                                                                                                                                                                          |
| `maintenance.export:view`                                                  | `maintenanceReporting`                                                         | **Client-only today** — no server export endpoint exists (PDF built client-side). Keep client-only unless a server endpoint is added later; not new scope here.                                                               |
| `templates.custom:add` / `templates.email:edit` (Save action only)         | `customTemplates`                                                              | Gate applies to **Save/Create only** (D19) — Edit/Preview/Reset of standard + email templates stay free on every tier.                                                                                                        |
| `publicPages.property:edit` / `publicPages.stayGuide:edit` (autosave only) | `publicPagesAutosave`                                                          | Gate applies to **autosave behavior only**, not manual edit/save. Note: 3 other autosave call sites are a documented pre-existing gap (`plans-feature-matrix.md`) — worth closing while Phase 5 already touches this surface. |
| `settings.voiceReceptionist:edit`                                          | `aiReceptionist`                                                               | Whole section already hidden unless the plan has it — no change in behavior, just re-point at the new id.                                                                                                                     |
| `settings.aiOverrides:edit`                                                | `aiMonthlyCreditAllowance` (> 0)                                               | Same — section already hidden without AI credits.                                                                                                                                                                             |
| `team.invitations:add`                                                     | `teamManagement.maxMembers` (pooled seat cap, numeric)                         | **The reference pattern to copy everywhere else** — `PropertyTeamPage.tsx`'s invite button already does D16 correctly (`canInvite` gates the button's existence; the seat cap gates its badge/disable/upgrade-modal).         |
| `notifications.{chat,marketing,staff,operations,finance,maintenance}:edit` | `telegramNotifications`                                                        | One shared org-plan flag across all six new per-module ids — no per-module split on the plan side.                                                                                                                            |
| `inbox.channels:add` / `inbox.channels:delete`                             | `metaChatChannel`                                                              |                                                                                                                                                                                                                               |
| `inbox.quickReplies:add` / `inbox.quickReplies:edit`                       | `quickReplies`                                                                 | List/delete of existing quick replies stay free (D19); only save/insert of new ones is gated.                                                                                                                                 |
| `inbox.automation:edit` (auto-send-enable specifically)                    | `aiChatAutoReply`                                                              | Conditional today (`social-inbox-settings`) — the plan check only fires when the specific PATCH would enable auto-send, not on every automation edit.                                                                         |
| `marketing:view`, `marketing.content:add` / `:edit`                        | `marketingStudio`                                                              |                                                                                                                                                                                                                               |
| `marketing.generate:add`                                                   | `aiMarketingGeneration`                                                        |                                                                                                                                                                                                                               |
| `marketing.publish:add`                                                    | `marketingStudio` + `marketingPublishLimitPerGroup` (numeric cap, not boolean) |                                                                                                                                                                                                                               |
| `marketing.templates:add` / `:edit`                                        | `customTemplates`                                                              | Q7 locked Phase 7. `:delete` is permission-only.                                                                                                                                                                              |
| `marketing.templates:delete`                                               | _(none)_                                                                       | Permission-only.                                                                                                                                                                                                              |

Everything else in the catalog — Dashboard, all of Booking Detail's tabs, Finance/Maintenance transaction Add/Edit/Delete, Pricing, Team members/custom-role Edit/Delete, and 12 of Property Settings' 14 sections — has **no existing plan feature key** and stays permission-only, exactly as it behaves today.

## Phase overview

| Phase | Focus                                               | Ships                                                                             |
| ----- | --------------------------------------------------- | --------------------------------------------------------------------------------- |
| 0     | Foundations & decisions                             | Finalized catalog spec, migration mapping table, seeded template grants — no code |
| 1     | Role simplification + data migration                | `role_id = 'ADMIN'` only, access-preserving backfill, docs                        |
| 2     | Permissions Matrix UI/UX rebuild (infra)            | New tree component + template manager, rendered against the still-flat catalog    |
| 3     | Bookings granular rollout                           | List + Detail catalog, server + client enforcement                                |
| 4     | Finance, Maintenance & Pricing granular rollout     | Catalog + enforcement for all three                                               |
| 5     | Settings, Public Pages & Templates granular rollout | The largest single cutover (16 Settings sections)                                 |
| 6     | Team, Notifications & Inbox granular rollout        | Catalog + enforcement for all three                                               |
| 7     | Marketing granular rollout                          | Net-new RBAC; Full Access + Operations templates include it                       |
| 8     | Docs, QA, full-catalog cleanup                      | Route guides, data-model.md, stale-doc fixes, end-to-end verification             |
| 9     | Future: Parking parity (stub)                       | Deferred until parking E2E is finalized                                           |

Phases 3–7 can ship in any order and each leaves the app fully working on its own (D15) — the sequence above is a suggested default (roughly smallest/most-precedented module first), not a hard dependency chain, except that all of them depend on Phases 0–2 being done first.

---

## Phase 0 — Foundations & Decisions

**Goal:** Lock every open design question so Phase 1 can start from a frozen spec. No code.

**Status:** Locked 2026-08-27 (questionnaire). Deliverable below is the frozen input to Phases 1–7.

### Tasks

- [x] Resolve Open Questions 1–6 with the user (Q7 deferred to Phase 7 — see below).
- [x] Write the full leaf-id catalog (literal final list with label / description / module / action).
- [x] Name and define the seeded templates that replace `MANAGER`/`STAFF`/`VIEWER`.
- [x] Write the migration mapping table: old id → new leaf id(s), and old role preset → new template grant.
- [x] Confirm Phase 1 → 2 → 3–7 sequencing still correct once the full catalog is written out.
- [x] Define the TypeScript shape for catalog node metadata that Phase 2 consumes.
- [x] Pin `marketing.templates:*` → `customTemplates` for add/edit; delete is permission-only (Q7 — resolved Phase 7).

**Success criteria:** this section is the single reviewed source for catalog, mapping, templates, and metadata shape — Phases 1–7 do not invent design mid-flight.

### Locked decisions (questionnaire 2026-08-27)

| #   | Question                                                              | Decision                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Seeded template names                                                 | **Full Access** (ex-Manager), **Operations** (ex-Staff), **Read Only** (ex-Viewer). Grants map from today's `BUILTIN_ROLE_PERMISSIONS` / `ROLE_PERMISSIONS`, then expand via the mapping table as leaf ids land.                                                                                                       |
| Q2  | Shared fields (Photos, Amenities, House Rules, Cancellation, Socials) | **One shared id** per field — Settings / Public Pages / Templates surfaces all check the same `settings.<section>:edit` leaf. No duplicate toggles.                                                                                                                                                                    |
| Q3  | Notifications shared bot-token card                                   | Editable if the member has **any one** of the six `notifications.<module>:edit` grants.                                                                                                                                                                                                                                |
| Q4  | Booking Detail Guests tab                                             | **One** `bookings.detail.guests:edit` covers guest fields + Valid ID docs. Split later only if a real privacy request appears.                                                                                                                                                                                         |
| Q5  | Marketing default                                                     | **Full Access** and **Operations** templates include Marketing leaf ids (Phase 7). Read Only does not. At Phase 7 cutover, backfill Marketing onto members whose effective set matches Full Access or Operations (former Manager/Staff presets). Custom/partial sets stay without Marketing unless explicitly granted. |
| Q6  | Sensitive Team permissions                                            | **Confirm dialog** when toggling on `team.members:*` / `team.customRoles:*` for a non-owner: "This member can manage other members' access."                                                                                                                                                                           |
| Q7  | `marketing.templates:*` plan key                                      | **Locked** (Phase 7): `marketing.templates:add` / `:edit` → `customTemplates`; `:delete` permission-only.                                                                                                                                                                                                              |

### Sequencing confirmation

Still correct:

1. **Phase 1** — collapse roles to `ADMIN`, seed three templates against the **current (coarse) catalog**, access-preserving backfill of `role_id` only (permission arrays keep old ids until each module phase remaps them).
2. **Phase 2** — tree UI against the still-coarse catalog (no new leaf ids yet).
3. **Phases 3–7** — add leaf ids module-by-module; expand template grants + remap member/invite/custom-role arrays via the mapping table in the same phase as enforcement (D11/D12).

Marketing leaf ids do not exist until Phase 7; Phase 1 templates therefore omit them, and Phase 7 adds them to Full Access + Operations per Q5.

### Catalog node metadata shape (Phase 2 contract)

```ts
/** Action verbs that may appear on a leaf. Only list ones that apply (D7). */
type PermissionAction = 'view' | 'add' | 'edit' | 'delete';

/**
 * Catalog tree node. Hierarchy is UI-only (D5) — server stores/checks leaf `id`s only.
 * `parentId: null` = page root (module umbrella). Non-leaf nodes have `id: null`
 * and exist only so the tree can render parents / indeterminate state.
 */
type PermissionCatalogNode = {
  /** Leaf permission id, e.g. `finance.transactions:add`. Null for group/page parents. */
  id: TeamPermissionId | null;
  /** Stable key for tree identity even when `id` is null, e.g. `finance`, `finance.transactions`. */
  key: string;
  parentKey: string | null;
  module: string; // e.g. 'bookings' | 'finance' | …
  label: string;
  description?: string;
  /** Set only on leaves. */
  action?: PermissionAction;
  /** Display order among siblings (ascending). */
  order: number;
  /** Phase 2 sensitive confirm (Q6). */
  sensitive?: boolean;
  /** Optional plan feature for TierBadge (D20). Sub-action-only gates stay in code (D19). */
  planFeatureKey?: PlanFeatureKey;
};

type PermissionCatalog = readonly PermissionCatalogNode[];
```

Client and server both export the leaf-id union (`TeamPermissionId`); only the client (and Phase 2 tree data file) needs the full `PermissionCatalog` tree metadata.

### Full leaf-id catalog (final)

Umbrella `:view` ids remain the route/nav gate (D6). Leaves below are in-page. Dashboard and Help & Support have **no** catalog nodes of their own.

| id                                 | Label                     | Description                                                                 | Module        |
| ---------------------------------- | ------------------------- | --------------------------------------------------------------------------- | ------------- |
| `bookings:view`                    | View Bookings             | List + detail read                                                          | bookings      |
| `bookings.create:add`              | Create booking            | New booking                                                                 | bookings      |
| `bookings.import:add`              | Import bookings           | CSV import (replaces `import:manage`)                                       | bookings      |
| `bookings.detail.stay:edit`        | Edit stay                 | Stay tab fields                                                             | bookings      |
| `bookings.detail.guests:edit`      | Edit guests               | Guests tab + Valid ID docs                                                  | bookings      |
| `bookings.detail.parking:edit`     | Edit parking              | Parking tab                                                                 | bookings      |
| `bookings.detail.pets:edit`        | Edit pets                 | Pets tab                                                                    | bookings      |
| `bookings.detail.pricing:edit`     | Edit booking pricing      | Pricing tab on detail                                                       | bookings      |
| `bookings.detail.workflow:edit`    | Run workflow              | Transitions / automation (ex-`bookings:workflow`)                           | bookings      |
| `finance:view`                     | View Finance              | Dashboard + ledger read                                                     | finance       |
| `finance.transactions:add`         | Add transaction           |                                                                             | finance       |
| `finance.transactions:edit`        | Edit transaction          |                                                                             | finance       |
| `finance.transactions:delete`      | Delete transaction        |                                                                             | finance       |
| `finance.export:view`              | Export finance            | Report export                                                               | finance       |
| `maintenance:view`                 | View Maintenance          |                                                                             | maintenance   |
| `maintenance.reminders:add`        | Add reminder              |                                                                             | maintenance   |
| `maintenance.reminders:edit`       | Edit reminder             | Incl. mark-done                                                             | maintenance   |
| `maintenance.reminders:delete`     | Delete reminder           |                                                                             | maintenance   |
| `maintenance.export:view`          | Export maintenance        |                                                                             | maintenance   |
| `pricing:view`                     | View Pricing              | Calendar + rates read                                                       | pricing       |
| `pricing.rates:edit`               | Edit rates                | Per-date overrides, base rates, fee defaults                                | pricing       |
| `pricing.blocks:add`               | Block dates               |                                                                             | pricing       |
| `pricing.blocks:delete`            | Unblock dates             |                                                                             | pricing       |
| `team:view`                        | View Team                 |                                                                             | team          |
| `team.invitations:add`             | Invite members            |                                                                             | team          |
| `team.invitations:edit`            | Resend invitation         |                                                                             | team          |
| `team.invitations:delete`          | Cancel invitation         |                                                                             | team          |
| `team.members:edit`                | Edit members              | Role / permissions (sensitive)                                              | team          |
| `team.members:delete`              | Remove members            | Sensitive                                                                   | team          |
| `team.customRoles:add`             | Create template           | Sensitive                                                                   | team          |
| `team.customRoles:edit`            | Edit template             | Sensitive                                                                   | team          |
| `team.customRoles:delete`          | Delete template           | Sensitive                                                                   | team          |
| `marketing:view`                   | View Marketing            |                                                                             | marketing     |
| `marketing.content:add`            | Add content               | Calendar / design / video                                                   | marketing     |
| `marketing.content:edit`           | Edit content              |                                                                             | marketing     |
| `marketing.templates:add`          | Add marketing template    |                                                                             | marketing     |
| `marketing.templates:edit`         | Edit marketing template   |                                                                             | marketing     |
| `marketing.templates:delete`       | Delete marketing template |                                                                             | marketing     |
| `marketing.generate:add`           | Generate with AI          |                                                                             | marketing     |
| `marketing.publish:add`            | Publish to Meta           |                                                                             | marketing     |
| `inbox:view`                       | View Inbox                |                                                                             | inbox         |
| `inbox.messages:edit`              | Reply                     | Reply + AI-suggest send (ex-`inbox:reply`)                                  | inbox         |
| `inbox.channels:add`               | Connect channel           |                                                                             | inbox         |
| `inbox.channels:delete`            | Disconnect channel        |                                                                             | inbox         |
| `inbox.quickReplies:add`           | Add quick reply           |                                                                             | inbox         |
| `inbox.quickReplies:edit`          | Edit quick reply          |                                                                             | inbox         |
| `inbox.quickReplies:delete`        | Delete quick reply        |                                                                             | inbox         |
| `inbox.automation:edit`            | Edit automation           | AI tone / rules / auto-send                                                 | inbox         |
| `notifications:view`               | View Notifications        |                                                                             | notifications |
| `notifications.chat:edit`          | Edit Chat Telegram        |                                                                             | notifications |
| `notifications.marketing:edit`     | Edit Marketing Telegram   |                                                                             | notifications |
| `notifications.staff:edit`         | Edit Staff Telegram       |                                                                             | notifications |
| `notifications.operations:edit`    | Edit Operations Telegram  |                                                                             | notifications |
| `notifications.finance:edit`       | Edit Finance Telegram     |                                                                             | notifications |
| `notifications.maintenance:edit`   | Edit Maintenance Telegram |                                                                             | notifications |
| `templates:view`                   | View Templates            |                                                                             | templates     |
| `templates.standard:edit`          | Edit standard templates   | House rules / check-in/out / parking reminders                              | templates     |
| `templates.email:edit`             | Edit email templates      | 7 keys                                                                      | templates     |
| `templates.custom:add`             | Add custom template       |                                                                             | templates     |
| `templates.custom:edit`            | Edit custom template      |                                                                             | templates     |
| `templates.custom:delete`          | Delete custom template    |                                                                             | templates     |
| `publicPages:view`                 | View Public Pages         |                                                                             | publicPages   |
| `publicPages.property:edit`        | Edit property page        | Listing page editor shell / layout (shared listing fields use `settings.*`) | publicPages   |
| `publicPages.stayGuide:edit`       | Edit stay guide page      |                                                                             | publicPages   |
| `settings:view`                    | View Settings             |                                                                             | settings      |
| `settings.basicInfo:edit`          | Edit basic info           |                                                                             | settings      |
| `settings.media:edit`              | Edit photos & videos      | **Shared** — also gates Public Pages media                                  | settings      |
| `settings.propertyDetails:edit`    | Edit property details     |                                                                             | settings      |
| `settings.amenities:edit`          | Edit amenities            | **Shared**                                                                  | settings      |
| `settings.houseRules:edit`         | Edit house rules          | **Shared** — also Templates / Public Pages                                  | settings      |
| `settings.guestForm:edit`          | Edit guest form           |                                                                             | settings      |
| `settings.cancellationPolicy:edit` | Edit cancellation policy  | **Shared**                                                                  | settings      |
| `settings.location:edit`           | Edit location             |                                                                             | settings      |
| `settings.socials:edit`            | Edit socials              | **Shared**                                                                  | settings      |
| `settings.payment:edit`            | Edit payment              | Plus existing OTP-to-owner gate                                             | settings      |
| `settings.buildingForms:edit`      | Edit building forms       |                                                                             | settings      |
| `settings.emailAutomations:edit`   | Edit email automations    |                                                                             | settings      |
| `settings.voiceReceptionist:edit`  | Edit voice receptionist   |                                                                             | settings      |
| `settings.aiOverrides:edit`        | Edit AI overrides         |                                                                             | settings      |
| `settings.dangerZone:edit`         | Archive / restore         | Not permanent delete (D10)                                                  | settings      |
| `settings.integrations:view`       | View integrations         | Read-only section; edits live on Notifications / AI                         | settings      |

**Count:** ~72 leaf ids (including umbrellas). Shared-field decision (Q2) avoids duplicating media/amenities/houseRules/cancellation/socials under `publicPages.*`.

### Migration mapping — old id → new leaf id(s)

Used by each module phase when that old umbrella is retired. Until a module phase ships, code keeps checking the **old** id (D12).

| Old id               | Expands to (access-preserving)                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bookings:view`      | `bookings:view`                                                                                                                                                                          |
| `bookings:edit`      | `bookings.create:add`, `bookings.detail.stay:edit`, `bookings.detail.guests:edit`, `bookings.detail.parking:edit`, `bookings.detail.pets:edit`, `bookings.detail.pricing:edit`           |
| `bookings:workflow`  | `bookings.detail.workflow:edit`                                                                                                                                                          |
| `import:manage`      | `bookings.import:add`                                                                                                                                                                    |
| `finance:view`       | `finance:view`                                                                                                                                                                           |
| `finance:edit`       | `finance.transactions:add`, `finance.transactions:edit`, `finance.transactions:delete`, `finance.export:view`                                                                            |
| `maintenance:view`   | `maintenance:view`                                                                                                                                                                       |
| `maintenance:edit`   | `maintenance.reminders:add`, `maintenance.reminders:edit`, `maintenance.reminders:delete`, `maintenance.export:view`                                                                     |
| `pricing:view`       | `pricing:view`                                                                                                                                                                           |
| `pricing:edit`       | `pricing.rates:edit`, `pricing.blocks:add`, `pricing.blocks:delete`                                                                                                                      |
| `team:view`          | `team:view`                                                                                                                                                                              |
| `team:invite`        | `team.invitations:add`, `team.invitations:edit`, `team.invitations:delete`                                                                                                               |
| `team:manage`        | `team.members:edit`, `team.members:delete`, `team.customRoles:add`, `team.customRoles:edit`, `team.customRoles:delete`                                                                   |
| `inbox:view`         | `inbox:view`                                                                                                                                                                             |
| `inbox:reply`        | `inbox.messages:edit`                                                                                                                                                                    |
| `inbox:manage`       | `inbox.channels:add`, `inbox.channels:delete`, `inbox.quickReplies:add`, `inbox.quickReplies:edit`, `inbox.quickReplies:delete`, `inbox.automation:edit`                                 |
| `notifications:view` | `notifications:view`                                                                                                                                                                     |
| `notifications:edit` | `notifications.chat:edit`, `notifications.marketing:edit`, `notifications.staff:edit`, `notifications.operations:edit`, `notifications.finance:edit`, `notifications.maintenance:edit`   |
| `templates:view`     | `templates:view`, `publicPages:view`                                                                                                                                                     |
| `templates:edit`     | `templates.standard:edit`, `templates.email:edit`, `templates.custom:add`, `templates.custom:edit`, `templates.custom:delete`, `publicPages.property:edit`, `publicPages.stayGuide:edit` |
| `settings:view`      | `settings:view`, `settings.integrations:view`                                                                                                                                            |
| `settings:edit`      | All `settings.<section>:edit` leaves listed above (incl. `settings.dangerZone:edit`; never property Delete)                                                                              |
| _(none — net-new)_   | All `marketing:*` leaves — granted only via Full Access / Operations templates at Phase 7 (Q5), not via old-id expansion                                                                 |

**Remap algorithm (per member / invite / custom role / template row):** start from the stored old-id set; for each old id present, union its expansion; drop retired old ids once that module phase has cut over; never remove a leaf the member already had from a prior phase.

### Seeded templates (final intended grants)

| Template        | Replaces | Intent                                                                                                                                                                                                                                                                                                       |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Full Access** | Manager  | Every leaf in the catalog, including all Marketing ids                                                                                                                                                                                                                                                       |
| **Operations**  | Staff    | Bookings (view + create + all detail edits + workflow), Maintenance (all), Notifications view only, Templates view only, Pricing view only, Inbox (view + reply), **Marketing (all)** — no Finance, no Team manage, no Settings edit, no import, no notification module edits, no templates/publicPages edit |
| **Read Only**   | Viewer   | `bookings:view`, `maintenance:view`, `notifications:view`, `templates:view`, `publicPages:view`, `pricing:view`, `team:view`, `inbox:view` — no Marketing                                                                                                                                                    |

**Phase 1 seed (coarse catalog still live):** grant the **old-id** equivalents of the rows above (Manager / Staff / Viewer presets from `ROLE_PERMISSIONS`), without Marketing. **Phase 7** appends Marketing leaves to Full Access + Operations template rows and to members whose effective set matches those templates (former Manager/Staff).

**Operations — literal final leaf set** (after all module phases):

`bookings:view`, `bookings.create:add`, `bookings.detail.stay:edit`, `bookings.detail.guests:edit`, `bookings.detail.parking:edit`, `bookings.detail.pets:edit`, `bookings.detail.pricing:edit`, `bookings.detail.workflow:edit`, `maintenance:view`, `maintenance.reminders:add`, `maintenance.reminders:edit`, `maintenance.reminders:delete`, `notifications:view`, `templates:view`, `publicPages:view`, `pricing:view`, `inbox:view`, `inbox.messages:edit`, plus all `marketing:*` leaves.

**Read Only — literal final leaf set:**

`bookings:view`, `maintenance:view`, `notifications:view`, `templates:view`, `publicPages:view`, `pricing:view`, `team:view`, `inbox:view`.

**Full Access — literal final leaf set:** every id in the full catalog table above.

### Old role preset → template (Phase 1)

| Old `role_id` | New `role_id`  | Template to seed / apply-equivalent | Permission array at Phase 1                                                                                                                                    |
| ------------- | -------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MANAGER`     | `ADMIN`        | Full Access                         | Keep current effective set if customized; if equal to Manager preset, leave as Manager preset old ids (or set to Full Access template old-id grant — same set) |
| `STAFF`       | `ADMIN`        | Operations                          | Same rule vs Staff preset                                                                                                                                      |
| `VIEWER`      | `ADMIN`        | Read Only                           | Same rule vs Viewer preset                                                                                                                                     |
| custom UUID   | unchanged UUID | _(custom template stays)_           | Remap contents only when module phases expand ids                                                                                                              |

---

## Phase 1 — Role Simplification & Data Migration (Owner | Admin)

**Goal:** Collapse property roles to `OWNER` (implicit) + `ADMIN` (only stored role_id), with zero access regression for any existing member.

**Files (verify with grep before editing — paths may have moved since 2026-08-27):** `supabase/migrations/`, `supabase/functions/_shared/orgAuth.ts`, `supabase/functions/_shared/propertyTeamPermissions.ts`, `ui/src/features/dashboard/team/lib/propertyTeamConstants.ts`, `ui/.../team/components/EditPermissionsDialog.tsx`, `docs/guides/routes/org/property/team.md`, `docs/architecture/data-model.md`.

### Tasks

- [x] Build the shared `requirePropertyPermissionAndFeature(req, propertyId, permission, feature?)` server helper in `_shared/orgAuth.ts` (or alongside `planEntitlements.ts`) per D17 — wraps `verifyPropertyAccess` + `requirePropertyFeature`/`catchPlanFeatureError` behind one call with one consistent error contract. No callers yet in this phase; Phases 3–7 adopt it wherever the D18 mapping table applies.
- [ ] Take a pre-migration backup (`bun run backup:supabase:dev`, and the prod equivalent at rollout time) — this migration is a data backfill, not just a schema change, so the standard rollback path is restore-from-backup, not a down-migration.
- [x] Grep for every literal reference to `'MANAGER'`, `'STAFF'`, `'VIEWER'` across **all of `supabase/functions/` and `ui/src/`**, not just the known permission-preset files — catch incidental role-based branching (badge styling, sort order, seat-limit differences, analytics) before removing the literals. _(Parking literals intentionally retained — Phase 9.)_
- [x] New migration: relax `property_members_role_id_format` / the equivalent `property_invitations` CHECK to `role_id = 'ADMIN' OR <uuid pattern>` — drop the `MANAGER`/`STAFF`/`VIEWER` literals.
- [x] Write a **dry-run diff script** first: for every active `property_members`/`property_invitations` row, compute (a) its current effective permission set under today's catalog and (b) the proposed backfilled set under Phase 0's mapping table; fail loudly on any mismatch before the real backfill runs.
- [x] Run the real backfill: set `role_id = 'ADMIN'` and expand `permissions`/`saved_permissions` on every `MANAGER`/`STAFF`/`VIEWER` row to its access-preserving equivalent.
- [x] Backfill `property_custom_roles.permissions` contents (custom roles keep their own `id`/`name` — only their permission array's _contents_ need remapping if Phase 0's catalog renamed any existing id). _(Phase 1: seed three templates; no id remap yet.)_
- [x] Remove `MANAGER`/`STAFF`/`VIEWER` from server types/constants (`propertyTeamPermissions.ts`) and delete `capStaffMemberPermissions` (dead once `STAFF` no longer exists). _(Legacy constants kept for dry-run/migration reference only.)_
- [x] Update the client role picker: remove the built-in role `<Select>`, replace with "Admin" (fixed, non-editable label) + a template-apply action (can temporarily reuse today's checkbox list against the _existing_ flat catalog until Phase 2 ships the real tree UI).
- [x] Seed the three replacement templates (Phase 0 names/grants) into `property_custom_roles` for every **existing** property (backfill).
- [x] Update the property-creation edge function (onboarding + "Add property" flow) to seed the same three templates for every **new** property going forward — this is a functional change, not just a backfill, and is easy to miss since it's a different code path than the migration.
- [x] Update `docs/guides/routes/org/property/team.md`: remove Manager/Staff/Viewer, document Admin + templates; also fix the two stale-doc issues research found (canonical id list missing `inbox:*`/`import:manage`; preset matrix missing an Inbox/Import row).
- [x] Update `docs/architecture/data-model.md`'s property-team-RBAC paragraph.
- [x] `bun run type-check` / `lint` / `build`. _(type-check + build pass; lint has pre-existing repo-wide issues.)_
- [ ] Manual QA (or the `verify` skill): log in as a former Manager, Staff, and Viewer post-migration each; confirm identical access to before, for every page.

**Success criteria:** every pre-migration member/invitation/custom-role row resolves to the exact same effective permission set post-migration (dry-run diff is clean); no `'MANAGER'`/`'STAFF'`/`'VIEWER'` literal remains anywhere in the codebase; a newly created property gets the three seeded templates automatically.

---

## Phase 2 — Permissions Matrix UI/UX Rebuild (Infrastructure)

**Goal:** Ship the new tree/template UI described above, rendered against the (still coarse, post-Phase-1) catalog. This is a pure UX upgrade — no new permission ids yet, so nothing about actual access changes in this phase.

**Files:** `ui/src/features/dashboard/team/components/EditPermissionsDialog.tsx` (likely replaced/rewritten), `CustomRoleFormDialog.tsx`, `CustomRolesSection.tsx`, new `PermissionsTreeView.tsx` / `PermissionsTemplateManager.tsx`, `ui/.../team/pages/PropertyTeamPage.tsx` (Permissions tab).

### Tasks

- [x] Build the collapsible Page → Section → Action tree component with three-state (on/off/indeterminate) toggles, driven purely by the catalog's metadata (label/action/parentId), not hardcoded per-page markup.
- [x] Build the toggle-chip row rendering for leaf actions (`[View] [Add] [Edit] [Delete]` per section).
- [x] Build search/filter (by section name, "differs from template" filter).
- [x] Replace the role `<Select>` with the "Apply Template ▾" picker + confirm-if-diverged dialog + auto "Custom" badge.
- [x] Build the "Manage Templates" view (list/create/duplicate/edit/delete), reusing the tree component in template-edit mode.
- [x] Add the sensitive-node warning affordance for `team.members:*` / `team.customRoles:*`. _(Phase 2 maps to coarse `team:manage` until Phase 6 splits.)_
- [x] Render a `TierBadge` (D20) next to any node/action listed in the plan-feature mapping table above whose `PlanFeatureKey` the org's current plan lacks — reuse the existing `TierBadge` component, don't build a new locked-state visual.
- [x] Handle the virtual `fromOrg: true` rows (org owner/admin shown in the property Team list without a real `property_members` row) — render the tree as full-access and read-only/non-editable for these, matching today's behavior.
- [x] Render the `plan_limited` seat-cap state in the new tree/list (today's "upgrade to reactivate" affordance) so Phase 2 doesn't regress that existing UX while replacing the surrounding component. _(Unchanged on Members tab; edit dialog not opened for plan-limited inactive rows.)_
- [x] Mobile layout: page-picker/stepper instead of one long scroll, verify at 375/768/1024px with ≥44×44px targets.
- [x] Wire this new UI against the current (pre-Phase-3) flat catalog so it's a drop-in visual/UX replacement with no behavior change.
- [x] `bun run type-check` / `lint` / `build`; Playwright pass on the Team → Permissions tab (assign template, customize, save, verify persisted correctly). _(type-check + build pass; manual/Playwright QA still recommended.)_

**Success criteria:** the Team → Permissions tab looks and behaves like the target UI/UX spec above, on desktop and mobile, with zero change in actual enforcement — every existing member's effective access is bit-for-bit identical before and after this phase.

---

## Phase 3 — Bookings Granular Rollout

**Goal:** Land the Bookings catalog nodes from the design section above, with server + client enforcement shipped together (D12).

**Files:** Bookings list/detail edge functions (grep for handlers under `supabase/functions/` calling `verifyPropertyAccess(..., 'bookings:edit')` / `'bookings:workflow'`), `BookingsListPage.tsx`, Booking Detail tab components, `_shared/propertyTeamPermissions.ts`, `propertyTeamConstants.ts`, the new tree's catalog data file from Phase 2.

### Tasks

- [x] Add `bookings.create:add`, `bookings.import:add` (rename of `import:manage` — keep the exact same semantics/default-template exclusion), `bookings.detail.{stay,guests,parking,pets,pricing}:edit`, `bookings.detail.workflow:edit` to the shared catalog.
- [x] Update seeded templates from Phase 1 to grant the new ids equivalent to their old `bookings:edit`/`bookings:workflow` grants (access-preserving, per D11).
- [x] Thread the new ids through every Bookings edge function handler, replacing the old flat `bookings:edit`/`bookings:workflow` checks with the tab-specific one.
- [x] Wire client-side: New Booking button, CSV Import entry point, each Booking Detail tab's edit controls, transition/automation buttons — gate each on its specific new id via `hasPropertyPermission`.
- [x] Update the Phase 2 tree's catalog data to render the new Bookings nodes (should be additive-only if the catalog data file is already metadata-driven).
- [x] Update the AI Dashboard Assistant's Bookings-related tool permission checks (create booking, edit stay/guests/parking/pets/pricing, run a workflow transition) to the new granular ids (D14) — grep `docs/architecture/ai-dashboard-assistant.md` and its tool-definition code for the current `bookings:edit`/`bookings:workflow` checks.
- [x] Migrate `bookings.import:add`'s existing `bookingImport` plan check (`_shared/importAccess.ts`) onto the D17 combined helper, and apply the D16 precedence in the client (Import entry point only visible with the permission; plan/seat messaging only decides whether the visible entry point is clickable).
- [x] `bun run type-check` / `lint` / `build`; manual QA as a member with, e.g., `bookings.detail.pricing:edit` but not `bookings.detail.guests:edit` — confirm the Pricing tab is editable and Guests tab is read-only/hidden as expected, **and** confirm the AI assistant respects the same split when asked to edit each.
- [x] Update `docs/guides/routes/org/property/bookings.md` and `bookings-detail.md` permission sections.

**Success criteria:** every Bookings action (list, create, per-tab edit, workflow transitions, import) is independently grantable and enforced identically whether triggered by a human click or by the AI assistant; CSV import correctly requires both `bookings.import:add` and the `bookingImport` plan feature, in that precedence order.

---

## Phase 4 — Finance, Maintenance & Pricing Granular Rollout

**Goal:** Split each module's single flat `edit` into Add/Edit/Delete (+Export where applicable), same server+client-together discipline.

**Files:** Finance/Maintenance/Pricing edge functions and pages (grep for `finance:edit`, `maintenance:edit`, `pricing:edit` call sites).

### Tasks

- [x] Add `finance.transactions:{add,edit,delete}`, `finance.export:view`, `maintenance.reminders:{add,edit,delete}`, `maintenance.export:view`, `pricing.rates:edit`, `pricing.blocks:{add,delete}` to the catalog.
- [x] Update templates to preserve current access (D11) for all three modules.
- [x] Thread new ids through each module's edge function handlers (Add Transaction / Edit / Delete / export-report; Add Reminder / Edit+mark-done / Delete / export-report; rate+fee edits / block dates / unblock dates).
- [x] Wire client-side controls for each new action across the three pages.
- [x] Decide whether Export moves off plan-gate-only onto a real permission (`finance.export:view` / a Maintenance equivalent) or stays plan-gated with the new id purely additive — confirm in Phase 0 if not already resolved, otherwise implement as designed above.
- [x] Update the AI Dashboard Assistant's Finance/Maintenance/Pricing tool permission checks (add transaction, add reminder, edit rates, block/unblock dates) to the new granular ids (D14).
- [x] Wire `finance.export:view` through the D17 helper against `financeReporting` (migrating `finance-export/index.ts`'s existing hand-rolled try/catch); keep `maintenance.export:view` client-only against `maintenanceReporting` per the mapping table (no server endpoint exists to migrate).
- [x] `bun run type-check` / `lint` / `build`; manual QA per module (grant Add+Edit but not Delete on Finance; confirm delete controls are hidden/403'd, including via the AI assistant; confirm Export is visible only with the permission and actionable only with the plan feature).
- [x] Update `docs/guides/routes/org/property/{finance,maintenance,dashboard}.md` (Pricing route guide lives wherever the pricing calendar page guide is — verify filename).

**Success criteria:** Add/Edit/Delete (and Export where applicable) are independently grantable and enforced across Finance, Maintenance, and Pricing, for both human and AI-assistant-triggered actions, with Export correctly requiring both its permission and its plan feature.

---

## Phase 5 — Settings, Public Pages & Templates Granular Rollout

**Goal:** The largest single cutover — split Settings' 16 sections, give Public Pages its own permission, and split Templates into standard/email/custom. Resolve the shared-field duplication question from Phase 0 before starting.

**Files:** `PropertySettingsCard.tsx` and its per-section sub-components, the Property/Stay-Guide Page Editor components, Templates page components, corresponding edge functions.

### Tasks

- [x] Add all 14 `settings.<section>:edit` ids + `settings.dangerZone:edit` (Archive/Restore only — **not** Delete, per D10) to the catalog.
- [x] Add `publicPages:view`, `publicPages.property:edit`, `publicPages.stayGuide:edit`.
- [x] Add `templates.standard:edit`, `templates.email:edit`, `templates.custom:{add,edit,delete}`.
- [x] Resolve and implement the Phase 0 decision on shared fields (Photos, Amenities, House Rules, Cancellation, Socials — edited from both Settings and Public Pages/Templates today): either keep genuinely independent grantable ids per surface, or point both surfaces at one shared id — implement whichever Phase 0 locked, and make sure both edit UIs stay in sync either way.
- [x] Update templates to preserve current access (D11) — this is the biggest single access-preservation surface in the whole plan, so re-run the dry-run-diff pattern from Phase 1 here too before cutover.
- [x] Thread new ids through every Settings/Public-Pages/Templates edge function handler.
- [x] Wire client-side: each Settings section's edit affordances, both Page Editor screens, each Templates group.
- [x] Preserve the Payment section's existing OTP-to-owner-email gate **in addition to** `settings.payment:edit` — do not let the permission replace the OTP check.
- [x] Update the AI Dashboard Assistant's Settings/Public Pages/Templates tool permission checks (get/edit each settings category, edit page-editor content, edit/add/delete templates) to the new granular ids (D14) — this module has the most tools to re-map, per the intake note's own per-module AI-assistant list.
- [x] Wire the plan-gated subset via the D17 helper per the mapping table: `settings.voiceReceptionist:edit` against `aiReceptionist`, `settings.aiOverrides:edit` against `aiMonthlyCreditAllowance`, `templates.custom:add`/`templates.email:edit`'s Save action against `customTemplates` (D19 — Edit/Preview/Reset stay free), and `publicPages.*:edit`'s autosave behavior against `publicPagesAutosave` — while closing out, fix the 3 other documented ungated autosave call sites (`plans-feature-matrix.md`) since this phase is already touching every autosave code path.
- [x] `bun run type-check` / `lint` / `build`; manual QA across at least 3 different partial-grant combinations given the size of this module, including a member with the permission but the org on a plan lacking the mapped feature (should see the control but not be able to act on it).
- [x] Update `docs/guides/routes/org/property/settings.md`, `public-pages.md` (if that's the filename — verify), `templates.md`.

**Success criteria:** all 16 Settings sections, both Page Editor screens, and all three Templates groups are independently grantable and enforced; the Payment OTP gate still fires regardless of the new permission; no shared-field surface (Photos/Amenities/House Rules/Cancellation/Socials) behaves inconsistently between Settings and Public Pages; every plan-gated subset from the mapping table requires both its permission and its plan feature, in that precedence order.

---

## Phase 6 — Team, Notifications & Inbox Granular Rollout

**Goal:** Round out the remaining modules — split Notifications' 6 Telegram modules, split Inbox's bundled "manage," add Delete to Team.

**Files:** Notifications page/edge functions, Inbox page/edge functions, Property Team page/edge functions.

### Tasks

- [x] Add `notifications.{chat,marketing,staff,operations,finance,maintenance}:edit` (6 ids) to the catalog, replacing the single flat `notifications:edit`.
- [x] Resolve and implement the Phase 0 decision on the shared bot-token card (gate on any-one-module-edit vs. all-six).
- [x] Add `inbox.messages:edit`, `inbox.channels:{add,delete}`, `inbox.quickReplies:{add,edit,delete}`, `inbox.automation:edit`, replacing the bundled `inbox:manage`.
- [x] Add `team.invitations:{add,edit,delete}`, `team.members:{edit,delete}`, `team.customRoles:{add,edit,delete}`, replacing `team:invite`/`team:manage`.
- [x] Update templates to preserve current access (D11) for all three.
- [x] Thread new ids through each module's edge functions and pages.
- [x] Update the AI Dashboard Assistant's Notifications/Inbox/Team tool permission checks (configure a Telegram module, select/reply to a chat conversation, list/add team members) to the new granular ids (D14).
- [x] Wire the plan-gated subset via the D17 helper: all six `notifications.<module>:edit` ids against the single shared `telegramNotifications` flag; `inbox.channels:{add,delete}` against `metaChatChannel`; `inbox.quickReplies:add`/`:edit` against `quickReplies` (list/delete stay free, D19); `inbox.automation:edit` against `aiChatAutoReply` only when the specific PATCH would enable auto-send (keep `social-inbox-settings`'s existing conditional-check pattern, don't broaden it); `team.invitations:add` against the pooled `teamManagement.maxMembers` seat cap, copying `PropertyTeamPage.tsx`'s existing reference pattern exactly.
- [x] `bun run type-check` / `lint` / `build`; manual QA (e.g. a member who can reply to Inbox messages but not manage Quick Replies or Channels; a member who can invite but the org is at its seat cap).
- [x] Update `docs/guides/routes/org/property/{notifications,inbox,team}.md`.

**Success criteria:** each of the 6 Notifications modules, Inbox's 4 sub-features, and Team's Add/Edit/Delete actions are independently grantable and enforced, including through the AI assistant; every plan-gated action in the mapping table requires both its permission and its plan feature/seat cap, in that precedence order.

**Shipped 2026-08-27:** migration `20261207120000_property_team_access_granular.sql`; expansion `accessPermissionExpansion.ts`; Telegram per-module + global any-of-six (Q3); inbox capability map; `TEAM_API_PERMISSIONS` leaf gates; client Team/Inbox/Notifications UI; type-check + build pass.

---

## Phase 7 — Marketing Granular Rollout (Net-New RBAC)

**Goal:** Bring Marketing Studio into the property-team-RBAC system for the first time. Full Access + Operations templates include Marketing (D13 / Q5); Read Only does not.

**Files:** Marketing Studio page(s) and its ~6 edge functions (currently `serveAdmin`-gated only — grep for the exact function names before starting), `_shared/propertyTeamPermissions.ts`.

### Tasks

- [x] Add `marketing:view`, `marketing.content:{add,edit}`, `marketing.templates:{add,edit,delete}`, `marketing.generate:add`, `marketing.publish:add` to the catalog.
- [x] Append Marketing leaf ids to the **Full Access** and **Operations** seeded templates; backfill those ids onto members whose effective set matches Full Access or Operations (former Manager/Staff). Do **not** grant Marketing to Read Only or arbitrary custom/partial sets (D13 / Q5).
- [x] Switch the ~6 Marketing edge functions from `serveAdmin`-only to `verifyPropertyAccess(..., 'marketing.*')`, preserving org-owner/org-admin/platform-admin implicit full access (unchanged pattern).
- [x] Wire client-side: hide/show the Marketing nav item and each in-page action by the new ids.
- [x] `bun run type-check` / `build`; manual QA — confirm a former Manager/Staff (Full Access / Operations) **has** Marketing access after Phase 7 backfill; a former Viewer (Read Only) does **not**; org owner/admin still have full access.
- [x] Update `docs/guides/routes/org/property/marketing.md`'s "Permissions" section to describe the new granular model instead of "allow-list only."
- [x] Update `docs/architecture/ai-dashboard-assistant.md` — Marketing tools use `marketing.*` ids (D14).
- [x] Wire the plan-gated subset via the D17 helper: `marketing:view`/`marketing.content:*` against `marketingStudio`; `marketing.generate:add` against `aiMarketingGeneration`; `marketing.publish:add` against `marketingStudio` **and** the numeric `marketingPublishLimitPerGroup` cap; `marketing.templates:add`/`:edit` against `customTemplates` (Q7).

**Success criteria:** Marketing has real per-property RBAC; Full Access and Operations members can use it (subject to plan entitlements); Read Only cannot; org owner/admin access is unaffected; every Marketing action correctly requires both its permission and its mapped plan feature, in that precedence order.

**Shipped 2026-08-27:** migration `20261208120000_property_team_marketing_granular.sql` (invitations backfill uses qualified `pi.permissions`); 8 marketing leaf ids; 5 edge functions on `serveAuthenticated` + `requirePropertyPermissionAndFeature`; client `useMarketingPermissions` + nav `marketing:view`; AI assistant `verifyMarketingPropertyAccess`; Q7 → `customTemplates` for template save paths. Verified: `bun run db:migrate`, `type-check`, `build`.

**Known follow-up (not blocking):** the migration’s Manager/Staff **heuristic** (`finance:view` / `bookings.import:add` / …) can grant Marketing to some custom/partial members who were not Full Access / Operations template matches (Q5). No strip migration shipped — see Risks.

---

## Phase 8 — Docs, QA & Full-Catalog Cleanup

**Goal:** Close every remaining doc gap, remove dead code, and do a full end-to-end verification pass across the whole rebuilt catalog.

### Tasks

- [x] Invoke `documentation-maintenance` + `route-guides` skills across every property route guide touched in Phases 1–7 (should already be mostly done per-phase — this is the final sweep).
- [x] Fix the org-level docs-accuracy issues found in research: nothing structural changes at org level, but confirm `docs/guides/routes/org/team.md` and `data-model.md` correctly describe org as fixed Owner/Admin (no action expected, verification only).
- [x] Remove any remaining references to `MANAGER`/`STAFF`/`VIEWER` across the **property** codebase (grep for the literals) once Phase 1–7 are all shipped. _(Parking literals intentionally retained — Phase 9. Legacy expansion maps / migration dry-run helpers kept.)_
- [x] Cross-check the server catalog, client mirror, and every AI Dashboard Assistant tool permission check (D14) against each other — one final pass to confirm no module was left on an old id in any of the three places.
- [x] Cross-check the plan-feature mapping table against every Phase 3–7 implementation — confirm every listed id actually went through the D17 combined helper, no plan-gated action was left checking only permission (or only plan), and the D16 precedence (permission = visibility, plan = actionability) holds everywhere it applies.
- [x] Full Playwright pass: create a brand-new property, invite an Admin, apply each seeded template, customize a few nodes, verify enforcement across all modules from Phases 3–7. _(Smoke suite shipped: `bun run test:e2e:team` — nav + deep-link redirects for Full Access / Operations / Read Only. Full live invite/customize matrix still deferred.)_
- [x] Run `bun run get_advisors`-equivalent / Supabase advisors check for any RLS/security warnings introduced by the migrations. _(Local SQL 2026-08-28: `property_members` / `property_invitations` / `property_custom_roles` — RLS on, 0 policies by design, anon/authenticated have no DML/SELECT, service_role full access, Phase 7 helper functions dropped, indexes present. Dashboard MCP `get_advisors` not wired in this environment.)_
- [x] Update `docs/PROJECT.md` if the property-team RBAC summary there needs refreshing.
- [x] Write the shipped-work entry once complete (`docs/archive/todos/shipped/` per repo convention) and move this plan file to `docs/workflow/done/`.

**Cleanup shipped mid-Phase 8 (2026-08-28):** `meta-inbox-oauth-pages` property gate `inbox:manage` → `inbox.channels:add`; AI invite-tool copy no longer mentions `VIEWER`; `PROJECT.md` / `data-model.md` / assistant manual testing guide aligned to ADMIN + leaf catalog.

**Enforcement gaps closed mid-Phase 8 (2026-08-28):** bare `ADMIN` invite/role-change → full catalog (reject explicit `[]`); Public Pages Edit/editor require `publicPages.*.edit`; Progress pricing forms honor `bookings.detail.pricing:edit`; dashboard finance/maintenance widgets honor `:view`; Team invite resend/cancel/members/roles + Inbox Manage chrome are leaf-split; Help & Support route ungated for non–plan-limited members; permissions-tree parent select-all confirms sensitive descendants. Docs: property `team` / `bookings-detail` / `dashboard` / `public-pages` / `inbox` / `help-support` guides.

**Success criteria:** zero stale role/permission references anywhere in the codebase or docs; server, client, and AI-assistant permission checks agree everywhere; a full Playwright run across every module passes.

**Sets up (not part of this plan):** the intake backlog item "Review each dashboard pages, section & actions based on user role" (`docs/workflow/intake/_to-plan.md`) is explicitly blocked on this plan finishing — once Phase 8 ships, that item becomes actionable as a follow-on audit against the now-real granular catalog.

---

## Phase 9 — Future: Parking Parity (stub, deferred)

**Do not start until the parking E2E flow is finalized** ([`../planned/parking-e2e-later-phases.md`](../planned/parking-e2e-later-phases.md)).

Parking already mirrors today's property RBAC shape almost exactly (`parking_members`, `parking_custom_roles`, `_shared/parkingTeamPermissions.ts`, `MANAGER`/`STAFF`/`VIEWER`). Once parking's own product surface stabilizes, re-run this same plan's shape against it: role simplification to Owner|Admin, granular catalog per parking page/section, same server+client-together module rollout discipline. Re-derive the parking page/section inventory fresh at that time rather than assuming this doc's property inventory transfers directly — parking's page set (bookings, dashboard, finance, notifications, pricing, settings, team, inbox, help-support) is similar but not identical.

---

## Risks & Mitigations

| Risk                                                                                                                                                                                                                                           | Mitigation                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 7 Marketing member heuristic can over-grant vs Q5 (custom/partial sets that merely contain a Manager/Staff signal leaf get Marketing)                                                                                                    | **Accepted historical risk** — templates + role_id path match Q5; heuristic was best-effort for legacy custom rows. Forward invites use templates. **No access-reducing corrective migration** unless product asks; audit via `property_members.permissions @> marketing:view` if needed |
| Catalog grows into an unusable wall of toggles                                                                                                                                                                                                 | Granularity heuristic (D8), tree UI with search/filter, seeded templates so most admins never touch the raw tree                                                                                                                                                                         |
| Property/org/parking RBAC drift further apart                                                                                                                                                                                                  | Explicitly scoped to property only (D1); Phase 9 stub tells the future implementer to reuse this doc's pattern rather than invent a new one                                                                                                                                              |
| Shared-field duplication (Photos/Amenities/House Rules/Socials/Cancellation live on both Settings and Public Pages/Templates) causes "why can't I edit this" confusion                                                                         | Resolved explicitly in Phase 0 (Open Question #2), documented in the route guides and in-UI copy                                                                                                                                                                                         |
| A module's enforcement rollout regresses an internal caller (cron job, AI tool, automation) still using an old permission id                                                                                                                   | Module-by-module cutover (D12); never delete an old id's check until its replacement has shipped and been verified; grep for every call site of the id being replaced before editing                                                                                                     |
| `plan_limited` / `saved_permissions` deactivate-reactivate contract breaks under the new, larger permission arrays                                                                                                                             | No shape change to these columns (D4) — only the vocabulary grows; explicitly test deactivate→reactivate in every phase's QA pass                                                                                                                                                        |
| The AI Dashboard Assistant keeps checking an old/removed permission id after a module cuts over, letting it act beyond (or less than) what its caller could actually do by hand                                                                | D14 makes the assistant a required third file to update per module; each of Phases 3–7 has an explicit assistant-tool task; Phase 8 does a final three-way cross-check                                                                                                                   |
| A new property created mid-rollout (between Phase 1 and Phase 8) doesn't get the seeded templates because only the migration backfill was updated, not the creation flow                                                                       | Phase 1 explicitly separates "backfill existing properties" from "seed new properties going forward" as two distinct tasks                                                                                                                                                               |
| A control shows an "upgrade your plan" prompt to a member who was never granted the underlying permission in the first place (or the reverse — a plan-gated action ships checking only permission, letting a Free-tier org use a paid feature) | D16 formalizes permission-as-outer/plan-as-inner precedence; D17's combined helper makes both checks structurally required together instead of two calls an author can forget one of                                                                                                     |
| A future module reintroduces the "forgot the plan check" bug the codebase has already hit before (`plans-feature-matrix.md`'s own gap log, e.g. `property-templates-settings`) because a new branch skips the D17 helper                       | D17 helper is the only sanctioned way to combine the two checks going forward; Phase 8's cross-check task explicitly re-verifies every mapped id used it                                                                                                                                 |

## Open Questions

| #     | Status                                                | Notes                                                                              |
| ----- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Q1–Q6 | **Locked** in Phase 0 § Locked decisions (2026-08-27) |                                                                                    |
| Q7    | **Locked** (Phase 7)                                  | `marketing.templates:add` / `:edit` → `customTemplates`; `:delete` permission-only |

Back to [done index](./README.md).
