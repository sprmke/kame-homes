---
title: 'Super Admin Overview — operator guide'
status: active
tags: [guides, routes, admin]
updated: 2026-09-05
---

# Super Admin Overview — operator guide

Route: `/admin`

> **Status:** Documented

## Progress overview

| Section         | E2E save         | Validation | Docs | Notes                                                                                                                                                         |
| --------------- | ---------------- | ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KPI strip       | Done (read-only) | —          | Done | Fixed 9 `StatCard`s in a 3×3 grid (Undisbursed payouts always shown, even at 0, so the grid never leaves an orphan card); most link to the matching list page |
| Charts          | Done (read-only) | —          | Done | Growth area (12 mo, Total/New toggle) · Plan-mix donut · AI-cost-by-feature bar                                                                               |
| Attention queue | Done (read-only) | —          | Done | Approvals in review · open tickets · undisbursed payouts · orgs with no live plan — links to lists                                                            |
| Recent activity | Done (read-only) | —          | Done | Latest orgs / subscription changes / support tickets                                                                                                          |
| Range toggle    | n/a              | —          | Done | 30d / 90d / 12mo — scopes the AI-spend KPI + AI-cost chart                                                                                                    |
| Sidebar nav     | n/a              | —          | Done | Grouped into labelled sections (`SUPER_ADMIN_NAV_GROUPS`) below a header-less Overview link                                                                   |

> Tracked by [`docs/workflow/done/super-admin-console-overhaul.md`](../../../workflow/done/super-admin-console-overhaul.md).

---

## Overview

Landing page for the **platform super-admin** area — a distinct tier from org/property admin and from the legacy `ADMIN_ALLOWED_EMAILS` gate. It is a **data dashboard**: the `super-admin-overview` edge function (`?range=30d|90d|12mo`) returns KPI rollups, a 12-month org/subscription growth series, live plan mix, AI cost by feature, an attention queue, and recent activity. There is no "Jump to" destinations grid on this page anymore — the Platform sidebar is the single place to browse every destination, so the dashboard stays focused on metrics.

**Access:** `RequireSuperAdmin` consumes the server-derived `list-organizations.isSuperAdmin` capability. Edge functions independently enforce `SUPER_ADMIN_EMAILS`. Uses the same signed-in session as the legacy admin dashboard (`useAdminSession`), so a super admin must already be signed in via Google OAuth; being super admin does not require being in `ADMIN_ALLOWED_EMAILS`.

**Step-up verification (all `/admin/*` pages):** the first time you save a sensitive change in a session — an org subscription or billing period, platform payment or parking-commission settings, a parking payout or clawback, an AI credit-wallet adjustment, AI or dashboard-assistant global settings, the plan catalog, platform settings, platform host announcements, or a contract-consideration decision — a **Confirm it's you** dialog opens (the same modal as the host payment-settings flow). You click **Send OTP**, a 6-digit code is emailed to _your own_ signed-in email, and you enter it. One successful code keeps every sensitive action unlocked for ~15 minutes; after that you are asked again. Read-only pages, lists, and viewing detail never prompt. The code expires in 10 minutes, allows 5 attempts, and is capped at 3 sends per 15 minutes. If email is down you cannot complete these actions — there is no bypass by design.

---

## Host-facing knowledge

The Super Admin area is an internal control panel for the platform team — it is not visible to hosts, organizations, or guests, and hosts never need to know it exists.

**Common host questions**

- Q: I run a property — can I see this page?
  A: No. This area is only for the platform team that operates the booking system itself, not for hosts or their staff.
- Q: Does anything here affect my organization's settings?
  A: Only if the platform team makes a change on your behalf (for example, listing your property under a development). Your own organization, property, and team settings are managed from your regular dashboard.

---

## Navigation

The Platform sidebar is driven by `SUPER_ADMIN_NAV_GROUPS` (`superAdminPlatformNav.ts`). It renders
**Overview** (`/admin`, no group heading) then each group as a labelled section:

| Group             | Items → destination                                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organizations     | Hosts `/admin/hosts` · Developments `/admin/developments` · Properties `/admin/properties`                                                                                          |
| Billing & catalog | Pricing plans `/admin/pricing/plans` · Subscriptions `/admin/pricing/subscriptions` · Payment settings `/admin/pricing/payment-settings` · Parking payouts `/admin/parking/payouts` |
| Operations        | Approvals `/admin/approvals` · Support tickets `/admin/support`                                                                                                                     |
| Content           | Announcements `/admin/announcements` · FAQs `/admin/support/faqs`                                                                                                                   |
| Platform          | AI Management `/admin/settings`                                                                                                                                                     |

`SUPER_ADMIN_PLATFORM_DESTINATIONS` (flat, group order) has no consumer today — the Overview page's
"Jump to" grid that used it was removed for being redundant with the sidebar — but it stays
exported for the planned global ⌘K search (see Pending / follow-ups). Group headings are hidden
when the sidebar is collapsed.

---

## API reference

| Method | Endpoint                         | Notes                                                                                                                                      |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `super-admin-overview?range=30d` | `range` = `30d` \| `90d` \| `12mo`. Returns `kpis`, `growthSeries`, `planMix`, `aiCostByFeature`, `attention`, `recent`. Super-admin only. |

---

## Implementation map

| Concern       | Path                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------ |
| Page          | `ui/src/features/dashboard/super-admin/pages/SuperAdminOverviewPage.tsx`                   |
| Components    | `ui/src/features/dashboard/super-admin/components/super-admin-overview/*`                  |
| Hook          | `ui/src/features/dashboard/super-admin/hooks/useSuperAdminOverview.ts`                     |
| Edge function | `supabase/functions/super-admin-overview/index.ts`                                         |
| Shared nav    | `ui/src/features/dashboard/super-admin/lib/superAdminPlatformNav.ts`                       |
| Sidebar       | `ui/src/features/dashboard/bookings/lib/adminSidebarNav.ts` (`buildSuperAdminNavSections`) |
| Shell / guard | `SuperAdminShell.tsx` / `RequireSuperAdmin.tsx`                                            |
| Paths         | `ui/src/features/dashboard/super-admin/lib/superAdminPaths.ts`                             |
| Routes        | `ui/src/features/dashboard/super-admin/routes/index.tsx`                                   |

---

## Testing

| Layer | Path / spec                                                 | Manual                                      |
| ----- | ----------------------------------------------------------- | ------------------------------------------- |
| Unit  | `supabase/functions/_shared/superAdminVerification_test.ts` | —                                           |
| E2E   | `ui/e2e/features/admin/adminShellSmoke.spec.ts` (`@ci`)     | Step-up OTP, irreversible admin actions     |
| N/A   | —                                                           | `docs/guides/testing/super-admin-manual.md` |

---

## Related docs

- [Route index](../README.md)
- [`docs/PROJECT.md`](../../PROJECT.md)
- [`.cursor/rules/admin-auth.mdc`](../../../../.cursor/rules/admin-auth.mdc) — legacy admin tier this super-admin tier is layered on top of

---

## Pending / follow-ups

- [ ] MRR / revenue trend chart (needs subscription-event history, not just current snapshots).
- [ ] Audit-log feed once super-admin action logging lands (Phase 6 backlog).
- [ ] Global ⌘K search over orgs / hosts / properties / tickets.
