---
title: 'Super Admin — Organizations & Organization hub — operator guide'
status: active
tags: [guides, routes, admin]
updated: 2026-09-10 (Activity tab: platform-actions / org-activity toggle)
---

# Super Admin — Organizations & Organization hub

Routes:

- `/admin/orgs` — organization directory (index)
- `/admin/orgs/:orgSlug` — organization hub — **one scrollable page**, sections are in-page
  anchors (`#section-overview`, `#section-subscription`, …), not separate routes
- any other `/admin/orgs/:orgSlug/…` path (old bookmarks, the pre-overhaul `…/properties` route)
  **redirects** to the hub

> **Status:** Documented · shipped in the Super Admin console overhaul (Phases 3–5); hub nav
> redesigned from routed pill tabs + a sidebar dump to a single scroll-spy page on 2026-09-05
> (matches the Property/Org/Development Settings pages' `AdminSectionNavLayout` pattern).

## Progress overview

| Section             | E2E save | Validation | Docs | Notes                                                                                                                                                                    |
| ------------------- | -------- | ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Organizations index | n/a      | —          | Done | Search + per-page; server summary cards; table (≥lg) / card list. Rows open the hub.                                                                                     |
| Hub · Overview      | n/a      | —          | Done | KPI cards + subscription / verification / open-work summary cards                                                                                                        |
| Hub · Subscription  | Done     | client     | Done | Assign/override plan via `org-subscriptions-admin` POST (covers every org property)                                                                                      |
| Hub · Listings      | n/a      | —          | Done | Properties + parkings grids (`useProperties` / `useParkings`); cards deep-link to tenant                                                                                 |
| Hub · Approvals     | Done     | —          | Done | `list-super-admin-approvals?organizationId=` + the 3 shared review dialogs                                                                                               |
| Hub · AI credits    | Done     | client     | Done | `AiCreditWalletCard` prefilled with the org id                                                                                                                           |
| Hub · Support       | Done     | —          | Done | `list-support-tickets-admin?org_id=` + shared ticket detail dialog                                                                                                       |
| Hub · Activity      | n/a      | —          | Done | Toggle: **Platform actions** (`list-super-admin-audit?targetType=organization&targetId=`) / **Org activity** (`list-activity-log?orgId=` — the org's own `activity_log`) |
| Hub · Settings      | n/a      | —          | Done | Read-only identity + deep links to the org's own Team / Settings / Plans pages                                                                                           |

---

## Access

`RequireSuperAdmin` — email in `SUPER_ADMIN_EMAILS` (server) / `VITE_SUPER_ADMIN_EMAILS` (client
gate). All hub edge calls go through `serveSuperAdmin` / `verifySuperAdminJwt`. Super admins can
also hit the org-scoped endpoints the Listings / Support sections reuse because `orgAuth.ts`
allows `isSuperAdminEmail` alongside org owners.

---

## Host-facing knowledge

Internal platform-team tooling. Hosts never see it and never need to know it exists. If the
platform team changes an org's plan or resolves an approval from here, the effect is identical to
doing it from the dedicated `/admin/pricing/subscriptions` or `/admin/approvals` pages.

---

## Behavior notes

- **Index** (`SuperAdminOrgsPage`): `list-organizations-admin` — `?q=` search on name/slug,
  `?plan=<code>|none`, `?page=`/`?limit=`, `?summary=true` for the top cards. `plan=none` is
  filtered in the function (PostgREST can't express "no live embedded row").
- **Hub shell** (`SuperAdminOrgShell`): loads `get-organization-admin?slug=` once and provides it
  to every section via `SuperAdminOrgContext` (`useSuperAdminOrgContext`) — plain React context,
  not router outlet context, since sections are no longer separate routes. Header uses the shared
  `SuperAdminDetailHeader` (same component as the Host detail page): a colored icon tile identifies
  the entity as an organization, the plan badge + a total "open" count (pending approvals + open
  tickets) sit next to the title, and a `details` row below shows the org's dashboard link
  (`/:slug`, opens `orgDashboardPath` in a new tab) and the owner name — each its own labelled,
  icon-prefixed item instead of one squished subtitle string. The whole page is one
  `AdminSectionNavLayout` (same component as Property/Org/Development Settings): a sticky left nav
  card with a sliding active-pill highlight at `lg+`, content in a single scrollable column,
  `AdminSection` anchors keyed `overview`/`subscription`/`listings`/`approvals`/`ai`/`support`/
  `activity`/`settings`. Below `lg` the nav card is hidden (matches every other settings page) —
  the page is just scrolled.
- **No sidebar entries.** The global Platform sidebar does not grow an org-scoped section anymore
  — the hub's own left nav card is the only secondary nav, so there's nothing stacked at the
  bottom of the main sidebar.
- Cross-page deep links to one section (`superAdminPaths.organizationHubSection(slug, 'ai')` →
  `/admin/orgs/:slug#section-ai`, used by the Overview attention list and the AI usage top-orgs
  table) work from anywhere: the shell watches `location.hash` and scrolls the target section into
  view once its content has mounted.
- **Subscription** section assigns a plan with no `propertyIds` → server default = every property
  the org owns. It invalidates `['super-admin','org-detail',slug]` on success so the header/plan
  badge refresh.
- **Activity** section (`SuperAdminOrgActivitySection`) has a two-tab toggle. **Platform actions**
  (default) is the unchanged `super_admin_audit_events` view for this org. **Org activity** calls
  `list-activity-log` with an explicit `orgId` (`useSuperAdminOrgActivity`) — a super-admin
  resolves as `platform_admin` in `verifyOrgAccess`, so every row is visible — and renders the
  shared `ActivityRow` / `ActivityDetailSheet` with a "Load more" keyset button.

---

## API reference

| Method   | Endpoint                                            | Notes                                                           |
| -------- | --------------------------------------------------- | --------------------------------------------------------------- |
| GET      | `list-organizations-admin`                          | `?q=`, `?plan=`, `?page=`, `?limit=`, `?summary=true`           |
| GET      | `get-organization-admin?slug=` / `?organizationId=` | Org identity + owner + counts + plan + verification + open work |
| POST     | `org-subscriptions-admin`                           | `{ organizationId, planId, note? }` — assign/override plan      |
| GET      | `list-super-admin-approvals?organizationId=`        | Org-scoped approvals queue                                      |
| GET      | `list-support-tickets-admin?org_id=`                | Org-scoped support tickets                                      |
| GET/POST | `ai-platform-credit-wallet?org_id=`                 | Wallet balance / ledger / manual adjustment                     |

---

## Implementation map

| Concern          | Path                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Index page       | `ui/src/features/dashboard/super-admin/pages/SuperAdminOrgsPage.tsx`                                                                                                                                   |
| Hub shell        | `ui/src/features/dashboard/super-admin/components/super-admin-orgs/SuperAdminOrgShell.tsx`                                                                                                             |
| Hub header       | `ui/src/features/dashboard/super-admin/components/shared/SuperAdminDetailHeader.tsx` (shared with Host detail)                                                                                         |
| Hub context      | `ui/src/features/dashboard/super-admin/components/super-admin-orgs/superAdminOrgContext.ts`                                                                                                            |
| Sections         | `ui/src/features/dashboard/super-admin/pages/SuperAdminOrg{Overview,Subscription,Listings,Approvals,Ai,Support,Activity,Settings}Section.tsx` — plain content components, rendered inline by the shell |
| Layout           | `ui/src/features/dashboard/bookings/components/AdminSectionNavLayout.tsx` (shared with Property/Org/Development Settings)                                                                              |
| Hooks            | `ui/src/features/dashboard/super-admin/hooks/useSuperAdminOrgs.ts`                                                                                                                                     |
| Edge functions   | `supabase/functions/{list-organizations-admin,get-organization-admin}/index.ts`                                                                                                                        |
| Shared approvals | `supabase/functions/_shared/superAdminApprovalsQueue.ts`                                                                                                                                               |
| Routes           | `ui/src/features/dashboard/super-admin/routes/index.tsx`                                                                                                                                               |
| Paths            | `superAdminPaths.{organizations,organizationHub,organizationHubSection}`                                                                                                                               |

---

## Testing

| Layer  | Path / spec                                             | Manual                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only     | —                                                           |
| Manual | —                                                       | [`super-admin-manual.md`](../testing/super-admin-manual.md) |

---

## Related docs

- [Super Admin Overview](./overview.md)
- [Org subscriptions](./org-subscriptions.md) · [Approvals](./approvals.md) · [Support](./support.md)
- [`docs/PROJECT.md`](../../PROJECT.md) — Super Admin console note
- [`docs/workflow/done/super-admin-console-overhaul.md`](../../../workflow/done/super-admin-console-overhaul.md)

---

## Pending / follow-ups

- [ ] Team section is link-out only — a read-only member list could live in the hub.
- [ ] Danger-zone actions (suspend / delete org, impersonate owner) need dedicated edge functions.
- [ ] Verification approve/reject is reachable via the Approvals section; a dedicated Verification
      tab with asset previews is a nice-to-have.
- [ ] Plan filter dropdown on the index (data supports `?plan=`, UI ships search only for v1).
